let DatabaseDriver;
try {
  const { DatabaseSync } = require('node:sqlite');
  if (DatabaseSync) {
    DatabaseDriver = function(file, opts = {}) {
      const db = new DatabaseSync(file, { readOnly: opts.readonly || false });
      db.pragma = (cmd) => db.exec('PRAGMA ' + cmd);
      return db;
    };
  }
} catch (e) {
  // fallback to better-sqlite3 if node:sqlite is not present
}
if (!DatabaseDriver) {
  DatabaseDriver = require('better-sqlite3');
}

const path = require('path');
const fs = require('fs');
const { calculateCustomerLedger } = require('../engine/calculator');

let activeDb = null;
let currentDbPath = null;
let isCurrentDbReadOnly = false;

/**
 * Initializes the database tables and indexes
 */
function initSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- 1. Customers Table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accounting_system_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      default_discount_rate REAL DEFAULT 0.07,
      default_grace_days INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Invoices Table
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      accounting_trans_id TEXT NOT NULL,
      invoice_date DATE NOT NULL,
      total_amount REAL NOT NULL CHECK(total_amount > 0),
      discount_rate REAL NOT NULL,
      grace_days INTEGER NOT NULL,
      is_exception_granted INTEGER DEFAULT 0,
      exception_reason TEXT,
      is_corrected INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    -- 3. Payments Table
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      accounting_trans_id TEXT NOT NULL,
      payment_date DATE NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      is_corrected INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    -- 4. Adjustments / Returns Table
    CREATE TABLE IF NOT EXISTS adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      accounting_trans_id TEXT NOT NULL,
      adjustment_date DATE NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      type TEXT DEFAULT 'RETURN',
      notes TEXT,
      is_corrected INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
    );

    -- 5. Email Queue Table
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      error_message TEXT
    );

    -- 6. System Settings Table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Indexes for fast ledger lookups
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_adjustments_invoice ON adjustments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status);
  `);
}

/**
 * Connect to or open a SQLite database file
 */
function openDatabase(dbFilePath, readOnly = false) {
  if (activeDb) {
    activeDb.close();
  }

  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  activeDb = new DatabaseDriver(dbFilePath, { readonly: readOnly, fileMustExist: false });
  currentDbPath = dbFilePath;
  isCurrentDbReadOnly = readOnly;

  if (!readOnly) {
    initSchema(activeDb);
  }

  return activeDb;
}

function getDb() {
  if (!activeDb) {
    throw new Error('Database is not initialized. Call openDatabase first.');
  }
  return activeDb;
}

function getDatabaseStatus() {
  return {
    path: currentDbPath,
    isReadOnly: isCurrentDbReadOnly,
    fileName: currentDbPath ? path.basename(currentDbPath) : null
  };
}

// -------------------------------------------------------------
// Customer Operations
// -------------------------------------------------------------

function getAllCustomers() {
  const db = getDb();
  const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();

  // Enhance each customer with on-the-fly calculated financial metrics
  return customers.map(c => {
    const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ?').all(c.id);
    const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ?').all(c.id);
    
    // Fetch adjustments for all customer's invoices
    let adjustments = [];
    if (invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      const placeholders = invoiceIds.map(() => '?').join(',');
      adjustments = db.prepare(`SELECT * FROM adjustments WHERE invoice_id IN (${placeholders})`).all(...invoiceIds);
    }

    const calc = calculateCustomerLedger(invoices, payments, adjustments);

    return {
      ...c,
      total_gross_sales: calc.totalGrossSales,
      total_returns: calc.totalReturns,
      total_net_sales: calc.totalNetSales,
      total_payments: calc.totalPayments,
      total_rebate_earned: calc.totalRebateEarned,
      total_remaining_unpaid: calc.totalRemainingUnpaid,
      unallocated_cash: calc.unallocatedCash,
      customer_balance: calc.customerBalance,
      invoice_count: invoices.length,
      unpaid_invoice_count: calc.breakdown.filter(i => i.status !== 'FULLY_PAID').length
    };
  });
}

function getCustomerById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

function createCustomer(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO customers (
      accounting_system_id, name, email, phone, default_discount_rate, default_grace_days
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    data.accounting_system_id.trim(),
    data.name.trim(),
    data.email.trim(),
    data.phone ? data.phone.trim() : null,
    Number(data.default_discount_rate) || 0.07,
    Number(data.default_grace_days) || 30
  );
  return getCustomerById(res.lastInsertRowid);
}

function updateCustomer(id, data) {
  const db = getDb();
  db.prepare(`
    UPDATE customers SET
      accounting_system_id = ?,
      name = ?,
      email = ?,
      phone = ?,
      default_discount_rate = ?,
      default_grace_days = ?
    WHERE id = ?
  `).run(
    data.accounting_system_id.trim(),
    data.name.trim(),
    data.email.trim(),
    data.phone ? data.phone.trim() : null,
    Number(data.default_discount_rate) || 0.07,
    Number(data.default_grace_days) || 30,
    id
  );
  return getCustomerById(id);
}

function deleteCustomer(id) {
  const db = getDb();
  // Check transactions
  const invCount = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE customer_id = ?').get(id).c;
  const payCount = db.prepare('SELECT COUNT(*) as c FROM payments WHERE customer_id = ?').get(id).c;
  if (invCount > 0 || payCount > 0) {
    throw new Error('لا يمكن حذف العميل لوجود حركات فواتير أو سدادات مسجلة باسمه.');
  }
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
}

// -------------------------------------------------------------
// Detailed Customer Statement / Ledger
// -------------------------------------------------------------

function getCustomerStatement(customerId) {
  const db = getDb();
  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error('العميل غير موجود.');
  }

  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY invoice_date ASC, id ASC').all(customerId);
  const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date ASC, id ASC').all(customerId);

  let adjustments = [];
  if (invoices.length > 0) {
    const invoiceIds = invoices.map(i => i.id);
    const placeholders = invoiceIds.map(() => '?').join(',');
    adjustments = db.prepare(`SELECT * FROM adjustments WHERE invoice_id IN (${placeholders}) ORDER BY adjustment_date ASC, id ASC`).all(...invoiceIds);
  }

  const ledger = calculateCustomerLedger(invoices, payments, adjustments);

  return {
    customer,
    ...ledger
  };
}

// -------------------------------------------------------------
// Transaction Entry & Mutation Operations
// -------------------------------------------------------------

function createInvoice(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO invoices (
      customer_id, accounting_trans_id, invoice_date, total_amount, discount_rate, grace_days
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    data.customer_id,
    data.accounting_trans_id.trim(),
    data.invoice_date,
    Number(data.total_amount),
    Number(data.discount_rate),
    Number(data.grace_days)
  );

  const invoiceId = res.lastInsertRowid;

  // Queue email notification if requested
  if (data.send_notification) {
    const customer = getCustomerById(data.customer_id);
    if (customer && customer.email) {
      const statement = getCustomerStatement(customer.id);
      const discountVal = (Number(data.total_amount) * Number(data.discount_rate)).toFixed(2);
      
      const subject = `إشعار صدور فاتورة جديدة رقم ${data.accounting_trans_id} - برنامج الخصم`;
      const bodyHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">السادة / ${customer.name} المحترمين</h2>
          <p>تحية طيبة وبعد،،</p>
          <p>نود إشعاركم بصدور الفاتورة رقم <strong>${data.accounting_trans_id}</strong> بتاريخ <strong>${data.invoice_date}</strong> وفق شروط خصم تعجيل الدفع المجمع:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1;">إجمالي الفاتورة:</td><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${Number(data.total_amount).toLocaleString()} ر.س</td></tr>
            <tr style="background: #ecfdf5; color: #047857;"><td style="padding: 8px; border: 1px solid #cbd5e1;">الخصم المكتسب عند السداد في الموعد (${(Number(data.discount_rate) * 100).toFixed(1)}%):</td><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${discountVal} ر.س</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1;">مهلة السداد:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${data.grace_days} يوماً من تاريخ الفاتورة</td></tr>
            <tr style="background: #eff6ff; color: #1d4ed8;"><td style="padding: 8px; border: 1px solid #cbd5e1;">رصيد الخصم المجمع المعتمد لديكم حتى الآن:</td><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${statement.totalRebateEarned.toLocaleString()} ر.س</td></tr>
          </table>
          <p style="color: #64748b; font-size: 0.9em;">سعداء دائماً بالتعامل معكم.</p>
        </div>
      `;

      queueEmail(customer.email, subject, bodyHtml, 'INVOICE', invoiceId);
    }
  }

  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
}

