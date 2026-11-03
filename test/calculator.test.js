const { describe, it } = require('node:test');
const assert = require('node:assert');
const { calculateCustomerLedger } = require('../src/engine/calculator');

describe('Financial Engine (Rebate & FIFO Recalculation)', () => {
  it('Scenario 1: On-time single payment earns full discount', () => {
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 10000,
        discount_rate: 0.07,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-01-15', // 14 days later (<= 30)
        amount: 10000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalNetSales, 10000);
    assert.strictEqual(result.totalRebateEarned, 700); // 7% of 10,000
    assert.strictEqual(result.totalRemainingUnpaid, 0);
    assert.strictEqual(result.unallocatedCash, 0);
    assert.strictEqual(result.breakdown[0].status, 'FULLY_PAID');
    assert.strictEqual(result.breakdown[0].settlements[0].is_eligible, true);
    assert.strictEqual(result.breakdown[0].settlements[0].diff_days, 14);
  });

  it('Scenario 2: Late payment past grace days earns ZERO discount', () => {
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 10000,
        discount_rate: 0.07,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-02-10', // 40 days later (> 30)
        amount: 10000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalNetSales, 10000);
    assert.strictEqual(result.totalRebateEarned, 0); // Late -> 0 discount
    assert.strictEqual(result.totalRemainingUnpaid, 0);
    assert.strictEqual(result.breakdown[0].status, 'FULLY_PAID');
    assert.strictEqual(result.breakdown[0].settlements[0].is_eligible, false);
    assert.strictEqual(result.breakdown[0].settlements[0].diff_days, 40);
  });

  it('Scenario 3: Proportional discount on partial payments', () => {
    // 10,000 invoice: 5,000 paid at day 14 (eligible), 5,000 paid at day 40 (late)
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-03-01',
        total_amount: 10000,
        discount_rate: 0.07,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-088',
        payment_date: '2026-03-15', // 14 days
        amount: 5000
      },
      {
        id: 2,
        customer_id: 101,
        accounting_trans_id: 'REC-099',
        payment_date: '2026-04-10', // 40 days
        amount: 5000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalNetSales, 10000);
    assert.strictEqual(result.totalRebateEarned, 350); // 7% on 5,000 = 350; 0 on late 5,000
    assert.strictEqual(result.breakdown[0].settlements.length, 2);
    assert.strictEqual(result.breakdown[0].settlements[0].discount_earned, 350);
    assert.strictEqual(result.breakdown[0].settlements[1].discount_earned, 0);
    assert.strictEqual(result.totalRemainingUnpaid, 0);
    assert.strictEqual(result.breakdown[0].status, 'FULLY_PAID');
  });

  it('Scenario 4: Returns reduce net total and shrink discount container', () => {
    // Invoice 10,000. Return 1,000 on day 5. Net becomes 9,000.
    // Payment of 9,000 on day 15.
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-03-01',
        total_amount: 10000,
        discount_rate: 0.07,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const adjustments = [
      {
        id: 1,
        invoice_id: 1,
        accounting_trans_id: 'RET-001',
        adjustment_date: '2026-03-05',
        amount: 1000,
        type: 'RETURN',
        notes: 'Damaged item'
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-03-15',
        amount: 9000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, adjustments);

    assert.strictEqual(result.totalGrossSales, 10000);
    assert.strictEqual(result.totalReturns, 1000);
    assert.strictEqual(result.totalNetSales, 9000);
    assert.strictEqual(result.totalRebateEarned, 630); // 7% of 9,000 = 630
    assert.strictEqual(result.totalRemainingUnpaid, 0);
  });

  it('Scenario 5: Overpayment flows into unallocated credit balance', () => {
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 4000,
        discount_rate: 0.05,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-01-10',
        amount: 5000 // 1,000 excess
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalNetSales, 4000);
    assert.strictEqual(result.totalRemainingUnpaid, 0);
    assert.strictEqual(result.unallocatedCash, 1000);
    assert.strictEqual(result.customerBalance, -1000); // Company owes customer 1,000
  });

  it('Scenario 6: Advance overpayment settles future invoice and gets discount', () => {
    // Payment of 10,000 on Jan 10
    // Invoice 1: 4,000 on Jan 1
    // Invoice 2: 6,000 on Feb 1 (created after payment)
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 4000,
        discount_rate: 0.05,
        grace_days: 30,
        is_exception_granted: 0
      },
      {
        id: 2,
        customer_id: 101,
        accounting_trans_id: 'INV-002',
        invoice_date: '2026-02-01',
        total_amount: 6000,
        discount_rate: 0.08,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-01-10',
        amount: 10000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalNetSales, 10000);
    assert.strictEqual(result.totalRemainingUnpaid, 0);
    assert.strictEqual(result.unallocatedCash, 0);
    // Invoice 1 rebate: 4000 * 0.05 = 200
    // Invoice 2 rebate: 6000 * 0.08 = 480 (paid before invoice date -> diffDays negative -> <= grace_days)
    assert.strictEqual(result.totalRebateEarned, 680);
    assert.strictEqual(result.breakdown[1].status, 'FULLY_PAID');
    assert.strictEqual(result.breakdown[1].settlements[0].is_eligible, true);
  });

  it('Scenario 7: Manager exception grants rebate to late invoice', () => {
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 5000,
        discount_rate: 0.10,
        grace_days: 15,
        is_exception_granted: 1,
        exception_reason: 'Bank transfer holiday delay'
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-02-01', // 31 days (> 15)
        amount: 5000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, []);

    assert.strictEqual(result.totalRebateEarned, 500); // 10% on 5,000 granted via exception
    assert.strictEqual(result.breakdown[0].settlements[0].is_eligible, true);
    assert.strictEqual(result.breakdown[0].exception_reason, 'Bank transfer holiday delay');
  });

  it('Scenario 8: Return added after full payment causes cash to spill to next invoice', () => {
    // Invoice 1: 10,000 (Jan 1)
    // Invoice 2: 5,000 (Feb 1)
    // Payment 1: 10,000 (Jan 15) -> fully pays Inv 1
    // Later, Return of 3,000 on Inv 1 -> Inv 1 net becomes 7,000
    // 3,000 of Payment 1 automatically spills to Inv 2!
    const invoices = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'INV-001',
        invoice_date: '2026-01-01',
        total_amount: 10000,
        discount_rate: 0.10,
        grace_days: 30,
        is_exception_granted: 0
      },
      {
        id: 2,
        customer_id: 101,
        accounting_trans_id: 'INV-002',
        invoice_date: '2026-02-01',
        total_amount: 5000,
        discount_rate: 0.05,
        grace_days: 30,
        is_exception_granted: 0
      }
    ];

    const adjustments = [
      {
        id: 1,
        invoice_id: 1,
        accounting_trans_id: 'RET-001',
        adjustment_date: '2026-01-20',
        amount: 3000,
        type: 'RETURN'
      }
    ];

    const payments = [
      {
        id: 1,
        customer_id: 101,
        accounting_trans_id: 'REC-001',
        payment_date: '2026-01-15',
        amount: 10000
      }
    ];

    const result = calculateCustomerLedger(invoices, payments, adjustments);

    assert.strictEqual(result.totalNetSales, 12000); // (10000 - 3000) + 5000 = 12000
    assert.strictEqual(result.breakdown[0].net_total, 7000);
    assert.strictEqual(result.breakdown[0].total_paid, 7000);
    assert.strictEqual(result.breakdown[0].earned_discount, 700); // 10% of 7000

    // Inv 2 received 3,000 from the spillover!
    assert.strictEqual(result.breakdown[1].total_paid, 3000);
    assert.strictEqual(result.breakdown[1].remaining_unpaid, 2000);
    assert.strictEqual(result.breakdown[1].earned_discount, 150); // 5% of 3000 = 150
    assert.strictEqual(result.breakdown[1].status, 'PARTIALLY_PAID');
    assert.strictEqual(result.totalRebateEarned, 850); // 700 + 150 = 850
  });
});
