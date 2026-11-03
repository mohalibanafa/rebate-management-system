const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const db = require('../src/db/database');
const { generateStatementHtml } = require('../src/reports/statementPdfTemplate');

app.whenReady().then(async () => {
  try {
    console.log('--- Testing PDF Generation via Off-screen HTML Template ---');

    // 1. Prepare test database & data
    const testDbPath = path.join(__dirname, 'test_pdf.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    db.openDatabase(testDbPath, false);

    // Create a customer
    const cust = db.createCustomer({
      name: 'شركة الأفق للتجارة والتوزيع المحدودة',
      accounting_system_id: 'CUST-2026-99',
      phone: '+966 50 123 4567',
      email: 'finance@al-ofuq.com',
      default_discount_rate: 0.07,
      default_grace_days: 20
    });

    // Create invoices
    const inv1 = db.createInvoice({
      customer_id: cust.id,
      accounting_trans_id: 'INV-1001',
      invoice_date: '2026-10-01',
      total_amount: 50000,
      discount_rate: 0.07,
      grace_days: 20
    });

    const inv2 = db.createInvoice({
      customer_id: cust.id,
      accounting_trans_id: 'INV-1002',
      invoice_date: '2026-10-15',
      total_amount: 30000,
      discount_rate: 0.07,
      grace_days: 15
    });

    // Add a return
    db.createAdjustment({
      invoice_id: inv1.id,
      accounting_trans_id: 'RET-001',
      adjustment_date: '2026-10-05',
      amount: 5000,
      type: 'RETURN',
      notes: 'بضاعة تالفة أثناء النقل والتفريغ'
    });

    // Add payments
    db.createPayment({
      customer_id: cust.id,
      accounting_trans_id: 'PAY-8801',
      payment_date: '2026-10-10', // within 20 days of inv1 -> eligible
      amount: 45000
    });

    db.createPayment({
      customer_id: cust.id,
      accounting_trans_id: 'PAY-8802',
      payment_date: '2026-11-05', // 21 days after inv2 (grace: 15) -> late
      amount: 20000
    });

    // Grant exception to inv2
    db.grantInvoiceException(inv2.id, 'موافقة المدير المالي نظراً لتأخر التحويل البنكي من العميل');

    // 2. Fetch full statement
    const statement = db.getCustomerStatement(cust.id);
    assert(statement.breakdown.length === 2, 'Should have 2 invoices');
    console.log('✔ Statement calculated with FIFO and exception');

    // 3. Generate HTML
    const html = generateStatementHtml(statement, {
      company_name: 'شركة الاستثمار والحلول التجارية العالمية'
    });
    assert(html.includes('كشف حساب تحليلي'), 'HTML must include statement title');
    assert(html.includes('شركة الأفق للتجارة والتوزيع المحدودة'), 'HTML must include customer name');
    assert(html.includes('INV-1001'), 'HTML must include invoice 1');
    assert(html.includes('INV-1002'), 'HTML must include invoice 2');
    assert(html.includes('RET-001'), 'HTML must include return');
    assert(html.includes('PAY-8801'), 'HTML must include payment 1');
    assert(html.includes('PAY-8802'), 'HTML must include payment 2');
    assert(html.includes('استثناء إداري معتمد'), 'HTML must reflect exception');
    console.log('✔ HTML template successfully generated and verified');

    // 4. Create offscreen BrowserWindow and load HTML
    const win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 1448,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // 5. Generate PDF
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
      margins: {
        marginType: 'custom',
        top: 0.35,
        bottom: 0.35,
        left: 0.35,
        right: 0.35
      }
    });

    const outputPath = path.join(__dirname, 'test_output_statement.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);

    assert(fs.existsSync(outputPath), 'PDF file must be written to disk');
    const stats = fs.statSync(outputPath);
    assert(stats.size > 5000, 'PDF file must be non-trivial (>5KB)');

    // Verify PDF header %PDF-
    const header = fs.readFileSync(outputPath, { encoding: 'utf8', flag: 'r' }).slice(0, 5);
    assert.strictEqual(header, '%PDF-', 'Must be a valid PDF file');

    console.log(`✔ SUCCESS: Pure PDF generated from HTML template! Size: ${stats.size} bytes at ${outputPath}`);

    // Cleanup
    win.destroy();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore locked SQLite file on Windows during immediate exit
    }

    app.quit();
    process.exit(0);
  } catch (err) {
    console.error('❌ PDF Test Failed:', err);
    app.quit();
    process.exit(1);
  }
});
