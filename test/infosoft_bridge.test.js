const { test, describe } = require('node:test');
const assert = require('node:assert');
const { InfosoftBridge, infosoftService } = require('../src/services/infosoftBridge');

describe('InfoSoft 3-Category Classification Engine', () => {
  const bridge = new InfosoftBridge();

  test('Correctly classifies Category 1 (لا تشمل الخصم) with spelling variations and typos', () => {
    const testCases = [
      'لا تشمل الخصم السنوي',
      'لاتشمل الخصم السنوي',
      'لاتشمل الخصم',
      'لا تشمل خصم سنوي عرض',
      'هذا الفاتوره لا تشمل الخصم السنوي الدمام عرض',
      'الدمام لايشمل الخصم',
      'لايشمل الخصم السنوي هذا الفاتوره',
      'لا تشمل الخصم الستوي عرض', // typo الستوي
      'غير شامل الخصم',
      'المستودع لاتشمل اي خصم',
      'سعر عروض لا تشمل خصم سنوي'
    ];

    for (const text of testCases) {
      const result = bridge.classifyInvoiceDescription(text);
      assert.strictEqual(
        result.categoryId, 
        1, 
        `Expected Category 1 for text: "${text}", got Category ${result.categoryId}`
      );
      assert.strictEqual(result.categoryKey, 'NO_DISCOUNT');
    }
  });

  test('Correctly classifies Category 2 (مخفض) with spelling variations and typos', () => {
    const testCases = [
      'مخفض',
      'مخفضه',
      'مخفضة',
      'مخرج14 مخفظ', // typo with ظ
      'مخرج6مخفظ',
      'مخفص', // typo with ص
      'محفض', // typo with ح and ض
      'محفظ', // typo with ح and ظ
      'محفص', // typo with ح and ص
      'العزيزيه مخفظ',
      'الدمام مخفظ',
      'فاتورة مخفظ',
      'سلمان الفارسي مخفظ',
      'شبراء مخفظ',
      'مخفض  -  فرع تبوك',
      'مخفض    -  فرع صاري',
      'تخفيض خاص للعميل',
      'تخفيضات موسمية'
    ];

    for (const text of testCases) {
      const result = bridge.classifyInvoiceDescription(text);
      assert.strictEqual(
        result.categoryId, 
        2, 
        `Expected Category 2 for text: "${text}", got Category ${result.categoryId}`
      );
      assert.strictEqual(result.categoryKey, 'REDUCED');
    }
  });

  test('Correctly classifies Category 3 (عام / خاضع للخصم الأساسي)', () => {
    const testCases = [
      'فاتورة مبيعات آجــــــلة',
      'فاتورة مبيعات آجــــــلة مبيعات فرع الرياض',
      'فاتورة مبيعات نـقـــدية',
      'مخرج14',
      'العزيزية',
      'الدمام',
      'مبيعات المركز الرئيسي',
      '',
      null,
      undefined
    ];

    for (const text of testCases) {
      const result = bridge.classifyInvoiceDescription(text);
      assert.strictEqual(
        result.categoryId, 
        3, 
        `Expected Category 3 for text: "${text}", got Category ${result.categoryId}`
      );
      assert.strictEqual(result.categoryKey, 'GENERAL');
    }
  });
});

describe('InfoSoft Live Data & Statement Generation', async () => {
  let isDbAvailable = false;
  try {
    const status = await infosoftService.testConnection();
    isDbAvailable = Boolean(status && status.success);
  } catch {
    isDbAvailable = false;
  }

  test('Generates statement for Customer 85 with 3 categories and correct structure', { skip: !isDbAvailable ? 'Requires local InfoSoft SQL Server' : false }, async () => {
    const statement = await infosoftService.generateCustomerStatement('85', {
      cat1_discount_rate: 0.00,
      cat2_discount_rate: 0.03,
      cat3_discount_rate: 0.07,
      email: 'test@customer85.com'
    });

    assert.ok(statement.customer);
    assert.strictEqual(statement.customer.accounting_system_id, '85');
    assert.strictEqual(statement.customer.email, 'test@customer85.com');
    assert.strictEqual(statement.customer.cat1_discount_rate, 0.00);
    assert.strictEqual(statement.customer.cat2_discount_rate, 0.03);
    assert.strictEqual(statement.customer.cat3_discount_rate, 0.07);

    assert.strictEqual(statement.categoriesSummary.length, 3);
    assert.strictEqual(statement.categoriesSummary[0].id, 1);
    assert.strictEqual(statement.categoriesSummary[1].id, 2);
    assert.strictEqual(statement.categoriesSummary[2].id, 3);

    assert.ok(statement.totals.totalInvoicesCount > 0);
    assert.ok(statement.totals.totalReturnsCount > 0);
    assert.ok(statement.totals.totalNetSalesBeforeVat > 0);
    assert.ok(statement.totals.totalEarnedDiscount > 0);
  });

  test('Links cross-year returns from dbc01y25 correctly for Customer 1', { skip: !isDbAvailable ? 'Requires local InfoSoft SQL Server' : false }, async () => {
    const returns = await infosoftService.getCustomerReturns('1');
    const return2025 = returns.find(r => r.linked_invoice_year === '2025');
    assert.ok(return2025, 'Should have found at least one return linked to 2025');
    assert.strictEqual(return2025.linked_invoice_ref, 101);
    assert.strictEqual(return2025.category_id, 1); // 101 was "لاتشمل الخصم السنوي"
  });
});
