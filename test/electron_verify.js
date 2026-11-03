const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying Electron & System Components ---');

// 1. Verify build files
const distHtml = path.join(__dirname, '../dist/index.html');
assert(fs.existsSync(distHtml), 'dist/index.html must exist');
console.log('✔ dist/index.html built successfully');

// 2. Verify database module
const db = require('../src/db/database');
const testDbPath = path.join(__dirname, 'smoke_test.db');
db.openDatabase(testDbPath, false);
console.log('✔ Database opened and schema initialized');

// 3. Test customer creation
const cust = db.createCustomer({
  name: 'عميل الفحص التجريبي',
  accounting_system_id: 'SMOKE-01',
  email: 'smoke@example.com'
});
assert.strictEqual(cust.name, 'عميل الفحص التجريبي');
console.log('✔ Customer created:', cust.id);

// 4. Test invoice and payment FIFO
const inv = db.createInvoice({
  customer_id: cust.id,
  accounting_trans_id: 'INV-SMOKE-1',
  invoice_date: '2026-06-01',
  total_amount: 10000,
  discount_rate: 0.07,
  grace_days: 30
});
const pay = db.createPayment({
  customer_id: cust.id,
  accounting_trans_id: 'REC-SMOKE-1',
  payment_date: '2026-06-10',
  amount: 10000
});

const stmt = db.getCustomerStatement(cust.id);
assert.strictEqual(stmt.totalRebateEarned, 700);
console.log('✔ FIFO statement calculation verified (Rebate: 700 SAR)');

// 5. Test Mail Worker functions
const mailWorker = require('../src/mail/mailWorker');
assert(typeof mailWorker.startEmailWorker === 'function');
assert(typeof mailWorker.processEmailQueue === 'function');
console.log('✔ Mail Worker functions verified');

// Clean up
try {
  fs.unlinkSync(testDbPath);
  console.log('✔ Cleaned up smoke test DB');
} catch (e) {}

console.log('--- All System & Architectural Components Successfully Verified! ---');
