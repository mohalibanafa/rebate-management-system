const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const dbModule = require('../src/db/database');

const TEST_DB_PATH = path.join(__dirname, 'test_rebate.db');

describe('Database Layer & Financial Constraints', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
    }
    dbModule.openDatabase(TEST_DB_PATH);
  });

  it('Creates customer, records invoice and payment, and calculates statement correctly', () => {
    const customer = dbModule.createCustomer({
      accounting_system_id: 'CUST-100',
      name: 'شركة النور للتجارة',
      email: 'alnoor@example.com',
      phone: '0501234567',
      default_discount_rate: 0.07,
      default_grace_days: 30
    });

    assert.ok(customer.id);
    assert.strictEqual(customer.name, 'شركة النور للتجارة');

    // Create Invoice
    const invoice = dbModule.createInvoice({
      customer_id: customer.id,
      accounting_trans_id: 'INV-5001',
      invoice_date: '2026-04-01',
      total_amount: 10000,
      discount_rate: 0.07,
      grace_days: 30,
      send_notification: false
    });

    assert.ok(invoice.id);

    // Create On-time Payment
    const payment = dbModule.createPayment({
      customer_id: customer.id,
      accounting_trans_id: 'REC-2001',
      payment_date: '2026-04-15', // 14 days later
      amount: 10000,
      send_notification: false
    });

    assert.ok(payment.id);

    // Verify Statement
    const statement = dbModule.getCustomerStatement(customer.id);
    assert.strictEqual(statement.totalNetSales, 10000);
    assert.strictEqual(statement.totalRebateEarned, 700);
    assert.strictEqual(statement.totalRemainingUnpaid, 0);
    assert.strictEqual(statement.customerBalance, 0);

    // Verify Customer List aggregates
    const all = dbModule.getAllCustomers();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].total_rebate_earned, 700);
    assert.strictEqual(all[0].unpaid_invoice_count, 0);
  });

  it('Rejects returns exceeding original invoice gross amount', () => {
    const customer = dbModule.createCustomer({
      accounting_system_id: 'CUST-200',
      name: 'مؤسسة الرياض',
      email: 'riyadh@example.com'
    });

    const invoice = dbModule.createInvoice({
      customer_id: customer.id,
      accounting_trans_id: 'INV-200',
      invoice_date: '2026-05-01',
      total_amount: 5000,
      discount_rate: 0.05,
      grace_days: 20
    });

    // Valid return
    dbModule.createAdjustment({
      invoice_id: invoice.id,
      accounting_trans_id: 'RET-01',
      adjustment_date: '2026-05-05',
      amount: 3000
    });

    // Second return exceeding balance (3000 + 2500 = 5500 > 5000)
    assert.throws(() => {
      dbModule.createAdjustment({
        invoice_id: invoice.id,
        accounting_trans_id: 'RET-02',
        adjustment_date: '2026-05-06',
        amount: 2500
      });
    }, /تتجاوز أصل الفاتورة/);
  });

  it('Correctly records exception approval with reason', () => {
    const customer = dbModule.createCustomer({
      accounting_system_id: 'CUST-300',
      name: 'مؤسسة الفجر',
      email: 'fajr@example.com'
    });

    const invoice = dbModule.createInvoice({
      customer_id: customer.id,
      accounting_trans_id: 'INV-300',
      invoice_date: '2026-01-01',
      total_amount: 8000,
      discount_rate: 0.08,
      grace_days: 15
    });

    // Late payment (30 days later)
    dbModule.createPayment({
      customer_id: customer.id,
      accounting_trans_id: 'REC-300',
      payment_date: '2026-01-31',
      amount: 8000
    });

    let statement = dbModule.getCustomerStatement(customer.id);
    assert.strictEqual(statement.totalRebateEarned, 0); // zero before exception

    // Grant exception
    dbModule.grantInvoiceException(invoice.id, 'موافقة الإدارة لظرف قهري');

    statement = dbModule.getCustomerStatement(customer.id);
    assert.strictEqual(statement.totalRebateEarned, 640); // 8% of 8,000 = 640
    assert.strictEqual(statement.breakdown[0].is_exception_granted, 1);
    assert.strictEqual(statement.breakdown[0].exception_reason, 'موافقة الإدارة لظرف قهري');
  });

  it('Flags edited records as corrected', () => {
    const customer = dbModule.createCustomer({
      accounting_system_id: 'CUST-400',
      name: 'مؤسسة الصفا',
      email: 'safa@example.com'
    });

    const invoice = dbModule.createInvoice({
      customer_id: customer.id,
      accounting_trans_id: 'INV-400',
      invoice_date: '2026-01-01',
      total_amount: 5000,
      discount_rate: 0.05,
      grace_days: 30
    });

    assert.strictEqual(invoice.is_corrected, 0);

    const updated = dbModule.updateInvoice(invoice.id, {
      accounting_trans_id: 'INV-400-MOD',
      invoice_date: '2026-01-02',
      total_amount: 5500,
      discount_rate: 0.05,
      grace_days: 30
    });

    assert.strictEqual(updated.is_corrected, 1);
    assert.strictEqual(updated.accounting_trans_id, 'INV-400-MOD');
  });
});
