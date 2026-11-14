/**
 * InfoSoft SQL Server Bridge Service
 * Handles direct connection to InfoSoft ERP databases (dbc01y26, dbc01y25, etc.)
 * Provides 3-category classification with typo resilience, cross-year return linking,
 * and comprehensive Customer Statement of Account generation.
 */

const { execFile } = require('child_process');

class InfosoftBridge {
  constructor(config = {}) {
    this.server = config.server || 'localhost,49916';
    this.fallbackServer = config.fallbackServer || '(localdb)\\MSSQLLocalDB';
    this.currentYearDb = config.currentYearDb || 'dbc01y26';
    this.prevYearDb = config.prevYearDb || 'dbc01y25';
    this.port = config.port || 49916;
    this.company = config.company || null; // e.g. '01', '02', or null for all
    this.activeWorkingServer = null;
  }

  /**
   * Normalizes Arabic text for bulletproof keyword matching
   * Strips tashkeel, tatweel, normalizes hamzas, ta marbuta, and alef maqsura
   */
  normalizeArabicText(text) {
    if (!text) return '';
    return String(text)
      .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel (fatha, damma, etc.)
      .replace(/[أإآٱ]/g, 'ا')              // normalize hamzas to bare alef
      .replace(/ة/g, 'ه')                   // normalize ta marbuta to ha
      .replace(/ى/g, 'ي')                   // normalize alef maqsura to ya
      .replace(/ـ/g, '')                    // strip tatweel / kashida
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ') // remove special chars
      .replace(/\s+/g, ' ')                 // collapse multiple spaces
      .trim();
  }

  /**
   * Classifies invoice or return description into 3 distinct categories:
   * 1. Category 1: لا تشمل الخصم (NO_DISCOUNT)
   * 2. Category 2: مخفض (REDUCED)
   * 3. Category 3: عام / خاضع للخصم الأساسي (GENERAL)
   * 
   * Includes safeguards for common spelling errors in actual ERP entries:
   * - "مخفظ" (with ظ instead of ض)
   * - "الستوي" (typo for السنوي as in "لا تشمل الخصم الستوي")
   * - "لا يشمل" / "لايشمل" / "لا تشمل" / "لاتشمل"
   * - "غير شامل" / "غير مشمول" / "بدون خصم"
   */
  classifyInvoiceDescription(rawText) {
    const normalized = this.normalizeArabicText(rawText);
    if (!normalized) {
      return {
        categoryId: 3,
        categoryKey: 'GENERAL',
        categoryName: '3. عام (خاضع للخصم)',
        matchedRule: 'افتراضي (بدون وصف)',
        originalText: rawText || ''
      };
    }

    // Category 1 Pattern: لا تشمل الخصم
    // Matches: لا تشمل, لاتشمل, لا يشمل, لايشمل, غير شامل, غير مشمول, دون خصم, بدون خصم, الستوي
    const cat1Pattern = /(?:لا\s*[تي]?شمل|غير\s*(?:شامل|مشمول)|دون\s*خصم|بدون\s*خصم|الستوي)/i;
    if (cat1Pattern.test(normalized)) {
      return {
        categoryId: 1,
        categoryKey: 'NO_DISCOUNT',
        categoryName: '1. لا تشمل الخصم',
        matchedRule: 'لا تشمل / لا يشمل الخصم',
        originalText: rawText
      };
    }

    // Category 2 Pattern: مخفض
    // Matches: مخفض, مخفضه, مخفضة, مخفظ, مخفظه, مخفظة, مخفص, محفض, محفظ, محفص, تخفيض, تخفيضات, تنزيلات
    // Note: Location phrases like "مخرج 14" without discount terms remain in Category 3 (General)
    const cat2Pattern = /(?:[خح]ف[ضظص][هة]?|تخفيض(?:ات)?|تنزيل(?:ات)?)/i;
    if (cat2Pattern.test(normalized)) {
      return {
        categoryId: 2,
        categoryKey: 'REDUCED',
        categoryName: '2. مخفض',
        matchedRule: 'مخفض / مخفظ / مخفص / محفض / تخفيض',
        originalText: rawText
      };
    }

    // Category 3: كل ما هو غير ذلك
    return {
      categoryId: 3,
      categoryKey: 'GENERAL',
      categoryName: '3. عام (خاضع للخصم)',
      matchedRule: 'عام (خاضع للخصم الأساسي)',
      originalText: rawText
    };
  }