function updateInvoice(id, data) {
  const db = getDb();
  // Invalidate or update any pending email in queue
  db.prepare(`
    UPDATE email_queue SET status = 'CANCELLED' 
    WHERE reference_type = 'INVOICE' AND reference_id = ? AND status = 'PENDING'
  `).run(id);

  db.prepare(`
    UPDATE invoices SET
      accounting_trans_id = ?,
      invoice_date = ?,
      total_amount = ?,
      discount_rate = ?,
      grace_days = ?,
      is_corrected = 1
    WHERE id = ?
  `).run(
    data.accounting_trans_id.trim(),
    data.invoice_date,
    Number(data.total_amount),
    Number(data.discount_rate),
    Number(data.grace_days),
    id
  );

  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

function grantInvoiceException(id, reason) {
  const db = getDb();
  if (!reason || reason.trim().length === 0) {
    throw new Error('يجب تدوين تبرير خطي لاعتماد الخصم الاستثنائي.');
  }

  db.prepare(`
    UPDATE invoices SET
      is_exception_granted = 1,
      exception_reason = ?,
      is_corrected = 1
    WHERE id = ?
  `).run(reason.trim(), id);

  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

function revokeInvoiceException(id) {
  const db = getDb();
  db.prepare(`
    UPDATE invoices SET
      is_exception_granted = 0,
      exception_reason = NULL,
      is_corrected = 1
    WHERE id = ?
  `).run(id);

  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
}

function createPayment(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO payments (
      customer_id, accounting_trans_id, payment_date, amount
    ) VALUES (?, ?, ?, ?)
  `);

  const res = stmt.run(
    data.customer_id,
    data.accounting_trans_id.trim(),
    data.payment_date,
    Number(data.amount)
  );

  const paymentId = res.lastInsertRowid;

  // Queue email notification if requested
  if (data.send_notification) {
    const customer = getCustomerById(data.customer_id);
    if (customer && customer.email) {
      const statement = getCustomerStatement(customer.id);
      const subject = `إشعار استلام سداد رقم ${data.accounting_trans_id} - تحديث رصيد الخصم`;
      const bodyHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #047857; border-bottom: 2px solid #10b981; padding-bottom: 8px;">السادة / ${customer.name} المحترمين</h2>
          <p>تحية طيبة وبعد،،</p>
          <p>نشكركم على سدادكم ونود إشعاركم بتسجيل سند القبض رقم <strong>${data.accounting_trans_id}</strong> بمبلغ <strong>${Number(data.amount).toLocaleString()} ر.س</strong> بتاريخ <strong>${data.payment_date}</strong>.</p>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; margin: 15px 0;">
            <p style="margin: 0; font-size: 1.1em; color: #065f46;">
              رصيد الخصم التراكمي المعتمد لديكم حتى الآن: <strong>${statement.totalRebateEarned.toLocaleString()} ر.س</strong>
            </p>
            ${statement.customerBalance > 0 
              ? `<p style="margin: 5px 0 0; color: #475569;">الرصيد المتبقي المستحق: ${statement.customerBalance.toLocaleString()} ر.س</p>`
              : `<p style="margin: 5px 0 0; color: #059669;">رصيدكم مسدد بالكامل ولديك رصيد دائن: ${Math.abs(statement.customerBalance).toLocaleString()} ر.س</p>`
            }
          </div>
          <p style="color: #64748b; font-size: 0.9em;">شاكرين حسن تعاونكم والتزامكم.</p>
        </div>
      `;

      queueEmail(customer.email, subject, bodyHtml, 'PAYMENT', paymentId);
    }
  }

  return db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
}

