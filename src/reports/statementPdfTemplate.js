/**
 * Professional HTML Statement Template Generator for PDF & Printing
 * Produces clean, vector-rendered, printable Arabic financial statements
 */

function formatNumber(num) {
  const val = Number(num) || 0;
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return String(dateStr).slice(0, 10);
}

/**
 * Generates standalone, print-ready HTML for a customer's rebate statement.
 * 
 * @param {Object} statement - Full statement object from calculateCustomerLedger + customer info
 * @param {Object} options - Additional branding options (company_name, etc.)
 * @returns {string} Complete HTML5 document string
 */
function generateStatementHtml(statement, options = {}) {
  const { customer, breakdown = [], totalGrossSales = 0, totalReturns = 0, totalNetSales = 0, totalPayments = 0, totalRebateEarned = 0, totalRemainingUnpaid = 0, unallocatedCash = 0, customerBalance = 0, cashPool = [] } = statement;
  const companyName = options.company_name || 'مؤسسة الحلول التجارية المتقدمة';
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Render invoice rows and nested settlements/returns
  const invoiceRowsHtml = breakdown.map((inv, index) => {
    let statusClass = 'status-unpaid';
    let statusText = 'غير مسددة';
    if (inv.status === 'FULLY_PAID') {
      statusClass = 'status-paid';
      statusText = 'مسددة بالكامل';
    } else if (inv.status === 'PARTIALLY_PAID') {
      statusClass = 'status-partial';
      statusText = 'مسددة جزئياً';
    }

    // Returns under invoice
    const returnsHtml = (inv.returns || []).map(ret => `
      <tr class="sub-row return-row">
        <td colspan="2" class="sub-title">
          <span class="sub-icon">↩</span>
          مرتجع / تالف: سند رقم <strong>${ret.accounting_trans_id}</strong>
          ${ret.notes ? `<span class="notes">(${ret.notes})</span>` : ''}
        </td>
        <td class="text-center">${formatDate(ret.adjustment_date)}</td>
        <td class="text-danger font-bold">-${formatNumber(ret.amount)} ر.س</td>
        <td colspan="6" class="text-muted text-sm">تخفيض لوعاء الفاتورة وصافيها</td>
      </tr>
    `).join('');

    // Settlements under invoice
    const settlementsHtml = (inv.settlements || []).map(st => {
      let badgeClass = 'badge-eligible';
      let badgeText = 'مؤهل للخصم (ضمن المهلة)';
      if (!st.is_eligible && !st.is_exception_applied) {
        badgeClass = 'badge-late';
        badgeText = `تجاوز المهلة (${st.diff_days} يوم)`;
      } else if (st.is_exception_applied) {
        badgeClass = 'badge-exception';
        badgeText = 'استثناء إداري معتمد';
      }

      return `
        <tr class="sub-row settlement-row">
          <td colspan="2" class="sub-title">
            <span class="sub-icon">↳</span>
            سداد مرتبط (FIFO): سند رقم <strong>${st.payment_trans_id}</strong>
          </td>
          <td class="text-center">${formatDate(st.payment_date)}</td>
          <td colspan="2" class="text-success font-bold">+${formatNumber(st.amount_applied)} ر.س</td>
          <td class="text-center">${st.grace_days} يوم</td>
          <td class="text-center">${st.diff_days} يوم</td>
          <td class="text-center font-bold text-rebate">+${formatNumber(st.discount_earned)} ر.س</td>
          <td colspan="2" class="text-center">
            <span class="badge ${badgeClass}">${badgeText}</span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <tbody class="invoice-group">
        <tr class="main-invoice-row ${index % 2 === 1 ? 'row-alt' : ''}">
          <td class="text-center font-bold">${inv.accounting_trans_id}</td>
          <td class="text-center">${formatDate(inv.invoice_date)}</td>
          <td class="text-left font-bold">${formatNumber(inv.gross_amount)}</td>
          <td class="text-left ${inv.total_returns > 0 ? 'text-danger font-bold' : 'text-muted'}">
            ${inv.total_returns > 0 ? `-${formatNumber(inv.total_returns)}` : '-'}
          </td>
          <td class="text-left font-bold text-spruce">${formatNumber(inv.net_total)}</td>
          <td class="text-center">${inv.grace_days} يوم</td>
          <td class="text-center font-bold">${(Number(inv.discount_rate) * 100).toFixed(1)}%</td>
          <td class="text-left font-bold text-rebate">
            ${inv.earned_discount > 0 ? `+${formatNumber(inv.earned_discount)}` : '0.00'}
          </td>
          <td class="text-left font-bold ${inv.remaining_unpaid > 0 ? 'text-warning' : 'text-muted'}">
            ${formatNumber(inv.remaining_unpaid)}
          </td>
          <td class="text-center">
            <span class="status-pill ${statusClass}">${statusText}</span>
          </td>
        </tr>
        ${returnsHtml}
        ${settlementsHtml}
      </tbody>
    `;
  }).join('');

  // Unallocated cash notice
  let unallocatedHtml = '';
  if (unallocatedCash > 0.01) {
    unallocatedHtml = `
      <div class="unallocated-box">
        <div class="unallocated-title">★ رصيد دائن فائض (سدادات مقدمة غير مستهلكة):</div>
        <div class="unallocated-desc">
          يوجد رصيد نقدي مدفوع مقدماً بقيمة <strong>${formatNumber(unallocatedCash)} ر.س</strong> فائض عن الفواتير الحالية، ومتاح لتغطية أي فواتير مستقبلية مع الاستفادة التلقائية من شروط الخصم المعتمدة.
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب وتدقيق خصم تعجيل الدفع - ${customer.name}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .statement-wrapper {
      width: 100%;
      max-width: 100%;
      padding: 4px;
    }

    /* Header styling */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0E2F33;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 900;
      color: #0E2F33;
      margin: 0 0 3px 0;
    }
    .company-sub {
      font-size: 10.5px;
      color: #1D5459;
      margin: 0;
    }
    .doc-meta {
      text-align: left;
      font-size: 10px;
      color: #475569;
      line-height: 1.5;
    }

    /* Document Title Banner */
    .doc-banner {
      background: #0E2F33;
      color: #E6D6B8;
      border-right: 5px solid #B08B4F;
      padding: 8px 14px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .doc-banner h1 {
      font-size: 14px;
      margin: 0;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .doc-banner .badge-gold {
      background: #B08B4F;
      color: #0E2F33;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 9.5px;
      font-weight: bold;
    }

    /* Customer Details Card */
    .customer-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }
    .customer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 8px 16px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 9px;
      color: #64748B;
      margin-bottom: 2px;
      font-weight: 600;
    }
    .info-value {
      font-size: 11.5px;
      color: #0E2F33;
      font-weight: 800;
    }

    /* KPI Summary Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .kpi-box {
      border: 1px solid #E2E8F0;
      border-radius: 5px;
      padding: 7px 6px;
      text-align: center;
      background: #FFFFFF;
    }
    .kpi-box.highlight-gold {
      background: #FAF8F5;
      border-color: #B08B4F;
    }
    .kpi-box.highlight-spruce {
      background: #F0FDF4;
      border-color: #7FA3A0;
    }
    .kpi-box.highlight-due {
      background: #FEF2F2;
      border-color: #F87171;
    }
    .kpi-label {
      font-size: 8.5px;
      color: #64748B;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .kpi-val {
      font-size: 12px;
      font-weight: 900;
      color: #0E2F33;
    }
    .kpi-val.gold {
      color: #B08B4F;
    }
    .kpi-val.green {
      color: #059669;
    }
    .kpi-val.danger {
      color: #DC2626;
    }

    /* Ledger Table */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .ledger-table thead th {
      background: #0E2F33;
      color: #FFFFFF;
      padding: 7px 5px;
      font-weight: 700;
      font-size: 9.5px;
      border: 1px solid #0E2F33;
      text-align: center;
    }
    .ledger-table tbody.invoice-group {
      page-break-inside: avoid;
    }
    .main-invoice-row td {
      padding: 7px 5px;
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
    }
    .main-invoice-row.row-alt td {
      background: #F8FAFC;
    }
    .sub-row td {
      padding: 4px 6px;
      border: 1px solid #E2E8F0;
      font-size: 9px;
    }
    .return-row {
      background: #FFF5F5 !important;
    }
    .settlement-row {
      background: #F0FDF4 !important;
    }
    .sub-title {
      padding-right: 18px !important;
      color: #334155;
    }
    .sub-icon {
      font-weight: bold;
      margin-left: 4px;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 1.5px 5px;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: 700;
    }
    .badge-eligible {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #86EFAC;
    }
    .badge-late {
      background: #FEE2E2;
      color: #991B1B;
      border: 1px solid #FCA5A5;
    }
    .badge-exception {
      background: #DBEAFE;
      color: #1E40AF;
      border: 1px solid #93C5FD;
    }

    .status-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
    }
    .status-paid {
      background: #DCFCE7;
      color: #15803D;
    }
    .status-partial {
      background: #FEF3C7;
      color: #B45309;
    }
    .status-unpaid {
      background: #F1F5F9;
      color: #475569;
    }

    /* Helper styles */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .text-danger { color: #DC2626; }
    .text-success { color: #16A34A; }
    .text-warning { color: #D97706; }
    .text-spruce { color: #0E2F33; }
    .text-rebate { color: #B08B4F; font-weight: 800; }
    .text-muted { color: #94A3B8; }
    .text-sm { font-size: 8.5px; }

    /* Unallocated box */
    .unallocated-box {
      background: #EFF6FF;
      border: 1px dashed #3B82F6;
      border-radius: 5px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 10px;
    }
    .unallocated-title {
      font-weight: 800;
      color: #1D4ED8;
      margin-bottom: 2px;
    }
    .unallocated-desc {
      color: #334155;
    }

    /* Signatures Section */
    .signatures-section {
      page-break-inside: avoid;
      margin-top: 20px;
      border-top: 1px solid #CBD5E1;
      padding-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      text-align: center;
    }
    .sig-box {
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 8px;
      background: #FAFAFA;
      min-height: 70px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-title {
      font-size: 9.5px;
      font-weight: 800;
      color: #1E293B;
    }
    .sig-dots {
      color: #94A3B8;
      font-size: 8px;
      letter-spacing: 2px;
      margin-top: 30px;
    }

    /* Print Footer */
    .doc-footer {
      margin-top: 15px;
      text-align: center;
      font-size: 8.5px;
      color: #94A3B8;
      border-top: 1px solid #F1F5F9;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="statement-wrapper">
    <!-- Header -->
    <header class="company-header">
      <div>
        <h1 class="company-title">${companyName}</h1>
        <p class="company-sub">نظام إدارة ومطابقة خصم تعجيل الدفع المجمع (Rebate Cash Management)</p>
      </div>
      <div class="doc-meta">
        <div><strong>تاريخ الاستخراج:</strong> ${currentDate}</div>
        <div><strong>وقت الطباعة:</strong> ${printTime}</div>
        <div><strong>نظام التسوية:</strong> FIFO الصارم</div>
      </div>
    </header>

    <!-- Banner -->
    <div class="doc-banner">
      <h1>كشف حساب تحليلي وتدقيق رصيد الخصم المجمع</h1>
      <span class="badge-gold">وثيقة محاسبية رسمية</span>
    </div>

    <!-- Customer Card -->
    <section class="customer-card">
      <div class="customer-grid">
        <div class="info-item">
          <span class="info-label">اسم العميل والمنشأة:</span>
          <span class="info-value">${customer.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">الرقم المحاسبي الموحد:</span>
          <span class="info-value">${customer.accounting_system_id}</span>
        </div>
        <div class="info-item">
          <span class="info-label">هاتف / جوال التواصل:</span>
          <span class="info-value">${customer.phone || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">البريد الإلكتروني للإشعارات:</span>
          <span class="info-value">${customer.email || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">مهلة السماح الافتراضية:</span>
          <span class="info-value">${customer.default_grace_days || 30} يوماً</span>
        </div>
        <div class="info-item">
          <span class="info-label">نسبة الخصم المعتمدة:</span>
          <span class="info-value">${((Number(customer.default_discount_rate) || 0.07) * 100).toFixed(1)}%</span>
        </div>
      </div>
    </section>

    <!-- Financial KPI Summary -->
    <section class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">إجمالي المبيعات (أصل)</div>
        <div class="kpi-val">${formatNumber(totalGrossSales)} ر.س</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">إجمالي المرتجعات</div>
        <div class="kpi-val danger">-${formatNumber(totalReturns)} ر.س</div>
      </div>
      <div class="kpi-box highlight-spruce">
        <div class="kpi-label">صافي المبيعات الفعلي</div>
        <div class="kpi-val">${formatNumber(totalNetSales)} ر.س</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">إجمالي السدادات المستلمة</div>
        <div class="kpi-val green">${formatNumber(totalPayments)} ر.س</div>
      </div>
      <div class="kpi-box highlight-gold">
        <div class="kpi-label">رصيد الخصم المجمع المعتمد</div>
        <div class="kpi-val gold">${formatNumber(totalRebateEarned)} ر.س</div>
      </div>
      <div class="kpi-box ${customerBalance > 0 ? 'highlight-due' : 'highlight-spruce'}">
        <div class="kpi-label">${customerBalance > 0 ? 'المتبقي بذمة العميل' : 'رصيد دائن فائض للعميل'}</div>
        <div class="kpi-val ${customerBalance > 0 ? 'danger' : 'green'}">
          ${formatNumber(Math.abs(customerBalance))} ر.س
        </div>
      </div>
    </section>

    <!-- Table -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th style="width: 10%;">رقم الفاتورة</th>
          <th style="width: 10%;">التاريخ</th>
          <th style="width: 11%;">أصل الفاتورة</th>
          <th style="width: 10%;">المرتجعات</th>
          <th style="width: 11%;">الصافي</th>
          <th style="width: 8%;">المهلة</th>
          <th style="width: 8%;">النسبة</th>
          <th style="width: 11%;">الخصم المكتسب</th>
          <th style="width: 11%;">المتبقي</th>
          <th style="width: 10%;">الحالة</th>
        </tr>
      </thead>
      ${invoiceRowsHtml}
    </table>

    ${unallocatedHtml}

    <!-- Official Signatures -->
    <div class="signatures-section">
      <div class="sig-box">
        <span class="sig-title">إعداد وتدقيق المحاسب المالي</span>
        <span class="sig-dots">........................................</span>
      </div>
      <div class="sig-box">
        <span class="sig-title">المراجعة والرقابة المالية</span>
        <span class="sig-dots">........................................</span>
      </div>
      <div class="sig-box">
        <span class="sig-title">اعتماد الإدارة / الختم الرسمي</span>
        <span class="sig-dots">[ ختم المنشأة المعتمد ]</span>
      </div>
    </div>

    <!-- Footer -->
    <footer class="doc-footer">
      تم استخراج وتوليد هذا الكشف آلياً بواسطة نظام إدارة خصم تعجيل الدفع المجمع • الحسابات مبنية على أسلوب FIFO الصارم وإعادة التشغيل اللحظي للعمليات
    </footer>
  </div>
</body>
</html>`;
}

module.exports = {
  generateStatementHtml,
  formatNumber,
  formatDate
};
