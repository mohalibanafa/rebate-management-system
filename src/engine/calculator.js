/**
 * Financial Calculation & FIFO Allocation Engine
 * Pure deterministic recalculation from raw ledger events
 */

/**
 * Safely parses a date string (YYYY-MM-DD or ISO) into UTC epoch days.
 * Ensures timezone-independent day difference calculations.
 */
function parseDateToDays(dateStr) {
  if (!dateStr) return 0;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }
  const d = new Date(dateStr);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
}

/**
 * Recalculates customer ledger from raw chronological transactions
 * 
 * @param {Array} invoices - List of invoices
 * @param {Array} payments - List of payments/receipts
 * @param {Array} adjustments - List of credit notes/returns/damaged goods
 * @returns {Object} Comprehensive calculation result
 */
function calculateCustomerLedger(invoices = [], payments = [], adjustments = []) {
  // 1. Sort invoices chronologically (by invoice_date, then id)
  const sortedInvoices = [...invoices].sort((a, b) => {
    const diff = parseDateToDays(a.invoice_date) - parseDateToDays(b.invoice_date);
    return diff !== 0 ? diff : (a.id || 0) - (b.id || 0);
  });

  // 2. Build invoice map and bind adjustments
  const invoiceMap = new Map();
  for (const inv of sortedInvoices) {
    const grossAmount = Math.round(Number(inv.total_amount) * 100) / 100;
    invoiceMap.set(inv.id, {
      id: inv.id,
      customer_id: inv.customer_id,
      accounting_trans_id: inv.accounting_trans_id,
      invoice_date: inv.invoice_date,
      gross_amount: grossAmount,
      discount_rate: Number(inv.discount_rate) || 0,
      grace_days: Number(inv.grace_days) || 0,
      is_exception_granted: Number(inv.is_exception_granted) === 1 ? 1 : 0,
      exception_reason: inv.exception_reason || null,
      is_corrected: Number(inv.is_corrected) === 1 ? 1 : 0,
      created_at: inv.created_at,
      returns: [],
      total_returns: 0,
      net_total: grossAmount,
      remaining_unpaid: grossAmount,
      total_paid: 0,
      earned_discount: 0,
      settlements: [],
      status: 'UNPAID'
    });
  }

  // 3. Bind adjustments (returns & damaged) to their target invoices
  const sortedAdjustments = [...adjustments].sort((a, b) => {
    const diff = parseDateToDays(a.adjustment_date) - parseDateToDays(b.adjustment_date);
    return diff !== 0 ? diff : (a.id || 0) - (b.id || 0);
  });

  for (const adj of sortedAdjustments) {
    if (invoiceMap.has(adj.invoice_id)) {
      const inv = invoiceMap.get(adj.invoice_id);
      const adjAmount = Math.round(Number(adj.amount) * 100) / 100;
      inv.returns.push({
        id: adj.id,
        accounting_trans_id: adj.accounting_trans_id,
        adjustment_date: adj.adjustment_date,
        amount: adjAmount,
        type: adj.type || 'RETURN',
        notes: adj.notes || '',
        is_corrected: Number(adj.is_corrected) === 1 ? 1 : 0
      });
      inv.total_returns = Math.round((inv.total_returns + adjAmount) * 100) / 100;
      // Shrink net total and remaining unpaid
      inv.net_total = Math.max(0, Math.round((inv.gross_amount - inv.total_returns) * 100) / 100);
      inv.remaining_unpaid = inv.net_total;
    }
  }

  // 4. Sort payments chronologically (by payment_date, then id)
  const sortedPayments = [...payments].sort((a, b) => {
    const diff = parseDateToDays(a.payment_date) - parseDateToDays(b.payment_date);
    return diff !== 0 ? diff : (a.id || 0) - (b.id || 0);
  });

  // Prepare cash pool with available balance tracking
  const cashPool = sortedPayments.map(p => ({
    id: p.id,
    customer_id: p.customer_id,
    accounting_trans_id: p.accounting_trans_id,
    payment_date: p.payment_date,
    original_amount: Math.round(Number(p.amount) * 100) / 100,
    available_cash: Math.round(Number(p.amount) * 100) / 100,
    is_corrected: Number(p.is_corrected) === 1 ? 1 : 0
  }));

  // 5. FIFO Settlement Allocation
  let paymentPointer = 0;
  for (const inv of invoiceMap.values()) {
    if (inv.remaining_unpaid <= 0) {
      inv.status = 'FULLY_PAID';
      continue;
    }

    const invDays = parseDateToDays(inv.invoice_date);

    while (paymentPointer < cashPool.length && inv.remaining_unpaid > 0.0001) {
      const pay = cashPool[paymentPointer];
      if (pay.available_cash <= 0.0001) {
        paymentPointer++;
        continue;
      }

      const appliedAmount = Math.round(Math.min(pay.available_cash, inv.remaining_unpaid) * 100) / 100;
      pay.available_cash = Math.round((pay.available_cash - appliedAmount) * 100) / 100;
      inv.remaining_unpaid = Math.round((inv.remaining_unpaid - appliedAmount) * 100) / 100;
      inv.total_paid = Math.round((inv.total_paid + appliedAmount) * 100) / 100;

      // Evaluate discount eligibility based on actual payment date vs invoice date
      const payDays = parseDateToDays(pay.payment_date);
      const diffDays = payDays - invDays;

      // Eligible if paid within grace days (or advance payment diffDays <= graceDays) OR exception granted
      const isWithinGrace = diffDays <= inv.grace_days;
      const isExceptionApplied = !isWithinGrace && inv.is_exception_granted === 1;
      const isEligible = isWithinGrace || isExceptionApplied;

      const discountEarned = isEligible
        ? Math.round(appliedAmount * inv.discount_rate * 100) / 100
        : 0;

      inv.earned_discount = Math.round((inv.earned_discount + discountEarned) * 100) / 100;

      inv.settlements.push({
        payment_id: pay.id,
        payment_trans_id: pay.accounting_trans_id,
        payment_date: pay.payment_date,
        amount_applied: appliedAmount,
        diff_days: diffDays,
        grace_days: inv.grace_days,
        is_eligible: isEligible,
        discount_rate: inv.discount_rate,
        discount_earned: discountEarned,
        is_exception_applied: isExceptionApplied,
        is_corrected: pay.is_corrected
      });

      if (pay.available_cash <= 0.0001) {
        paymentPointer++;
      }
    }

    if (inv.remaining_unpaid <= 0.0001) {
      inv.remaining_unpaid = 0;
      inv.status = 'FULLY_PAID';
    } else if (inv.total_paid > 0) {
      inv.status = 'PARTIALLY_PAID';
    } else {
      inv.status = 'UNPAID';
    }
  }

  // 6. Calculate Aggregates
  let totalGrossSales = 0;
  let totalReturns = 0;
  let totalNetSales = 0;
  let totalRebateEarned = 0;
  let totalRemainingUnpaid = 0;
  let totalPaidApplied = 0;
  const breakdown = [];

  for (const inv of invoiceMap.values()) {
    totalGrossSales = Math.round((totalGrossSales + inv.gross_amount) * 100) / 100;
    totalReturns = Math.round((totalReturns + inv.total_returns) * 100) / 100;
    totalNetSales = Math.round((totalNetSales + inv.net_total) * 100) / 100;
    totalRebateEarned = Math.round((totalRebateEarned + inv.earned_discount) * 100) / 100;
    totalRemainingUnpaid = Math.round((totalRemainingUnpaid + inv.remaining_unpaid) * 100) / 100;
    totalPaidApplied = Math.round((totalPaidApplied + inv.total_paid) * 100) / 100;
    breakdown.push(inv);
  }

  const totalPayments = cashPool.reduce(
    (sum, p) => Math.round((sum + p.original_amount) * 100) / 100,
    0
  );

  const unallocatedCash = cashPool.reduce(
    (sum, p) => Math.round((sum + p.available_cash) * 100) / 100,
    0
  );

  // Net customer balance: positive = customer owes company, negative = company owes customer (credit)
  const customerBalance = Math.round((totalRemainingUnpaid - unallocatedCash) * 100) / 100;

  return {
    breakdown,
    totalGrossSales,
    totalReturns,
    totalNetSales,
    totalPayments,
    totalPaidApplied,
    totalRebateEarned,
    totalRemainingUnpaid,
    unallocatedCash,
    customerBalance,
    cashPool
  };
}

module.exports = {
  calculateCustomerLedger,
  parseDateToDays
};