function updatePayment(id, data) {
  const db = getDb();
  // Invalidate any pending email
  db.prepare(`
    UPDATE email_queue SET status = 'CANCELLED' 
    WHERE reference_type = 'PAYMENT' AND reference_id = ? AND status = 'PENDING'
  `).run(id);

  db.prepare(`
    UPDATE payments SET
      accounting_trans_id = ?,
      payment_date = ?,
      amount = ?,
      is_corrected = 1
    WHERE id = ?
  `).run(
    data.accounting_trans_id.trim(),
    data.payment_date,
    Number(data.amount),
    id
  );

  return db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
}

function createAdjustment(data) {
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(data.invoice_id);
  if (!invoice) {
    throw new Error('الفاتورة الأصلية المستهدفة غير موجودة.');
  }

  // Check cumulative returns constraint
  const currentReturns = db.prepare('SELECT SUM(amount) as s FROM adjustments WHERE invoice_id = ?').get(data.invoice_id).s || 0;
  const newTotal = currentReturns + Number(data.amount);
  if (newTotal > invoice.total_amount) {
    throw new Error(`قيمة المرتجع تتجاوز أصل الفاتورة. أصل الفاتورة: ${invoice.total_amount} ر.س، المرتجعات السابقة: ${currentReturns} ر.س.`);
  }

  const stmt = db.prepare(`
    INSERT INTO adjustments (
      invoice_id, accounting_trans_id, adjustment_date, amount, type, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    data.invoice_id,
    data.accounting_trans_id.trim(),
    data.adjustment_date,
    Number(data.amount),
    data.type || 'RETURN',
    data.notes ? data.notes.trim() : null
  );

  return db.prepare('SELECT * FROM adjustments WHERE id = ?').get(res.lastInsertRowid);
}

function updateAdjustment(id, data) {
  const db = getDb();
  const currentAdj = db.prepare('SELECT * FROM adjustments WHERE id = ?').get(id);
  if (!currentAdj) {
    throw new Error('المرتجع غير موجود.');
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(currentAdj.invoice_id);
  const otherReturns = db.prepare('SELECT SUM(amount) as s FROM adjustments WHERE invoice_id = ? AND id != ?').get(currentAdj.invoice_id, id).s || 0;
  const newTotal = otherReturns + Number(data.amount);

  if (newTotal > invoice.total_amount) {
    throw new Error(`مجموع المرتجعات سيتجاوز أصل الفاتورة (${invoice.total_amount} ر.س).`);
  }

  db.prepare(`
    UPDATE adjustments SET
      accounting_trans_id = ?,
      adjustment_date = ?,
      amount = ?,
      type = ?,
      notes = ?,
      is_corrected = 1
    WHERE id = ?
  `).run(
    data.accounting_trans_id.trim(),
    data.adjustment_date,
    Number(data.amount),
    data.type || 'RETURN',
    data.notes ? data.notes.trim() : null,
    id
  );

  return db.prepare('SELECT * FROM adjustments WHERE id = ?').get(id);
}

function getInvoicesForCustomer(customerId) {
  const db = getDb();
  const statement = getCustomerStatement(customerId);
  return statement.breakdown.map(inv => ({
    id: inv.id,
    accounting_trans_id: inv.accounting_trans_id,
    invoice_date: inv.invoice_date,
    gross_amount: inv.gross_amount,
    total_returns: inv.total_returns,
    net_total: inv.net_total,
    remaining_unpaid: inv.remaining_unpaid,
    status: inv.status
  }));
}

// -------------------------------------------------------------
// Email Queue Functions
// -------------------------------------------------------------

function queueEmail(recipientEmail, subject, bodyHtml, refType = null, refId = null) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO email_queue (recipient_email, subject, body_html, reference_type, reference_id, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `).run(recipientEmail, subject, bodyHtml, refType, refId);
}

function getPendingEmails(limit = 5) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM email_queue WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?
  `).all(limit);
}

function markEmailSent(id) {
  const db = getDb();
  return db.prepare(`
    UPDATE email_queue SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
}

function markEmailFailed(id, errorMessage) {
  const db = getDb();
  return db.prepare(`
    UPDATE email_queue SET status = 'FAILED', error_message = ? WHERE id = ?
  `).run(errorMessage, id);
}

// -------------------------------------------------------------
// Settings & SMTP Storage
// -------------------------------------------------------------

function getSetting(key, defaultValue = null) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  const db = getDb();
  return db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
}

module.exports = {
  openDatabase,
  getDb,
  getDatabaseStatus,
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerStatement,
  createInvoice,
  updateInvoice,
  grantInvoiceException,
  revokeInvoiceException,
  createPayment,
  updatePayment,
  createAdjustment,
  updateAdjustment,
  getInvoicesForCustomer,
  queueEmail,
  getPendingEmails,
  markEmailSent,
  markEmailFailed,
  getSetting,
  setSetting
};
