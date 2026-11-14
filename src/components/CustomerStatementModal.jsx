import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Printer, RotateCw, ChevronDown, ChevronUp, Search, 
  Download, Tag, ShieldCheck, Sliders, Check, Layers, List
} from 'lucide-react';

const cleanRate = (rate, defaultVal = 0) => {
  if (rate === undefined || rate === null || isNaN(rate)) return defaultVal;
  return Math.round((Number(rate) * 100 + Number.EPSILON) * 100) / 100;
};

export default function CustomerStatementModal({ customerId, isOpen, onClose, onRefreshRequired, isReadOnly }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Set of invoice IDs that are currently slid open / expanded
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState(new Set());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PAID'

  // Settings & Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Editable customer terms
  const [custEmail, setCustEmail] = useState('');
  const [rate1, setRate1] = useState(0);
  const [rate2, setRate2] = useState(3);
  const [rate3, setRate3] = useState(7);
  const [graceDays, setGraceDays] = useState(30);

  // Modals for Actions
  const [exceptionInv, setExceptionInv] = useState(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [categoryModalInv, setCategoryModalInv] = useState(null);
  const [targetCat, setTargetCat] = useState(3);
  const [customCatRate, setCustomCatRate] = useState('');

  useEffect(() => {
    if (isOpen && customerId) {
      loadStatement(true);
    } else {
      setExpandedInvoiceIds(new Set());
      setShowSettingsDrawer(false);
    }
  }, [isOpen, customerId]);

  const loadStatement = async (autoSync = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.getCustomerStatement(customerId);
      setStatement(data);
      if (data?.customer) {
        setCustEmail(data.customer.email || '');
        setRate1(cleanRate(data.customer.cat1_discount_rate, 0));
        setRate2(cleanRate(data.customer.cat2_discount_rate, 3));
        setRate3(cleanRate(data.customer.cat3_discount_rate, cleanRate(data.customer.default_discount_rate, 7)));
        setGraceDays(data.customer.default_grace_days || 30);
      }
      setLoading(false);

      if (autoSync && data?.customer?.accounting_system_id) {
        syncFromInfosoftInternal(data.customer, true);
      }
    } catch (err) {
      setError(err.message || 'فشل في تحميل كشف الحساب.');
      setLoading(false);
    }
  };

  const syncFromInfosoftInternal = async (cust, silent = false) => {
    const accId = cust?.accounting_system_id || statement?.customer?.accounting_system_id;
    if (!accId) return;

    try {
      setIsSyncing(true);
      const emailVal = custEmail || cust?.email || '';
      const r1 = Math.round(parseFloat(rate1) * 100) / 10000;
      const r2 = Math.round(parseFloat(rate2) * 100) / 10000;
      const r3 = Math.round(parseFloat(rate3) * 100) / 10000;

      await window.api.infosoft.syncCustomer(accId, {
        email: emailVal.trim(),
        cat1_discount_rate: isNaN(r1) ? 0.00 : r1,
        cat2_discount_rate: isNaN(r2) ? 0.03 : r2,
        cat3_discount_rate: isNaN(r3) ? 0.07 : r3,
        grace_days: parseInt(graceDays, 10) || 30
      });

      const freshData = await window.api.getCustomerStatement(customerId);
      setStatement(freshData);
      if (onRefreshRequired) onRefreshRequired();
      if (!silent) alert('تم تحديث البيانات من إنفوسوفت بنجاح!');
    } catch (err) {
      console.warn('Sync notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle single invoice sliding state
  const toggleInvoice = (id) => {
    setExpandedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand all invoices (تفصيل)
  const handleExpandAll = () => {
    if (!statement?.breakdown) return;
    setExpandedInvoiceIds(new Set(statement.breakdown.map(inv => inv.id)));
  };

  // Collapse all invoices (ملخص)
  const handleCollapseAll = () => {
    setExpandedInvoiceIds(new Set());
  };

  const handleSaveTerms = async () => {
    try {
      if (!statement?.customer?.id) return;
      const r1 = Math.round(parseFloat(rate1) * 100) / 10000;
      const r2 = Math.round(parseFloat(rate2) * 100) / 10000;
      const r3 = Math.round(parseFloat(rate3) * 100) / 10000;

      await window.api.updateCustomer(statement.customer.id, {
        name: statement.customer.name,
        accounting_system_id: statement.customer.accounting_system_id,
        email: custEmail.trim(),
        phone: statement.customer.phone,
        default_discount_rate: isNaN(r3) ? 0.07 : r3,
        default_grace_days: parseInt(graceDays, 10) || 30,
        cat1_discount_rate: isNaN(r1) ? 0.00 : r1,
        cat2_discount_rate: isNaN(r2) ? 0.03 : r2,
        cat3_discount_rate: isNaN(r3) ? 0.07 : r3
      });
      setShowSettingsDrawer(false);
      await loadStatement(false);
      if (onRefreshRequired) onRefreshRequired();
      alert('تم تحديث شروط ونسب العميل بنجاح.');
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleApplyCategory = async () => {
    if (!categoryModalInv) return;
    try {
      let customRateVal = null;
      if (targetCat === 2 && customCatRate !== '' && !isNaN(customCatRate)) {
        customRateVal = Math.round(parseFloat(customCatRate) * 100) / 10000;
      }
      const updated = await window.api.updateInvoiceCategory(categoryModalInv.id, targetCat, customRateVal);
      if (updated) setStatement(updated);
      else await loadStatement(false);
      setCategoryModalInv(null);
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ أثناء تغيير الفئة: ' + err.message);
    }
  };

  const handleGrantException = async (e) => {
    e.preventDefault();
    if (!exceptionReason.trim() || !exceptionInv) return;
    try {
      await window.api.grantInvoiceException(exceptionInv.id, exceptionReason);
      setExceptionInv(null);
      setExceptionReason('');
      await loadStatement(false);
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleRevokeException = async (invId) => {
    if (!window.confirm('هل تريد إلغاء الاعتماد الاستثنائي لهذه الفاتورة؟')) return;
    try {
      await window.api.revokeInvoiceException(invId);
      await loadStatement(false);
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  // Print: Respects exact expanded / collapsed state
  const handlePrint = async () => {
    if (window.api && window.api.printStatement) {
      try {
        await window.api.printStatement(customerId, {
          expandedInvoiceIds: Array.from(expandedInvoiceIds)
        });
        return;
      } catch (err) {
        console.warn('Electron print fallback to window.print():', err);
      }
    }
    window.print();
  };

  // PDF Export: Also passes expanded invoices state
  const handleExportPdf = async () => {
    if (!statement) return;
    try {
      setExportingPdf(true);
      if (window.api && window.api.exportStatementPDF) {
        const path = await window.api.exportStatementPDF({
          customerId,
          expandedInvoiceIds: Array.from(expandedInvoiceIds)
        });
        if (path) alert(`تم تصدير كشف الحساب بصيغة PDF بنجاح إلى:\n${path}`);
      } else {
        window.print();
      }
    } catch (err) {
      alert('تعذر التصدير: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  // Filter Invoices
  const invoicesList = useMemo(() => {
    if (!statement?.breakdown) return [];
    return statement.breakdown.filter(inv => {
      const matchText = 
        !searchQuery ||
        inv.accounting_trans_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.description && inv.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchText) return false;

      if (statusFilter === 'UNPAID') return inv.remaining_unpaid > 0;
      if (statusFilter === 'PAID') return inv.remaining_unpaid === 0;

      return true;
    });
  }, [statement?.breakdown, searchQuery, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="statement-modal-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="statement-modal-container bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-scale-in text-slate-800">
        
        {/* ======================================================== */}
        {/* 1. Header: Document Title & Actions                      */}
        {/* ======================================================== */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                كشف حساب العميل والخصم المكتسب
              </h2>
              {isReadOnly && (
                <span className="no-print text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  أرشيف للقراءة فقط
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-800">{statement?.customer?.name || 'جاري التحميل...'}</span>
              <span className="mx-2 text-slate-300">•</span>
              <span className="font-mono text-slate-600">رقم الحساب: #{statement?.customer?.accounting_system_id}</span>
              <span className="mx-2 text-slate-300 print:inline hidden">•</span>
              <span className="print:inline hidden font-mono text-slate-400">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</span>
            </p>
          </div>

          <div className="no-print flex items-center gap-2 text-xs">
            <button
              onClick={() => syncFromInfosoftInternal(statement?.customer, false)}
              disabled={loading || isSyncing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-200"
              title="تحديث فوري من إنفوسوفت"
            >
              <RotateCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
            </button>

            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl font-medium border border-slate-200 transition flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>نسب الخصم</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition flex items-center gap-1.5 shadow-xs"
              title="طباعة الكشف وفق الحركات المنزلقة المعروضة حالياً"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-xl font-medium border border-slate-200 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingPdf ? 'تصدير...' : 'PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition mr-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. Executive 2-Metric Summary Strip                      */}
        {/* ======================================================== */}
        {statement && (
          <div className="bg-slate-50/70 border-b border-slate-100 px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Metric 1: The Rebate */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium mb-0.5">
                  إجمالي الخصم المعتمد المستحق للتسوية
                </div>
                <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                  +{statement.totalRebateEarned.toLocaleString()} <span className="text-xs font-normal text-slate-500 font-sans">ر.س</span>
                </div>
              </div>

              {/* Metric 2: Final Balance Status */}
              <div className="sm:text-left">
                <div className="text-[11px] text-slate-500 font-medium mb-0.5">
                  الموقف المالي النهائي للعميل
                </div>
                <div className="mt-1">
                  {statement.customerBalance === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <Check className="w-3.5 h-3.5" />
                      خالص بالكامل (0 ر.س)
                    </span>
                  ) : statement.customerBalance > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 font-mono">
                      متبقي بذمة العميل: {statement.customerBalance.toLocaleString()} ر.س
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 font-mono">
                      رصيد دائن فائض: {Math.abs(statement.customerBalance).toLocaleString()} ر.س
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  إجمالي صافي المبيعات: {statement.totalNetSales.toLocaleString()} ر.س
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* Settings Drawer (Tucked away neatly)                     */}
        {/* ======================================================== */}
        {showSettingsDrawer && (
          <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-4 animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800">تعديل نسب الخصم المعتمدة للعميل:</span>
              <button onClick={() => setShowSettingsDrawer(false)} className="text-xs text-slate-400 hover:text-slate-600">إغلاق ✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">فئة 1 (لا تشمل):</label>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                  <input type="number" step="0.1" value={rate1} onChange={e => setRate1(e.target.value)} className="w-full text-center font-bold focus:outline-none" />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">فئة 2 (مخفض):</label>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                  <input type="number" step="0.1" value={rate2} onChange={e => setRate2(e.target.value)} className="w-full text-center font-bold focus:outline-none" />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">فئة 3 (عام):</label>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                  <input type="number" step="0.1" value={rate3} onChange={e => setRate3(e.target.value)} className="w-full text-center font-bold focus:outline-none" />
                  <span className="text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">مهلة السداد (يوم):</label>
                <input type="number" value={graceDays} onChange={e => setGraceDays(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold focus:outline-none" />
              </div>

              <button
                onClick={handleSaveTerms}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition"
              >
                حفظ النسب
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. Toolbar: Search, Filters & Expand/Collapse Controls  */}
        {/* ======================================================== */}
        <div className="no-print px-6 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-white">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-52 sm:w-60">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-slate-400 transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            </div>

            {/* Quick Status Filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                الكل ({statement?.breakdown?.length || 0})
              </button>
              <button
                onClick={() => setStatusFilter('UNPAID')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'UNPAID' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                معلقة
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === 'PAID' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                مسددة
              </button>
            </div>
          </div>

          {/* Expand All / Collapse All Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <span className="text-[11px] text-slate-400 ml-1">عرض الحركات:</span>
            
            {/* زر تفصيل: ينزلق كافة الفواتير */}
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200 shadow-2xs"
              title="انزلاق كافة الفواتير لعرض كامل التفاصيل لجميع الحركات"
            >
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
              <span>تفصيل</span>
            </button>

            {/* زر ملخص: يلم كل التفاصيل */}
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200 shadow-2xs"
              title="لم كافة التفاصيل وعرض الملخص فقط لجميع الفواتير"
            >
              <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
              <span>ملخص</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. Sliding Table with Associated Movements               */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-24 text-center text-slate-400 text-xs">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-2"></div>
              جاري تحميل الفواتير...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-rose-600 font-medium">{error}</div>
          ) : invoicesList.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400">
              لا توجد فواتير مطابقة لبحثك.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 font-semibold text-[11px] sticky top-0 print:static print:bg-slate-100 print:text-slate-700">
                <tr>
                  <th className="py-3 px-6">الفاتورة والتاريخ</th>
                  <th className="py-3 px-4 text-left">مبلغ الفاتورة</th>
                  <th className="py-3 px-4 text-left text-emerald-800 font-bold">الخصم المكتسب</th>
                  <th className="py-3 px-6 text-center w-36">حالة السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {invoicesList.map((inv) => {
                  const isExpanded = expandedInvoiceIds.has(inv.id);
                  const isPaid = inv.remaining_unpaid === 0;
                  const totalReturns = inv.returns?.length || 0;
                  const totalSettlements = inv.settlements?.length || 0;
                  const hasDetails = totalReturns > 0 || totalSettlements > 0;

                  return (
                    <React.Fragment key={inv.id}>
                      {/* Main Clickable Invoice Row */}
                      <tr 
                        onClick={() => toggleInvoice(inv.id)}
                        className={`statement-invoice-row cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-50/80 font-medium' : 'hover:bg-slate-50/40'
                        }`}
                        title={isExpanded ? "انقر للم كل التفاصيل لهذه الفاتورة" : "انقر لانزلاق وعرض الحركات المرتبطة"}
                      >
                        {/* 1. Invoice & Date with sliding chevron indicator */}
                        <td className="py-3.5 px-6 font-sans">
                          <div className="flex items-center gap-2">
                            <ChevronDown 
                              className={`no-print w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                                isExpanded ? 'rotate-180 text-teal-800' : ''
                              }`} 
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 font-mono text-xs">#{inv.accounting_trans_id}</span>
                                {inv.is_exception_granted === 1 && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-sans">استثناء</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{inv.invoice_date}</div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Net Invoice Amount */}
                        <td className="py-3.5 px-4 text-left font-bold text-slate-900 font-mono text-sm">
                          {inv.net_total.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">ر.س</span>
                        </td>

                        {/* 3. Earned Rebate */}
                        <td className="py-3.5 px-4 text-left font-bold font-mono text-sm">
                          {inv.earned_discount > 0 ? (
                            <span className="text-emerald-700 font-black">+{inv.earned_discount.toLocaleString()} <span className="text-xs font-normal font-sans">ر.س</span></span>
                          ) : (
                            <span className="text-slate-300 font-normal">0 ر.س</span>
                          )}
                        </td>

                        {/* 4. Payment Status Pill */}
                        <td className="py-3.5 px-6 text-center font-sans">
                          {isPaid ? (
                            <span className="inline-block px-3 py-1 text-[11px] rounded-full bg-emerald-50 text-emerald-700 font-bold">
                              مسددة بالكامل ✓
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 text-[11px] rounded-full bg-rose-50 text-rose-700 font-bold font-mono">
                              متبقي: {inv.remaining_unpaid.toLocaleString()} ر.س
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Slid-Open Sub-Row: Associated Movements (نوع الحركة، رقم الحركة، تاريخها، قيمتها، الخصم المطبق) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 font-sans border-b border-slate-200/70 print:bg-white print:border-slate-300">
                          <td colSpan="4" className="py-2.5 px-6 sm:px-10">
                            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs print:border-slate-300 print:shadow-none space-y-2">
                              
                              {/* Sub-header */}
                              <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span>الحركات المرتبطة بالفاتورة #{inv.accounting_trans_id}:</span>
                                <span className="font-mono text-slate-400 font-normal text-[10px]">
                                  {inv.category_id === 1 ? 'فئة 1: لا تشمل الخصم (0%)' : inv.category_id === 2 ? `فئة 2: مخفض (${(inv.discount_rate*100).toFixed(1)}%)` : `فئة 3: عام (${(inv.discount_rate*100).toFixed(1)}%)`}
                                </span>
                              </div>

                              {/* Concise Associated Transactions Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                  <thead className="text-[10px] text-slate-400 border-b border-slate-100 font-semibold print:text-slate-600">
                                    <tr>
                                      <th className="py-1 px-2">نوع الحركة</th>
                                      <th className="py-1 px-2">رقم الحركة</th>
                                      <th className="py-1 px-2">تاريخ الحركة</th>
                                      <th className="py-1 px-2 text-left">قيمة الحركة</th>
                                      <th className="py-1 px-2 text-left text-emerald-800">الخصم المطبق</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                    
                                    {/* 1. Returns */}
                                    {inv.returns?.map(ret => (
                                      <tr key={`ret-${ret.id}`} className="text-rose-700 hover:bg-rose-50/30">
                                        <td className="py-1.5 px-2 font-sans font-medium flex items-center gap-1.5">
                                          <span className="no-print">↩️</span>
                                          <span>مرتجع مبيعات</span>
                                        </td>
                                        <td className="py-1.5 px-2 font-bold">#{ret.accounting_trans_id}</td>
                                        <td className="py-1.5 px-2 text-slate-500">{ret.adjustment_date}</td>
                                        <td className="py-1.5 px-2 text-left font-bold font-mono">
                                          -{ret.amount.toLocaleString()} ر.س
                                        </td>
                                        <td className="py-1.5 px-2 text-left text-slate-400 font-sans">
                                          (خصم وعاء)
                                        </td>
                                      </tr>
                                    ))}

                                    {/* 2. Settlements */}
                                    {inv.settlements?.map((st, idx) => (
                                      <tr key={`st-${idx}`} className="text-slate-800 hover:bg-teal-50/20">
                                        <td className="py-1.5 px-2 font-sans font-medium flex items-center gap-1.5">
                                          <span className="no-print">💳</span>
                                          <span>سند قبض (FIFO)</span>
                                        </td>
                                        <td className="py-1.5 px-2 font-bold">#{st.payment_trans_id}</td>
                                        <td className="py-1.5 px-2 text-slate-500">{st.payment_date}</td>
                                        <td className="py-1.5 px-2 text-left font-bold font-mono">
                                          +{st.amount_applied.toLocaleString()} ر.س
                                        </td>
                                        <td className="py-1.5 px-2 text-left font-bold text-emerald-700 font-mono">
                                          {st.discount_earned > 0 ? (
                                            <span>+{st.discount_earned.toLocaleString()} ر.س</span>
                                          ) : (
                                            <span className="text-slate-400 font-normal">0 ر.س</span>
                                          )}
                                          {st.is_eligible ? (
                                            <span className="text-[9px] text-slate-400 font-sans mr-1">({st.diff_days} يوم)</span>
                                          ) : (
                                            <span className="text-[9px] text-amber-600 font-sans mr-1">(متأخر {st.diff_days} يوم)</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}

                                    {/* Empty state */}
                                    {!hasDetails && (
                                      <tr>
                                        <td colSpan="5" className="py-2.5 px-2 text-center text-slate-400 font-sans text-xs">
                                          لم تسجل أي حركات سداد أو مرتجع مرتبطة بهذه الفاتورة حتى الآن.
                                        </td>
                                      </tr>
                                    )}

                                  </tbody>
                                </table>
                              </div>

                              {/* In-app action footer inside the slide */}
                              {!isReadOnly && (
                                <div className="no-print pt-1.5 flex items-center justify-between text-[11px] border-t border-slate-100 text-slate-400">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCategoryModalInv(inv);
                                      setTargetCat(inv.category_id || 3);
                                    }}
                                    className="text-slate-600 hover:text-slate-900 underline"
                                  >
                                    تغيير فئة الفاتورة
                                  </button>

                                  {inv.is_exception_granted === 1 ? (
                                    <button onClick={() => handleRevokeException(inv.id)} className="text-rose-600 hover:underline">
                                      إلغاء الاستثناء الممنوح
                                    </button>
                                  ) : (
                                    inv.settlements?.some(s => !s.is_eligible) && (
                                      <button 
                                        onClick={() => {
                                          setExceptionInv(inv);
                                          setExceptionReason('');
                                        }}
                                        className="text-amber-700 hover:underline font-medium"
                                      >
                                        منح استثناء إداري
                                      </button>
                                    )
                                  )}
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ======================================================== */}
        {/* 5. Minimal Footer                                        */}
        {/* ======================================================== */}
        <div className="no-print px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 bg-white">
          <span>* إجمالي الفواتير: {statement?.breakdown?.length || 0} فاتورة</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Category Modal */}
      {categoryModalInv && (
        <div className="no-print fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 text-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-1">تعديل فئة الفاتورة #{categoryModalInv.accounting_trans_id}</h3>
            <p className="text-slate-500 mb-3">اختر الفئة المعتمدة لاحتساب الخصم:</p>
            
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="cat" checked={targetCat === 1} onChange={() => setTargetCat(1)} />
                <span className="font-medium text-slate-800">1. لا تشمل الخصم (0%)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="cat" checked={targetCat === 2} onChange={() => setTargetCat(2)} />
                <span className="font-medium text-slate-800">2. فئة مخفضة ({rate2}%)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="cat" checked={targetCat === 3} onChange={() => setTargetCat(3)} />
                <span className="font-medium text-slate-800">3. فئة عامة أساسية ({rate3}%)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setCategoryModalInv(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">إلغاء</button>
              <button onClick={handleApplyCategory} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium">تطبيق</button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Modal */}
      {exceptionInv && (
        <div className="no-print fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-slate-200 text-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-1">منح استثناء إداري</h3>
            <p className="text-slate-500 mb-3">دوّن سبب اعتماد الخصم للفاتورة #{exceptionInv.accounting_trans_id}:</p>
            <form onSubmit={handleGrantException} className="space-y-3">
              <textarea
                value={exceptionReason}
                onChange={e => setExceptionReason(e.target.value)}
                required
                rows="3"
                placeholder="سبب الموافقة الاستثنائية..."
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setExceptionInv(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">إلغاء</button>
                <button type="submit" disabled={!exceptionReason.trim()} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium">تأكيد الاعتماد</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