  /**
   * Executes a T-SQL query against SQL Server using PowerShell ADO.NET
   * Supports both TCP endpoint (localhost,49916) and direct LocalDB named pipe
   */
  async executeQuery(sqlText, targetDb = null) {
    const dbName = targetDb || this.currentYearDb;
    const serversToTry = this.activeWorkingServer 
      ? [this.activeWorkingServer] 
      : [this.server, this.fallbackServer];

    let lastError = null;

    for (const srv of serversToTry) {
      try {
        const result = await this._runPowerShellQuery(srv, dbName, sqlText);
        this.activeWorkingServer = srv; // Cache working connection
        return result;
      } catch (err) {
        lastError = err;
        // Continue to fallback server
      }
    }

    throw new Error(`فشل الاتصال بقاعدة بيانات إنفوسوفت (${serversToTry.join(' / ')}): ${lastError?.message}`);
  }

  _runPowerShellQuery(serverStr, dbName, sqlText) {
    return new Promise((resolve, reject) => {
      let connStr = '';
      if (serverStr.includes(',') || serverStr.includes(':') || serverStr.toLowerCase().includes('localdb')) {
        connStr = `Server=${serverStr};Database=${dbName};Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8;ApplicationIntent=ReadOnly;`;
      } else {
        connStr = `Server=${serverStr},${this.port};Database=${dbName};Integrated Security=True;TrustServerCertificate=True;Connect Timeout=8;ApplicationIntent=ReadOnly;`;
      }

      const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$connStr = '${connStr.replace(/'/g, "''")}'
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
try {
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 90
    $cmd.CommandText = @'
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
${sqlText}
'@
    $rdr = $cmd.ExecuteReader()
    $rows = [System.Collections.ArrayList]::new()
    while ($rdr.Read()) {
        $row = [ordered]@{}
        for ($i = 0; $i -lt $rdr.FieldCount; $i++) {
            $val = $rdr.GetValue($i)
            if ($val -eq [System.DBNull]::Value) { $val = $null }
            elseif ($val -is [System.String]) { $val = $val.Trim() }
            $row[$rdr.GetName($i)] = $val
        }
        [void]$rows.Add($row)
    }
    $rdr.Close()
    if ($rows.Count -eq 0) {
        Write-Output "[]"
    } else {
        $rows | ConvertTo-Json -Depth 3 -Compress
    }
} finally {
    if ($conn.State -eq 'Open') { $conn.Close() }
}
`;

      execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
        maxBuffer: 60 * 1024 * 1024,
        encoding: 'utf8'
      }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        try {
          const trimmed = stdout.trim();
          if (!trimmed) return resolve([]);
          const parsed = JSON.parse(trimmed);
          resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (parseErr) {
          reject(new Error(`Failed to parse SQL output: ${parseErr.message}\nRaw: ${stdout.slice(0, 300)}`));
        }
      });
    });
  }

  /**
   * Tests the connection to SQL Server and returns available databases
   */
  async testConnection() {
    try {
      const rows = await this.executeQuery("SELECT name FROM sys.databases WHERE name LIKE 'dbc%' OR name = 'sysdb'");
      const dbs = rows.map(r => r.name);
      return {
        success: true,
        activeServer: this.activeWorkingServer || this.server,
        databases: dbs,
        hasCurrentYear: dbs.includes(this.currentYearDb),
        hasPrevYear: dbs.includes(this.prevYearDb)
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Retrieves all customers from InfoSoft with balances and contact info
   */
  async getAllCustomers() {
    let companyFilter = '';
    if (this.company) {
      companyFilter = `WHERE cu_company = '${this.company}'`;
    }

    const query = `
      SELECT 
        RTRIM(cu_code) as accounting_system_id,
        RTRIM(cu_name) as name,
        RTRIM(ISNULL(CU_EMAIL, '')) as email,
        RTRIM(ISNULL(cu_mobile, ISNULL(cu_tel, ''))) as phone,
        ISNULL(cu_opnbal, 0) as opening_balance,
        ISNULL(cu_curbal, 0) as stored_current_balance,
        RTRIM(ISNULL(cu_class, '')) as class_code,
        RTRIM(ISNULL(slcode, '')) as salesman_code,
        cu_company as company
      FROM ${this.currentYearDb}.dbo.customer WITH (NOLOCK)
      ${companyFilter}
      ORDER BY cu_curbal DESC, name ASC
    `;

    return await this.executeQuery(query);
  }

  /**
   * Fetches sales invoices for a customer (invtype '04': credit sales, '06': cash sales)
   * Automatically classifies each invoice into the 3 categories based on custnm / remarks2
   */
  async getCustomerInvoices(custCode, options = {}) {
    const trimmedCust = String(custCode).trim();
    const fromDate = options.fromDate ? `AND invdate >= '${options.fromDate.replace(/-/g, '')}'` : '';
    const toDate = options.toDate ? `AND invdate <= '${options.toDate.replace(/-/g, '')}'` : '';
    const companyFilter = this.company ? `AND company = '${this.company}'` : '';

    const query = `
      SELECT 
        ref as invoice_ref,
        invtype,
        CASE WHEN invtype = '04' THEN N'مبيعات آجلة' ELSE N'مبيعات نقدية' END as invtype_name,
        invdate,
        ISNULL(duedate, invdate) as duedate,
        RTRIM(custno) as custno,
        RTRIM(ISNULL(custnm, '')) as custnm,
        RTRIM(ISNULL(remarks2, '')) as remarks2,
        ISNULL(valafds, 0) as net_amount_before_vat,
        ISNULL(vat_amt_rcvd, 0) as vat_amount,
        (ISNULL(valafds, 0) + ISNULL(vat_amt_rcvd, 0)) as total_amount_with_vat,
        ISNULL(invttl, 0) as gross_amount,
        ISNULL(invdsvl, 0) as invoice_discount,
        slcenter,
        branch,
        company
      FROM ${this.currentYearDb}.dbo.sales_hd WITH (NOLOCK)
      WHERE custno = '${trimmedCust}'
        AND invtype IN ('04', '06')
        AND ISNULL(suspend, 0) = 0
        ${companyFilter}
        ${fromDate}
        ${toDate}
      ORDER BY invdate ASC, ref ASC
    `;

    const rows = await this.executeQuery(query);

    return rows.map(inv => {
      // Determine description field (custnm is primary in InfoSoft, remarks2 is secondary)
      const desc = inv.custnm || inv.remarks2 || '';
      const classification = this.classifyInvoiceDescription(desc);

      return {
        ...inv,
        invoice_date_formatted: this._formatDate(inv.invdate),
        due_date_formatted: this._formatDate(inv.duedate),
        description: desc,
        category_id: classification.categoryId,
        category_key: classification.categoryKey,
        category_name: classification.categoryName,
        classification_rule: classification.matchedRule
      };
    });
  }

  /**
   * Fetches customer sales returns (invtype '24', '26')
   * Links returns to original invoices in current year or PREVIOUS YEAR (dbc01y25)
   * to determine the exact category the return was deducted from.
   */
  async getCustomerReturns(custCode, options = {}) {
    const trimmedCust = String(custCode).trim();
    const fromDate = options.fromDate ? `AND r.invdate >= '${options.fromDate.replace(/-/g, '')}'` : '';
    const toDate = options.toDate ? `AND r.invdate <= '${options.toDate.replace(/-/g, '')}'` : '';
    const companyFilter = this.company ? `AND r.company = '${this.company}'` : '';

    // Query returns joined with current year invoices and previous year invoices
    const query = `
      SELECT 
        r.ref as return_ref,
        r.invtype,
        CASE WHEN r.invtype = '24' THEN N'مرتجع آجل' ELSE N'مرتجع نقدي' END as return_type_name,
        r.invdate as return_date,
        RTRIM(r.custno) as custno,
        RTRIM(ISNULL(r.custnm, '')) as return_custnm,
        RTRIM(ISNULL(r.remarks2, '')) as return_remarks2,
        ISNULL(r.valafds, 0) as return_net_before_vat,
        ISNULL(r.vat_amt_rcvd, 0) as return_vat,
        (ISNULL(r.valafds, 0) + ISNULL(r.vat_amt_rcvd, 0)) as return_total_with_vat,
        ISNULL(r.rtnref, 0) as rtnref,
        
        -- Current Year Invoice match
        inv26.ref as inv26_ref,
        inv26.invdate as inv26_date,
        RTRIM(ISNULL(inv26.custnm, '')) as inv26_custnm,
        RTRIM(ISNULL(inv26.remarks2, '')) as inv26_remarks2,

        -- Previous Year Invoice match
        inv25.ref as inv25_ref,
        inv25.invdate as inv25_date,
        RTRIM(ISNULL(inv25.custnm, '')) as inv25_custnm,
        RTRIM(ISNULL(inv25.remarks2, '')) as inv25_remarks2,

        r.slcenter,
        r.branch,
        r.company
      FROM ${this.currentYearDb}.dbo.sales_hd r WITH (NOLOCK)
      LEFT JOIN ${this.currentYearDb}.dbo.sales_hd inv26 WITH (NOLOCK)
        ON inv26.company = r.company AND inv26.invtype IN ('04','06') AND inv26.ref = r.rtnref AND inv26.custno = r.custno
      LEFT JOIN ${this.prevYearDb}.dbo.sales_hd inv25 WITH (NOLOCK)
        ON inv25.company = r.company AND inv25.invtype IN ('04','06') AND inv25.ref = r.rtnref AND inv25.custno = r.custno
      WHERE r.custno = '${trimmedCust}'
        AND r.invtype IN ('24', '26')
        AND ISNULL(r.suspend, 0) = 0
        ${companyFilter}
        ${fromDate}
        ${toDate}
      ORDER BY r.invdate ASC, r.ref ASC
    `;

    const rows = await this.executeQuery(query);

    return rows.map(ret => {
      let linkedInvoiceRef = null;
      let linkedInvoiceYear = null;
      let linkedInvoiceDesc = '';
      let targetDescForClassification = '';

      // 1. Check if matched in current year (dbc01y26)
      if (ret.inv26_ref) {
        linkedInvoiceRef = ret.inv26_ref;
        linkedInvoiceYear = '2026';
        linkedInvoiceDesc = ret.inv26_custnm || ret.inv26_remarks2 || '';
        targetDescForClassification = linkedInvoiceDesc;
      }
      // 2. Check if matched in previous year (dbc01y25)
      else if (ret.inv25_ref) {
        linkedInvoiceRef = ret.inv25_ref;
        linkedInvoiceYear = '2025';
        linkedInvoiceDesc = ret.inv25_custnm || ret.inv25_remarks2 || '';
        targetDescForClassification = linkedInvoiceDesc;
      }
      // 3. If rtnref was missing or 0, attempt regex extraction from return's own custnm
      else {
        const text = ret.return_custnm || ret.return_remarks2 || '';
        const match = text.match(/(?:من\s+ف(?:اتور[ةه])?\s*(?:رقم)?\s*|ف\s*)(\d+)/i);
        if (match) {
          linkedInvoiceRef = match[1];
          linkedInvoiceYear = 'UNKNOWN';
        }
        // Fallback to the return's own description for classification
        targetDescForClassification = text;
      }

      // Classify the return based on the linked original invoice's description
      const classification = this.classifyInvoiceDescription(targetDescForClassification);

      return {
        return_ref: ret.return_ref,
        invtype: ret.invtype,
        return_type_name: ret.return_type_name,
        return_date: ret.return_date,
        return_date_formatted: this._formatDate(ret.return_date),
        custno: ret.custno,
        return_desc: ret.return_custnm || ret.return_remarks2 || '',
        return_net_before_vat: Number(ret.return_net_before_vat) || 0,
        return_vat: Number(ret.return_vat) || 0,
        return_total_with_vat: Number(ret.return_total_with_vat) || 0,
        rtnref: ret.rtnref,
        linked_invoice_ref: linkedInvoiceRef,
        linked_invoice_year: linkedInvoiceYear,
        linked_invoice_desc: linkedInvoiceDesc,
        category_id: classification.categoryId,
        category_key: classification.categoryKey,
        category_name: classification.categoryName,
        classification_rule: classification.matchedRule,
        company: ret.company
      };
    });
  }

  /**
   * Fetches customer payment receipts from AR ledger (arhdr / ardtl)
   * hd_type: '02' (سند قبض نقدي), '28' (حوالة بنكية), '09' (شيكات), '21' (إشعار دائن)
   */
  async getCustomerPayments(custCode, options = {}) {
    const trimmedCust = String(custCode).trim();
    const fromDate = options.fromDate ? `AND d.dt_date >= '${options.fromDate.replace(/-/g, '')}'` : '';
    const toDate = options.toDate ? `AND d.dt_date <= '${options.toDate.replace(/-/g, '')}'` : '';
    const companyFilter = this.company ? `AND d.dt_company = '${this.company}'` : '';

    const query = `
      SELECT 
        d.dt_ref as payment_ref,
        d.dt_type as payment_type,
        CASE 
          WHEN d.dt_type = '02' THEN N'سند قبض نقدي'
          WHEN d.dt_type = '28' THEN N'حوالة بنكية واردة'
          WHEN d.dt_type = '09' THEN N'سند قبض شيكات'
          WHEN d.dt_type = '21' THEN N'إشعار إضافة / دائن'
          ELSE N'دفعة / سداد'
        END as payment_type_name,
        d.dt_date as payment_date,
        RTRIM(d.dt_cucode) as custno,
        ISNULL(d.dt_lcamt, 0) as amount,
        ISNULL(d.dt_paidamt, 0) as allocated_amount,
        RTRIM(ISNULL(d.dt_chkno, '')) as cheque_no,
        RTRIM(ISNULL(d.dt_chkbnk, '')) as bank_name,
        d.dt_company as company
      FROM ${this.currentYearDb}.dbo.ardtl d WITH (NOLOCK)
      INNER JOIN ${this.currentYearDb}.dbo.arhdr h WITH (NOLOCK)
        ON h.hd_company = d.dt_company AND h.hd_type = d.dt_type AND h.hd_ref = d.dt_ref
      WHERE d.dt_cucode = '${trimmedCust}'
        AND d.dt_dbcr = 'C'
        AND d.dt_type IN ('02', '28', '09', '21')
        ${companyFilter}
        ${fromDate}
        ${toDate}
      ORDER BY d.dt_date ASC, d.dt_ref ASC
    `;

    const rows = await this.executeQuery(query);
    return rows.map(p => ({
      ...p,
      payment_date_formatted: this._formatDate(p.payment_date),
      amount: Number(p.amount) || 0
    }));
  }

  /**
   * Generates a complete Customer Statement of Account with 3-category breakdown
   * and calculation of earned rebates according to custom category discount rates.
   */
  async generateCustomerStatement(custCode, customConfig = {}) {
    const trimmedCust = String(custCode).trim();

    // 1. Fetch customer details
    const customerList = await this.executeQuery(`
      SELECT 
        RTRIM(cu_code) as accounting_system_id,
        RTRIM(cu_name) as name,
        RTRIM(ISNULL(CU_EMAIL, '')) as email,
        RTRIM(ISNULL(cu_mobile, ISNULL(cu_tel, ''))) as phone,
        ISNULL(cu_opnbal, 0) as opening_balance,
        ISNULL(cu_curbal, 0) as stored_current_balance,
        cu_company as company
      FROM ${this.currentYearDb}.dbo.customer WITH (NOLOCK)
      WHERE cu_code = '${trimmedCust}'
    `);

    const customer = customerList[0] || {
      accounting_system_id: trimmedCust,
      name: `عميل ${trimmedCust}`,
      email: '',
      phone: '',
      opening_balance: 0,
      stored_current_balance: 0
    };

    // Override with manual configs if provided (such as manual email, rates, grace days)
    const effectiveEmail = customConfig.email || customer.email || '';
    const cat1DiscountRate = customConfig.cat1_discount_rate !== undefined ? Number(customConfig.cat1_discount_rate) : 0.00; // default 0%
    const cat2DiscountRate = customConfig.cat2_discount_rate !== undefined ? Number(customConfig.cat2_discount_rate) : 0.03; // default 3%
    const cat3DiscountRate = customConfig.cat3_discount_rate !== undefined ? Number(customConfig.cat3_discount_rate) : 0.07; // default 7%
    const graceDays = customConfig.grace_days !== undefined ? Number(customConfig.grace_days) : 30;

    // 2. Fetch Invoices, Returns, and Payments
    const invoices = await this.getCustomerInvoices(trimmedCust);
    const returns = await this.getCustomerReturns(trimmedCust);
    const payments = await this.getCustomerPayments(trimmedCust);

    // 3. Build Category Aggregation Summary
    const categories = {
      cat1: {
        id: 1,
        key: 'NO_DISCOUNT',
        name: '1. لا تشمل الخصم',
        invoiceCount: 0,
        salesBeforeVat: 0,
        salesVat: 0,
        salesTotalWithVat: 0,
        returnCount: 0,
        returnsBeforeVat: 0,
        returnsVat: 0,
        returnsTotalWithVat: 0,
        netSalesBeforeVat: 0,
        discountRate: cat1DiscountRate,
        earnedDiscount: 0
      },
      cat2: {
        id: 2,
        key: 'REDUCED',
        name: '2. مخفض',
        invoiceCount: 0,
        salesBeforeVat: 0,
        salesVat: 0,
        salesTotalWithVat: 0,
        returnCount: 0,
        returnsBeforeVat: 0,
        returnsVat: 0,
        returnsTotalWithVat: 0,
        netSalesBeforeVat: 0,
        discountRate: cat2DiscountRate,
        earnedDiscount: 0
      },
      cat3: {
        id: 3,
        key: 'GENERAL',
        name: '3. عام (خاضع للخصم)',
        invoiceCount: 0,
        salesBeforeVat: 0,
        salesVat: 0,
        salesTotalWithVat: 0,
        returnCount: 0,
        returnsBeforeVat: 0,
        returnsVat: 0,
        returnsTotalWithVat: 0,
        netSalesBeforeVat: 0,
        discountRate: cat3DiscountRate,
        earnedDiscount: 0
      }
    };

    // Aggregate Invoices
    for (const inv of invoices) {
      const target = inv.category_id === 1 ? categories.cat1 : (inv.category_id === 2 ? categories.cat2 : categories.cat3);
      target.invoiceCount++;
      target.salesBeforeVat += Number(inv.net_amount_before_vat) || 0;
      target.salesVat += Number(inv.vat_amount) || 0;
      target.salesTotalWithVat += Number(inv.total_amount_with_vat) || 0;
    }

    // Aggregate Returns
    for (const ret of returns) {
      const target = ret.category_id === 1 ? categories.cat1 : (ret.category_id === 2 ? categories.cat2 : categories.cat3);
      target.returnCount++;
      target.returnsBeforeVat += Number(ret.return_net_before_vat) || 0;
      target.returnsVat += Number(ret.return_vat) || 0;
      target.returnsTotalWithVat += Number(ret.return_total_with_vat) || 0;
    }

    // Calculate Net and Earned Discounts per category
    let totalNetSalesBeforeVat = 0;
    let totalEarnedDiscount = 0;

    for (const key of ['cat1', 'cat2', 'cat3']) {
      const cat = categories[key];
      cat.netSalesBeforeVat = Math.max(0, cat.salesBeforeVat - cat.returnsBeforeVat);
      cat.earnedDiscount = Math.round((cat.netSalesBeforeVat * cat.discountRate) * 100) / 100;
      totalNetSalesBeforeVat += cat.netSalesBeforeVat;
      totalEarnedDiscount += cat.earnedDiscount;
    }

    // Totals
    const totals = {
      totalInvoicesCount: invoices.length,
      totalSalesBeforeVat: categories.cat1.salesBeforeVat + categories.cat2.salesBeforeVat + categories.cat3.salesBeforeVat,
      totalSalesVat: categories.cat1.salesVat + categories.cat2.salesVat + categories.cat3.salesVat,
      totalSalesWithVat: categories.cat1.salesTotalWithVat + categories.cat2.salesTotalWithVat + categories.cat3.salesTotalWithVat,
      totalReturnsCount: returns.length,
      totalReturnsBeforeVat: categories.cat1.returnsBeforeVat + categories.cat2.returnsBeforeVat + categories.cat3.returnsBeforeVat,
      totalReturnsVat: categories.cat1.returnsVat + categories.cat2.returnsVat + categories.cat3.returnsVat,
      totalReturnsWithVat: categories.cat1.returnsTotalWithVat + categories.cat2.returnsTotalWithVat + categories.cat3.returnsTotalWithVat,
      totalNetSalesBeforeVat,
      totalEarnedDiscount,
      totalPaymentsAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      openingBalance: Number(customer.opening_balance) || 0,
      storedCurrentBalance: Number(customer.stored_current_balance) || 0
    };

    return {
      customer: {
        ...customer,
        email: effectiveEmail,
        cat1_discount_rate: cat1DiscountRate,
        cat2_discount_rate: cat2DiscountRate,
        cat3_discount_rate: cat3DiscountRate,
        grace_days: graceDays
      },
      categoriesSummary: [
        categories.cat1,
        categories.cat2,
        categories.cat3
      ],
      totals,
      invoices,
      returns,
      payments,
      generatedAt: new Date().toISOString()
    };
  }

  _formatDate(rawDate) {
    if (!rawDate) return '';
    const str = String(rawDate).trim();
    if (str.length === 8 && /^\d{8}$/.test(str)) {
      return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }
    return str;
  }
}

module.exports = {
  InfosoftBridge,
  infosoftService: new InfosoftBridge()
};
