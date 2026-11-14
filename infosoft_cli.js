#!/usr/bin/env node
/**
 * InfoSoft ERP SQL Server Integration CLI
 * رابط القاعدة: localhost,49916 (أو localdb كبديل تلقائي)
 * يقوم بجلب كشف حساب العملاء، الفواتير، المرتجعات، وتصنيف الفئات الثلاث:
 * 1. فئة "لا تشمل الخصم" (مع مراعاة الأخطاء الإملائية مثل: لا تشمل، لاتشمل، لا يشمل، لايشمل، الستوي، غير شامل)
 * 2. فئة "مخفض" (مع مراعاة الأخطاء الإملائية مثل: مخفض، مخفظ، مخفضه، مخفظه، تخفيض)
 * 3. فئة "عام" (كل ما هو غير ذلك)
 * مع ربط المرتجعات بوصف الفواتير المرتبطة بها (بما فيها فواتير السنة السابقة dbc01y25).
 */

const { infosoftService } = require('./src/services/infosoftBridge');
const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`
========================================================================
     أداة الربط المباشر مع قاعدة بيانات إنفوسوفت (InfoSoft ERP CLI)
========================================================================
الاستخدام:
  node infosoft_cli.js --test
      فحص الاتصال بقاعدة البيانات وإظهار القواعد المتاحة

  node infosoft_cli.js --customers
      عرض قائمة العملاء وأرصدتهم من إنفوسوفت

  node infosoft_cli.js --statement <رقم_العميل> [--rate1 <0.0>] [--rate2 <0.03>] [--rate3 <0.07>]
      استخراج كشف حساب كامل للعميل مفصل بالفئات الثلاث ومربوط بالمرتجعات

  node infosoft_cli.js --export-json <رقم_العميل>
      تصدير كشف حساب العميل كملف JSON كامل
========================================================================
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (args.includes('--test')) {
    console.log('جاري فحص الاتصال بقاعدة بيانات إنفوسوفت على localhost,49916...');
    const res = await infosoftService.testConnection();
    console.log('\nنتيجة الفحص:', res);
    return;
  }

  if (args.includes('--customers')) {
    console.log('جاري جلب قائمة العملاء من قاعدة البيانات النشطة...');
    const customers = await infosoftService.getAllCustomers();
    console.log(`تم العثور على ${customers.length} عميل:\n`);
    console.table(customers.slice(0, 30).map(c => ({
      'رقم العميل': c.accounting_system_id,
      'اسم العميل': c.name,
      'الرصيد الدفتري': Number(c.stored_current_balance).toLocaleString() + ' ر.س',
      'الجوال': c.phone,
      'البريد': c.email
    })));
    return;
  }

  const stmtIdx = args.indexOf('--statement');
  const exportJsonIdx = args.indexOf('--export-json');

  if (stmtIdx !== -1 || exportJsonIdx !== -1) {
    const custId = stmtIdx !== -1 ? args[stmtIdx + 1] : args[exportJsonIdx + 1];
    if (!custId) {
      console.error('خطأ: يرجى تحديد رقم العميل (مثال: --statement 85)');
      return;
    }

    // Optional rates
    let rate1 = 0.00;
    let rate2 = 0.03;
    let rate3 = 0.07;
    const r1Idx = args.indexOf('--rate1');
    if (r1Idx !== -1) rate1 = parseFloat(args[r1Idx + 1]);
    const r2Idx = args.indexOf('--rate2');
    if (r2Idx !== -1) rate2 = parseFloat(args[r2Idx + 1]);
    const r3Idx = args.indexOf('--rate3');
    if (r3Idx !== -1) rate3 = parseFloat(args[r3Idx + 1]);

    console.log(`\nجاري استخراج وتدقيق كشف الحساب للعميل [${custId}] من قاعدة البيانات...`);
    const stmt = await infosoftService.generateCustomerStatement(custId, {
      cat1_discount_rate: rate1,
      cat2_discount_rate: rate2,
      cat3_discount_rate: rate3
    });

    if (exportJsonIdx !== -1) {
      const outPath = path.join(process.cwd(), `statement_cust_${custId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(stmt, null, 2), 'utf8');
      console.log(`\n[+] تم تصدير كشف الحساب كاملاً إلى:\n${outPath}`);
      return;
    }

    // Display formatted terminal statement
    console.log('\n========================================================================');
    console.log(`   كشف حساب وتدقيق خصم تعجيل الدفع المجمع: ${stmt.customer.name}`);
    console.log(`   الرقم المحاسبي: ${stmt.customer.accounting_system_id} | الجوال: ${stmt.customer.phone || 'غير مسجل'}`);
    console.log('========================================================================\n');

    console.log('--- جدول تصنيف فئات المبيعات وصافي الخصم المستحق ---');
    console.table(stmt.categoriesSummary.map(c => ({
      'فئة الخصم': c.name,
      'عدد الفواتير': c.invoiceCount,
      'إجمالي المبيعات': c.salesBeforeVat.toLocaleString() + ' ر.س',
      'عدد المرتجعات': c.returnCount,
      'إجمالي المرتجعات': c.returnsBeforeVat.toLocaleString() + ' ر.س',
      'صافي المبيعات': c.netSalesBeforeVat.toLocaleString() + ' ر.س',
      'معدل الخصم': `${(c.discountRate * 100).toFixed(1)}%`,
      'قيمة الخصم المكتسب': c.earnedDiscount.toLocaleString() + ' ر.س'
    })));

    console.log('\n--- ملخص المؤشرات الإجمالية ---');
    console.log(`إجمالي عدد الفواتير:        ${stmt.totals.totalInvoicesCount}`);
    console.log(`إجمالي المبيعات (قبل الضريبة): ${stmt.totals.totalSalesBeforeVat.toLocaleString()} ر.س`);
    console.log(`إجمالي عدد المرتجعات:       ${stmt.totals.totalReturnsCount}`);
    console.log(`إجمالي المرتجعات (قبل الضريبة):${stmt.totals.totalReturnsBeforeVat.toLocaleString()} ر.س`);
    console.log(`صافي المبيعات الفعلي:        ${stmt.totals.totalNetSalesBeforeVat.toLocaleString()} ر.س`);
    console.log(`إجمالي الخصم المكتسب المستحق: ${stmt.totals.totalEarnedDiscount.toLocaleString()} ر.س`);
    console.log(`إجمالي السدادات المقيدة بالذمم: ${stmt.totals.totalPaymentsAmount.toLocaleString()} ر.س`);
    console.log('========================================================================\n');

    // Sample invoices
    console.log('عينة من فواتير المبيعات المصنفة (أول 5 فواتير):');
    console.table(stmt.invoices.slice(0, 5).map(i => ({
      'رقم الفاتورة': i.invoice_ref,
      'التاريخ': i.invoice_date_formatted,
      'الوصف (custnm)': (i.description || '').slice(0, 35),
      'الفئة المصنفة': i.category_name,
      'المبلغ قبل الضريبة': i.net_amount_before_vat.toLocaleString() + ' ر.س'
    })));

    // Sample returns with linking details
    console.log('\nعينة من المرتجعات المربوطة بالفواتير الأصلية (أول 5 مرتجعات):');
    console.table(stmt.returns.slice(0, 5).map(r => ({
      'رقم المرتجع': r.return_ref,
      'التاريخ': r.return_date_formatted,
      'الفاتورة الأصلية': r.linked_invoice_ref || 'غير محدد',
      'سنة الفاتورة الأصلية': r.linked_invoice_year || 'الحالية',
      'وصف الفاتورة الأصلية': (r.linked_invoice_desc || r.return_desc || '').slice(0, 30),
      'الفئة المحسوم منها': r.category_name,
      'مبلغ المرتجع': r.return_net_before_vat.toLocaleString() + ' ر.س'
    })));
  }
}

main().catch(err => {
  console.error('\nحدث خطأ أثناء التنفيذ:', err.message);
  process.exit(1);
});
