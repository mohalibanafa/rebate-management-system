import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckCircle2, AlertTriangle, 
  ShieldCheck, CornerDownLeft, Clock, Sparkles, RotateCw,
  Tag, CheckSquare, Square, Layers, Info,
  ChevronDown, ChevronUp, RotateCcw, DollarSign, Calendar
} from 'lucide-react';

const cleanRate = (rate, defaultVal = 0) => {
  if (rate === undefined || rate === null || isNaN(rate)) return defaultVal;
  return Math.round((Number(rate) * 100 + Number.EPSILON) * 100) / 100;
};

export default function CustomerStatementModal({ customerId, isOpen, onClose, onRefreshRequired, isReadOnly }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exceptionModalInv, setExceptionModalInv] = useState(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  // Tree expansion state: set of invoice IDs that are expanded
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState(new Set());

  // Editable customer configuration state
  const [custEmail, setCustEmail] = useState('');
  const [rate1, setRate1] = useState(0);
  const [rate2, setRate2] = useState(3);
  const [rate3, setRate3] = useState(7);
  const [graceDays, setGraceDays] = useState(30);

  // InfoSoft live sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { type: 'success' | 'warning' | 'info', message: string }

  // Multi-step Category Change Modal states
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState(3);
  const [customCatRate, setCustomCatRate] = useState('');
  const [isApplyingCategory, setIsApplyingCategory] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) {
      loadStatement(true); // autoSync on open
    } else {
      setSelectedInvoiceIds([]);
      setIsCategoryModalOpen(false);
      setSyncStatus(null);
    }
  }, [isOpen, customerId]);

  const loadStatement = async (autoSync = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.getCustomerStatement(customerId);
      setStatement(data);
      if (data?.breakdown) {
        setExpandedInvoiceIds(new Set(data.breakdown.map(i => i.id)));
      }
      if (data?.customer) {
        setCustEmail(data.customer.email || '');
        setRate1(cleanRate(data.customer.cat1_discount_rate, 0));
        setRate2(cleanRate(data.customer.cat2_discount_rate, 3));
        setRate3(cleanRate(data.customer.cat3_discount_rate, cleanRate(data.customer.default_discount_rate, 7)));
        setGraceDays(data.customer.default_grace_days || 30);
      }
      setLoading(false);

      // Auto-sync customer transactions from InfoSoft upon opening
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
      if (!silent) setSyncStatus({ type: 'info', message: 'جاري جلب وتدقيق أحدث الفواتير والمرتجعات من إنفوسوفت...' });

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
      setSyncStatus({
        type: 'success',
        message: `تم التحديث اللحظي من إنفوسوفت بنجاح (${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})`
      });
      if (onRefreshRequired) onRefreshRequired();
      if (!silent) {
        alert(`تمت مزامنة وتحديث كشف حساب العميل [${accId}] من إنفوسوفت بنجاح!`);
      }
    } catch (err) {
      console.warn('InfoSoft auto-sync error:', err);
      setSyncStatus({
        type: 'warning',
        message: 'يعمل بالبيانات المسجلة محلياً (تعذر الاتصال المباشر بقاعدة إنفوسوفت)'
      });
      if (!silent) {
        alert('تعذر التحديث من إنفوسوفت: ' + (err.message || String(err)));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = () => {
    syncFromInfosoftInternal(statement?.customer, false);
  };

  const handleSaveRates = async () => {
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
      await loadStatement(false);
      if (onRefreshRequired) onRefreshRequired();
      alert('تم حفظ وتحديث بيانات ونسب العميل بنجاح.');
    } catch (err) {
      alert('خطأ أثناء الحفظ: ' + err.message);
    }
  };

  const toggleInvoiceExpand = (invId) => {
    setExpandedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(invId)) next.delete(invId);
      else next.add(invId);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (!statement?.breakdown) return;
    setExpandedInvoiceIds(new Set(statement.breakdown.map(i => i.id)));
  };

  const handleCollapseAll = () => {
    setExpandedInvoiceIds(new Set());
  };

  const handleToggleSelectAll = () => {
    if (!statement?.breakdown) return;
    if (selectedInvoiceIds.length === statement.breakdown.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(statement.breakdown.map(i => i.id));
    }
  };

  const handleToggleSelectInvoice = (id) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenCategoryModal = (invoiceId = null) => {
    if (invoiceId) {
      setSelectedInvoiceIds([invoiceId]);
      const inv = statement?.breakdown?.find(i => i.id === invoiceId);
      if (inv) {
        setTargetCategory(inv.category_id || 3);
        setCustomCatRate(cleanRate(inv.discount_rate, 3));
      }
    } else {
      if (selectedInvoiceIds.length === 0) return;
      setTargetCategory(3);
      setCustomCatRate('');
    }
    setIsCategoryModalOpen(true);
  };

  const handleApplyCategoryChange = async () => {
    if (selectedInvoiceIds.length === 0) return;
    try {
      setIsApplyingCategory(true);
      let customRateVal = null;
      if (targetCategory === 2 && customCatRate !== '' && !isNaN(customCatRate)) {
        customRateVal = Math.round(parseFloat(customCatRate) * 100) / 10000;
      }

      let updatedStatement;
      if (window.api.updateInvoicesBatchCategory) {
        updatedStatement = await window.api.updateInvoicesBatchCategory(
          selectedInvoiceIds,
          targetCategory,
          customRateVal
        );
      } else {
        for (const id of selectedInvoiceIds) {
          updatedStatement = await window.api.updateInvoiceCategory(id, targetCategory, customRateVal);
        }
      }

      if (updatedStatement) {
        setStatement(updatedStatement);
      } else {
        await loadStatement(false);
      }

      setIsCategoryModalOpen(false);
      setSelectedInvoiceIds([]);
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ أثناء تطبيق تغيير الفئة: ' + err.message);
    } finally {
      setIsApplyingCategory(false);
    }
  };

  const handleGrantException = async (e) => {
    e.preventDefault();
    if (!exceptionReason.trim()) return;

    try {
      await window.api.grantInvoiceException(exceptionModalInv.id, exceptionReason);
      setExceptionModalInv(null);
      setExceptionReason('');
      await loadStatement();
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleRevokeException = async (invId) => {
    if (!window.confirm('هل أنت متأكد من إلغاء الاستثناء الممنوح لهذه الفاتورة؟')) return;
    try {
      await window.api.revokeInvoiceException(invId);
      await loadStatement();
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleCategoryChange = async (invId, newCatId) => {
    try {
      setUpdatingCatInvId(invId);
      const updatedStatement = await window.api.updateInvoiceCategory(invId, parseInt(newCatId, 10));
      setStatement(updatedStatement);
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      alert('خطأ أثناء تغيير فئة الفاتورة: ' + err.message);
    } finally {
      setUpdatingCatInvId(null);
    }
  };

  const handlePrint = async () => {
    try {
      if (window.api && window.api.printStatement) {
        await window.api.printStatement(customerId);
      } else {
        window.print();
      }
    } catch (err) {
      alert('خطأ أثناء الطباعة: ' + err.message);
    }
  };

  const handleExportPdf = async () => {
    if (!statement) return;
    try {
      setExportingPdf(true);
      if (window.api && window.api.exportStatementPDF) {
        const filePath = await window.api.exportStatementPDF(customerId);
        if (filePath) {
          alert(`تم تصدير كشف الحساب بنجاح بصيغة PDF نقية عبر قالب مالي رسمي إلى:\n${filePath}`);
        }
      } else {
        alert('خاصية تصدير PDF تتطلب تشغيل التطبيق في بيئة سطح المكتب.');
      }
    } catch (err) {
      alert('فشل تصدير PDF: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-spruce-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-corporate-lg w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Luxury Corporate Header */}
        <div className="px-6 py-4 bg-spruce-900 text-sand-warm flex items-center justify-between no-print border-b border-teal-forest">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-forest rounded-xl text-gold-bronze shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-sand-warm flex items-center gap-2">
                كشف وتدقيق رصيد خصم تعجيل الدفع المجمع
                {isReadOnly && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                    أرشيف - للقراءة فقط
                  </span>
                )}
              </h2>
              <p className="text-xs text-sage-soft mt-0.5">
                العميل: <strong className="text-sand-warm">{statement?.customer?.name || 'جاري التحميل...'}</strong> | الرقم المحاسبي: <strong className="text-gold-bronze font-mono">{statement?.customer?.accounting_system_id}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={loading || isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-spruce-800 hover:bg-spruce-700 text-sand-warm rounded-xl text-xs font-bold transition border border-teal-forest shadow-sm"
              title="مزامنة فورية وتحديث كشف الحساب من إنفوسوفت ERP"
            >
              <RotateCw className={`w-4 h-4 text-gold-bronze ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'جاري التحديث...' : 'تحديث يدوي'}
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl text-xs font-bold transition border border-sage-soft/30"
            >
              <Printer className="w-4 h-4 text-gold-bronze" />
              طباعة
            </button>
            <button
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gold-bronze hover:bg-gold-bronze-hover text-spruce-900 rounded-xl text-xs font-black transition shadow-sm"
            >
              <FileText className="w-4 h-4" />
              {exportingPdf ? 'جاري التصدير...' : 'تصدير PDF رسمي'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-sage-soft hover:text-sand-warm hover:bg-teal-forest rounded-xl transition mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Live Sync Status Banner */}
          {syncStatus && (
            <div className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
              syncStatus.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : syncStatus.type === 'warning' 
                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                  : 'bg-teal-50 text-teal-800 border border-teal-200'
            }`}>
              <div className="flex items-center gap-2">
                {syncStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : syncStatus.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <RotateCw className="w-4 h-4 text-teal-600 shrink-0 animate-spin" />
                )}
                <span>{syncStatus.message}</span>
              </div>
              {isSyncing && (
                <span className="text-[11px] text-teal-700 flex items-center gap-1">
                  <RotateCw className="w-3 h-3 animate-spin" /> جاري الجلب
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-teal-forest border-t-transparent rounded-full mx-auto mb-3"></div>
              جاري فحص الحركات وإعادة الاحتساب اللحظي المباشر...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold">
              {error}
            </div>
          ) : statement ? (
            <>
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 mb-1">إجمالي المبيعات (أصل)</div>
                  <div className="text-base font-black text-spruce-900">{statement.totalGrossSales.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[11px] text-rose-700 mb-1">إجمالي المرتجعات والتوالف</div>
                  <div className="text-base font-black text-rose-700">-{statement.totalReturns.toLocaleString()} <span className="text-xs font-normal text-rose-400">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-teal-forest/10 border border-teal-forest/20 rounded-xl">
                  <div className="text-[11px] text-teal-forest mb-1 font-bold">صافي المبيعات الفعلي</div>
                  <div className="text-base font-black text-spruce-900">{statement.totalNetSales.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-sand-light border border-sand-warm rounded-xl relative overflow-hidden">
                  <div className="text-[11px] text-spruce-900 mb-1 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-gold-bronze" />
                    الخصم المجمع المعتمد
                  </div>
                  <div className="text-lg font-black text-gold-bronze tracking-tight">
                    {statement.totalRebateEarned.toLocaleString()} <span className="text-xs font-normal text-slate-500">ر.س</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 mb-1">إجمالي السدادات المستلمة</div>
                  <div className="text-base font-black text-slate-700">{statement.totalPayments.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span></div>
                </div>

                <div className={`p-3.5 rounded-xl border ${statement.customerBalance > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-teal-forest/10 border-teal-forest/20 text-teal-forest'}`}>
                  <div className="text-[11px] mb-1 font-bold">
                    {statement.customerBalance > 0 ? 'المتبقي بذمة العميل' : 'رصيد دائن فائض (مقدم)'}
                  </div>
                  <div className="text-base font-black">
                    {Math.abs(statement.customerBalance).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
                  </div>
                </div>
              </div>

              {/* 3 Categories Breakdown Summary Table (InfoSoft ERP Rules) */}
              {statement.categoriesSummary && statement.categoriesSummary.length > 0 && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2.5">
                    <div>
                      <h3 className="font-bold text-spruce-900 text-xs flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-gold-bronze" />
                        جدول فئات المبيعات الثلاث وحساب الخصم المكتسب (قاعدة بيانات إنفوسوفت)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        تم الفرز آلياً بناءً على بيان الفاتورة (مكان اسم العميل custnm)، مع خصم المرتجعات من فئاتها المرتبطة (شاملة مرتجعات السنة السابقة).
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 text-spruce-900 font-bold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-3">فئة الخصم</th>
                          <th className="py-2.5 px-3">عدد الفواتير</th>
                          <th className="py-2.5 px-3">إجمالي المبيعات</th>
                          <th className="py-2.5 px-3">عدد المرتجعات</th>
                          <th className="py-2.5 px-3">إجمالي المرتجعات</th>
                          <th className="py-2.5 px-3">صافي المبيعات</th>
                          <th className="py-2.5 px-3">معدل الخصم المعتمد</th>
                          <th className="py-2.5 px-3 text-gold-bronze font-black">الخصم المكتسب المستحق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statement.categoriesSummary.map(cat => (
                          <tr key={cat.id} className="hover:bg-white transition-colors">
                            <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${cat.id === 1 ? 'bg-rose-500' : (cat.id === 2 ? 'bg-amber-500' : 'bg-emerald-500')}`}></span>
                              <span>{cat.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">{cat.invoiceCount}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{(cat.salesBeforeVat || cat.gross || 0).toLocaleString()} ر.س</td>
                            <td className="py-2.5 px-3 text-rose-700 font-medium">{cat.returnCount}</td>
                            <td className="py-2.5 px-3 text-rose-700 font-semibold">-{(cat.returnsBeforeVat || cat.returns || 0).toLocaleString()} ر.س</td>
                            <td className="py-2.5 px-3 font-bold text-spruce-900">{(cat.netSalesBeforeVat || cat.net || 0).toLocaleString()} ر.س</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              {cleanRate(cat.discountRate !== undefined ? cat.discountRate : (cat.id === 1 ? rate1/100 : (cat.id === 2 ? rate2/100 : rate3/100)))}%
                            </td>
                            <td className="py-2.5 px-3 font-black text-gold-bronze">
                              {(cat.earnedDiscount || cat.earned || 0).toLocaleString()} ر.س
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Customer Manual Settings: Email & Category Discount Rates */}
              <div className="bg-sand-light/50 border border-sand-warm rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-sand-warm/60 pb-2">
                  <span className="font-bold text-spruce-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-forest" />
                    بيانات العميل اليدوية ومعدلات الخصم المخصصة لكل فئة:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    يمكنك تعديل البريد ومعدلات الخصم يدوياً لكل فئة وحفظها مباشرة
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-600 mb-1 font-bold">البريد الإلكتروني للعميل:</label>
                    <input 
                      type="email" 
                      value={custEmail} 
                      onChange={e => setCustEmail(e.target.value)} 
                      placeholder="name@company.com" 
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-rose-700 mb-1 font-bold">خصم فئة 1 (لا تشمل):</label>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={rate1} 
                        onChange={e => setRate1(e.target.value)} 
                        className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-mono text-center font-bold"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-amber-800 mb-1 font-bold">خصم فئة 2 (مخفض):</label>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={rate2} 
                        onChange={e => setRate2(e.target.value)} 
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono text-center font-bold"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-emerald-800 mb-1 font-bold">خصم فئة 3 (عام):</label>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={rate3} 
                        onChange={e => setRate3(e.target.value)} 
                        className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-center font-bold"
                      />
                      <span className="text-slate-500 font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleSaveRates} 
                      disabled={isSyncing} 
                      className="flex-1 py-1.5 bg-spruce-900 hover:bg-spruce-800 text-sand-warm rounded-lg font-bold text-xs shadow-sm transition"
                    >
                      حفظ النسب
                    </button>
                    <button 
                      onClick={handleManualSync} 
                      disabled={isSyncing} 
                      className="flex-1 py-1.5 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1"
                      title="جلب وتحديث الفواتير والمرتجعات مباشرة من قاعدة بيانات إنفوسوفت"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-gold-bronze" />
                      {isSyncing ? 'جاري...' : 'مزامنة'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Invoices & Settlements Relational Tree (شجرة الحركات وعلاقات الترابط المحاسبي) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-corporate bg-white">
                {/* Tree Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-teal-forest" />
                      <h3 className="font-black text-spruce-900 text-sm">
                        شجرة الحركات المترابطة واحتساب خصم تعجيل الدفع (FIFO)
                      </h3>
                      <span className="text-[10px] font-bold bg-teal-forest/10 text-teal-forest px-2 py-0.5 rounded-full border border-teal-forest/20">
                        Tree Hierarchy
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      تمثيل شجري مترابط يربط كل فاتورة مبيعات (الجذر) بالمرتجعات المحسومة منها وسندات القبض المسددة لها وحساب الأثر المالي اللحظي.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end no-print">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-xs">
                        الفواتير: <strong className="text-spruce-900">{statement.breakdown.length}</strong>
                      </span>
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 shadow-xs font-semibold">
                        المرتجعات: <strong>{(statement.breakdown || []).reduce((sum, inv) => sum + (inv.returns?.length || 0), 0)}</strong>
                      </span>
                      <span className="px-2.5 py-1 bg-teal-50 text-teal-900 rounded-lg border border-teal-200 shadow-xs font-semibold">
                        السدادات: <strong>{(statement.breakdown || []).reduce((sum, inv) => sum + (inv.settlements?.length || 0), 0)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleExpandAll}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        title="توسيع كافة فروع الحركات"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        توسيع الكل
                      </button>
                      <button
                        type="button"
                        onClick={handleCollapseAll}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                        title="طي كافة فروع الحركات"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        طي الكل
                      </button>
                    </div>
                  </div>
                </div>

                {/* Batch Selection Action Bar */}
                <div className="px-4 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs no-print">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-spruce-900 select-none">
                    <input
                      type="checkbox"
                      checked={selectedInvoiceIds.length > 0 && selectedInvoiceIds.length === statement.breakdown.length}
                      onChange={handleToggleSelectAll}
                      disabled={isReadOnly || statement.breakdown.length === 0}
                      className="w-4 h-4 rounded text-teal-forest border-slate-300 focus:ring-teal-forest cursor-pointer"
                    />
                    <span>تحديد الكل ({selectedInvoiceIds.length} فاتورة محددة)</span>
                  </label>

                  {selectedInvoiceIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCategoryModal()}
                        disabled={isReadOnly}
                        className="px-3.5 py-1.5 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Tag className="w-3.5 h-3.5 text-gold-bronze" />
                        تغيير فئة الخصم للفواتير المحددة ({selectedInvoiceIds.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceIds([])}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  )}
                </div>

                {/* Invoices Tree Nodes Container */}
                <div className="p-4 space-y-4 bg-slate-50/40">
                  {statement.breakdown.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                      لا توجد فواتير مسجلة لهذا العميل حتى الآن.
                    </div>
                  ) : (
                    statement.breakdown.map((inv) => {
                      const isExpanded = expandedInvoiceIds.has(inv.id);
                      const isSelected = selectedInvoiceIds.includes(inv.id);
                      const totalPaidOnInv = (inv.settlements || []).reduce((sum, s) => sum + (s.amount_applied || 0), 0);

                      return (
                        <div
                          key={inv.id}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                            isSelected
                              ? 'border-teal-forest bg-teal-50/20 ring-1 ring-teal-forest'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Invoice Parent Node Header */}
                          <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Batch Selection Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectInvoice(inv.id)}
                                disabled={isReadOnly}
                                className="w-4 h-4 rounded text-teal-forest border-slate-300 focus:ring-teal-forest cursor-pointer no-print"
                              />

                              {/* Expand/Collapse Chevron Button */}
                              <button
                                type="button"
                                onClick={() => toggleInvoiceExpand(inv.id)}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition no-print"
                                title={isExpanded ? 'طي الفروع' : 'توسيع الفروع'}
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              {/* Invoice Number */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  فاتورة
                                </span>
                                <span className="font-mono font-black text-sm text-spruce-900 tracking-tight">
                                  #{inv.accounting_trans_id}
                                </span>
                                {inv.is_corrected === 1 && (
                                  <span className="text-[10px] bg-sand-light text-spruce-900 border border-sand-warm px-1.5 py-0.5 rounded font-bold">
                                    مصححة
                                  </span>
                                )}
                              </div>

                              {/* Invoice Date */}
                              <div className="flex items-center gap-1 text-slate-500 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{inv.invoice_date}</span>
                              </div>

                              {/* Invoice Description (custnm) */}
                              {inv.description && (
                                <div className="text-xs text-slate-700 bg-slate-100/80 px-2.5 py-0.5 rounded-lg border border-slate-200 font-medium max-w-xs truncate" title={inv.description}>
                                  {inv.description}
                                </div>
                              )}

                              {/* Category Badge */}
                              <div className="flex items-center gap-1">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border shadow-xs ${
                                  inv.category_id === 1 
                                    ? 'bg-rose-50 text-rose-800 border-rose-300' 
                                    : inv.category_id === 2 
                                      ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                      : 'bg-teal-50 text-teal-forest border-teal-200'
                                }`}>
                                  {inv.category_name || (inv.category_id === 1 ? '1. لا يشمل (0%)' : inv.category_id === 2 ? ('2. مخفض (' + (inv.discount_rate * 100).toFixed(1) + '%)') : ('3. عام (' + (inv.discount_rate * 100).toFixed(1) + '%)'))}
                                </span>
                                {inv.is_category_manual === 1 && (
                                  <span className="text-[9px] text-teal-forest font-black" title="تم تحديد الفئة يدوياً من قبل المستخدم">
                                    ★ يدوي
                                  </span>
                                )}
                              </div>

                              {/* Grace Period */}
                              <div className="text-[11px] text-slate-500 font-medium">
                                المهلة: <strong>{inv.grace_days}</strong> يوم
                              </div>
                            </div>

                            {/* Right Status & Actions */}
                            <div className="flex items-center gap-2 self-end md:self-auto">
                              {/* Payment Status Pill */}
                              {inv.status === 'FULLY_PAID' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-teal-forest/15 text-teal-forest font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  مسددة بالكامل
                                </span>
                              ) : inv.status === 'PARTIALLY_PAID' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-900 font-bold">
                                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                                  مسددة جزئياً
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-medium">
                                  غير مسددة
                                </span>
                              )}

                              {/* Branch count badge */}
                              <button
                                type="button"
                                onClick={() => toggleInvoiceExpand(inv.id)}
                                className="text-[11px] text-slate-500 hover:text-spruce-900 font-medium px-2 py-0.5 bg-slate-100 rounded-md transition no-print"
                              >
                                {inv.returns.length} مرتجع • {inv.settlements.length} سداد
                              </button>

                              {/* Action Buttons */}
                              {!isReadOnly && (
                                <div className="flex items-center gap-1.5 no-print">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCategoryModal(inv.id)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-forest border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                    title="تغيير فئة الخصم لهذه الفاتورة عبر نافذة الاختيار"
                                  >
                                    <Tag className="w-3 h-3 text-gold-bronze" />
                                    تغيير الفئة
                                  </button>

                                  {inv.is_exception_granted === 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeException(inv.id)}
                                      className="text-xs text-rose-600 hover:underline font-bold px-1"
                                      title={inv.exception_reason}
                                    >
                                      إلغاء الاستثناء
                                    </button>
                                  ) : (
                                    inv.settlements.some(s => !s.is_eligible) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExceptionModalInv(inv);
                                          setExceptionReason('');
                                        }}
                                        className="text-xs bg-sand-light text-spruce-900 border border-sand-warm hover:bg-sand-warm px-2.5 py-1 rounded-lg transition font-bold"
                                      >
                                        اعتماد استثنائي
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Arithmetic Relationship Strip (شريط ترابط المعادلة المحاسبية) */}
                          <div className="px-4 py-2 bg-slate-50/90 border-t border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                              <span className="text-slate-500 text-[11px]">أصل الفاتورة:</span>
                              <strong className="text-spruce-900 font-mono">{inv.gross_amount.toLocaleString()} ر.س</strong>

                              <span className="text-slate-400">➖</span>

                              <span className="text-slate-500 text-[11px]">المرتجع:</span>
                              <strong className={inv.total_returns > 0 ? 'text-rose-600 font-mono font-bold' : 'text-slate-400 font-mono'}>
                                {inv.total_returns > 0 ? '-' + inv.total_returns.toLocaleString() + ' ر.س' : '0 ر.س'}
                              </strong>

                              <span className="text-slate-400">🟰</span>

                              <span className="text-teal-forest text-[11px] font-bold">الصافي الخاضع:</span>
                              <strong className="text-teal-forest font-mono font-black">{inv.net_total.toLocaleString()} ر.س</strong>

                              <span className="text-slate-400">➔</span>

                              <span className="text-slate-500 text-[11px]">المسدد (FIFO):</span>
                              <strong className="text-spruce-900 font-mono font-bold">{totalPaidOnInv.toLocaleString()} ر.س</strong>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Earned Discount Pill */}
                              <div className="bg-sand-light border border-sand-warm px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-gold-bronze" />
                                <span className="text-spruce-900 text-[11px] font-bold">الخصم المكتسب:</span>
                                <span className="text-gold-bronze font-mono font-black text-xs">
                                  {inv.earned_discount > 0 ? '+' + inv.earned_discount.toLocaleString() + ' ر.س' : '0 ر.س'}
                                </span>
                              </div>

                              {/* Remaining Balance Pill */}
                              <div>
                                {inv.remaining_unpaid > 0 ? (
                                  <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold font-mono inline-block">
                                    المتبقي: {inv.remaining_unpaid.toLocaleString()} ر.س
                                  </span>
                                ) : (
                                  <span className="text-teal-forest bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl text-xs font-bold inline-block">
                                    مسددة بالكامل ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Hierarchical Tree Branches (Collapsible) */}
                          {isExpanded && (
                            <div className="p-4 bg-slate-50/40 space-y-3">
                              
                              {/* Exception Banner if Active */}
                              {inv.is_exception_granted === 1 && (
                                <div className="bg-sand-light border border-sand-warm rounded-xl p-3 text-xs flex items-center justify-between text-spruce-900 shadow-xs">
                                  <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-gold-bronze shrink-0" />
                                    <div>
                                      <strong className="text-gold-bronze">ملاحظة الاستثناء الإداري المعتمد:</strong>
                                      <span className="mr-1 text-slate-700 font-medium">"{inv.exception_reason}"</span>
                                    </div>
                                  </div>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeException(inv.id)}
                                      className="text-rose-600 hover:text-rose-800 text-[11px] font-bold underline"
                                    >
                                      إلغاء الاستثناء
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Tree Trunk Guide Rail */}
                              <div className="relative mr-4 pr-5 border-r-2 border-teal-600/30 space-y-3">
                                
                                {/* Branch 1: Returns Tree Items */}
                                {inv.returns && inv.returns.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                      <span>المرتجعات والتوالف المرتبطة بالفاتورة ({inv.returns.length} حركة):</span>
                                    </div>

                                    {inv.returns.map((ret) => (
                                      <div
                                        key={'ret-' + ret.id}
                                        className="relative bg-white border border-rose-200 rounded-xl p-3 shadow-xs hover:border-rose-300 transition-colors"
                                      >
                                        {/* Connector stem */}
                                        <div className="absolute -right-5 top-4 w-3.5 h-0.5 bg-teal-600/30"></div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap text-xs">
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-900 font-bold rounded text-[10px] flex items-center gap-1">
                                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                              مرتجع مبيعات
                                            </span>
                                            <span className="font-mono font-bold text-spruce-900">
                                              سند #{ret.accounting_trans_id}
                                            </span>
                                            <span className="text-slate-500 text-[11px]">
                                              بتاريخ {ret.adjustment_date}
                                            </span>
                                            {ret.linked_invoice_year === '2025' && (
                                              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded font-bold text-[10px]">
                                                ★ مرتجع من السنة السابقة (2025)
                                              </span>
                                            )}
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-700 text-[10px]">
                                              خصم من فئة الفاتورة: {ret.category_name || (ret.category_id === 1 ? 'لا تشمل' : (ret.category_id === 2 ? 'مخفض' : 'عام'))}
                                            </span>
                                          </div>

                                          <div className="text-right">
                                            <span className="text-sm font-black text-rose-700 font-mono">
                                              -{ret.amount.toLocaleString()} ر.س
                                            </span>
                                          </div>
                                        </div>

                                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                          <span>
                                            {ret.notes ? 'البيان: ' + ret.notes : 'تم خصم قيمة هذا المرتجع لتقليص أصل الفاتورة والوعاء الخاضع للخصم'}
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            أثر محاسبي مباشر ✓
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Branch 2: FIFO Settlements Tree Items */}
                                {inv.settlements && inv.settlements.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-teal-forest flex items-center gap-1.5">
                                      <DollarSign className="w-3.5 h-3.5 text-teal-forest" />
                                      <span>سدادات سندات القبض وتوزيع السيولة بأسلوب FIFO ({inv.settlements.length} دفعة):</span>
                                    </div>

                                    {inv.settlements.map((settle, sIdx) => (
                                      <div
                                        key={'settle-' + sIdx}
                                        className={`relative rounded-xl p-3 shadow-xs border transition-colors ${
                                          settle.is_eligible 
                                            ? 'bg-white border-teal-200 hover:border-teal-300' 
                                            : 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                                        }`}
                                      >
                                        {/* Connector stem */}
                                        <div className="absolute -right-5 top-4 w-3.5 h-0.5 bg-teal-600/30"></div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap text-xs">
                                            <span className={`px-2 py-0.5 font-bold rounded text-[10px] flex items-center gap-1 ${
                                              settle.is_eligible ? 'bg-teal-100 text-teal-900' : 'bg-amber-100 text-amber-900'
                                            }`}>
                                              <DollarSign className="w-3 h-3" />
                                              سداد سند قبض (FIFO)
                                            </span>
                                            <span className="font-mono font-bold text-spruce-900">
                                              سند #{settle.payment_trans_id}
                                            </span>
                                            <span className="text-slate-500 text-[11px]">
                                              بتاريخ {settle.payment_date}
                                            </span>
                                            <span className="text-xs font-bold text-spruce-900 mr-2">
                                              المبلغ الموزع: +{settle.amount_applied.toLocaleString()} ر.س
                                            </span>
                                          </div>

                                          <div className="text-right">
                                            <span className="text-sm font-black text-gold-bronze font-mono">
                                              الخصم المكتسب: {settle.discount_earned > 0 ? '+' + settle.discount_earned.toLocaleString() + ' ر.س' : '0 ر.س'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                                          <div className="text-slate-600 flex items-center gap-1.5 flex-wrap">
                                            <span>فارق السداد: <strong>{settle.diff_days}</strong> يوماً</span>
                                            <span className="text-slate-300">|</span>
                                            <span>مهلة السماح المعتمدة: <strong>{settle.grace_days}</strong> يوماً</span>
                                          </div>

                                          <div>
                                            {settle.is_eligible ? (
                                              <span className="inline-flex items-center gap-1 text-teal-forest font-bold">
                                                <ShieldCheck className="w-3.5 h-3.5 text-teal-forest" />
                                                {inv.is_exception_granted === 1 && settle.diff_days > settle.grace_days
                                                  ? 'مؤهل للخصم (معتمد استثنائياً)'
                                                  : 'مؤهل للخصم (سداد في ' + settle.diff_days + ' يوم ضمن المهلة)'}
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                غير مؤهل (سداد متأخر: الفارق {settle.diff_days} تجاوز المهلة {settle.grace_days} يوم)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Branch 3: No returns and no settlements */}
                                {(!inv.returns || inv.returns.length === 0) && (!inv.settlements || inv.settlements.length === 0) && (
                                  <div className="relative bg-white border border-slate-200 rounded-xl p-3 text-slate-500 text-xs flex items-center gap-2">
                                    <div className="absolute -right-5 top-4 w-3.5 h-0.5 bg-teal-600/30"></div>
                                    <Info className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span>لم يتم تسجيل أي مرتجعات أو سدادات موزعة على هذه الفاتورة حتى الآن (المبلغ متبقي بالكامل بذمة العميل).</span>
                                  </div>
                                )}

                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 no-print">
          <div>
            * يتم إعادة بناء هذا الكشف آلياً ولحظياً بالكامل من واقع سجل الحركات لضمان دقة محاسبية 100%.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Exception Modal */}
      {exceptionModalInv && (
        <div className="fixed inset-0 z-60 bg-spruce-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-corporate-lg max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-sm font-black text-spruce-900 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-gold-bronze" />
              اعتماد الخصم استثنائياً للفاتورة رقم {exceptionModalInv.accounting_trans_id}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              هذه الفاتورة تم سدادها بعد انقضاء مهلة السماح. يرجى تدوين سبب وتبرير منح الاستثناء لتوثيقه في سجل التدقيق:
            </p>
            <form onSubmit={handleGrantException} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1">سبب الاستثناء (إلزامي):</label>
                <textarea
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="مثال: تأخر في التحويل البنكي / موافقة المدير العام..."
                  required
                  rows="3"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-teal-forest focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExceptionModalInv(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!exceptionReason.trim()}
                  className="px-4 py-1.5 bg-gold-bronze hover:bg-gold-bronze-hover text-spruce-900 rounded-xl text-xs font-black transition disabled:opacity-50"
                >
                  تأكيد ومنح الاستثناء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Step Category Change Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-60 bg-spruce-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-corporate-lg w-full max-w-md border border-slate-200 overflow-hidden animate-scale-in">
            <div className="p-4 bg-spruce-900 text-sand-warm flex items-center justify-between border-b border-teal-forest">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-gold-bronze" />
                <h3 className="font-black text-sm text-sand-warm">
                  تعديل فئة الخصم للفواتير المحددة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-sage-soft hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Step 1: Invoices Summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[11px] text-slate-500 font-bold mb-1.5 flex items-center justify-between">
                  <span>الخطوة 1: الفواتير المحددة للتعديل</span>
                  <span className="text-teal-forest font-bold">({selectedInvoiceIds.length} فاتورة)</span>
                </div>
                <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-spruce-900 flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-slate-200">
                  {selectedInvoiceIds.map(id => {
                    const inv = statement?.breakdown?.find(i => i.id === id);
                    return (
                      <span key={id} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-bold">
                        {inv?.accounting_trans_id || `#${id}`}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Target Category Options */}
              <div>
                <div className="text-[11px] text-slate-700 font-bold mb-2">
                  الخطوة 2: اختر فئة الخصم الجديدة المطلوبة:
                </div>
                <div className="space-y-2">
                  {/* Category 1 */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    targetCategory === 1 ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="targetCat"
                      checked={targetCategory === 1}
                      onChange={() => setTargetCategory(1)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-rose-900 flex items-center justify-between">
                        <span>1. لا تشمل الخصم</span>
                        <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-mono font-bold">0%</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        استثناء هذه الفواتير من خصم تعجيل الدفع نهائياً (نسبة الخصم 0%).
                      </div>
                    </div>
                  </label>

                  {/* Category 2 */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    targetCategory === 2 ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="targetCat"
                      checked={targetCategory === 2}
                      onChange={() => setTargetCategory(2)}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 flex items-center justify-between">
                        <span>2. مخفض</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          {customCatRate !== '' && !isNaN(customCatRate) ? `${customCatRate}% (مخصص)` : `${rate2}%`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        فئة الفواتير المخفضة، وفق النسبة الافتراضية للعميل ({rate2}%) أو إدخال نسبة خاصة.
                      </div>
                      {targetCategory === 2 && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center gap-2">
                          <span className="text-[11px] text-amber-900 font-bold">نسبة خاصة اختيارية (%):</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={customCatRate}
                            onChange={(e) => setCustomCatRate(e.target.value)}
                            placeholder={String(rate2)}
                            className="w-20 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-mono font-bold text-center focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Category 3 */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    targetCategory === 3 ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name="targetCat"
                      checked={targetCategory === 3}
                      onChange={() => setTargetCategory(3)}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-emerald-900 flex items-center justify-between">
                        <span>3. عام (خاضع للخصم الأساسي)</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">{rate3}%</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        الفواتير القياسية الخاضعة لنسبة الخصم الكاملة المعتمدة للعميل ({rate3}%).
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 3: Confirmation and Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplyCategoryChange}
                  disabled={isApplyingCategory}
                  className="px-5 py-2 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl font-black transition flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className={`w-4 h-4 text-gold-bronze ${isApplyingCategory ? 'animate-spin' : ''}`} />
                  {isApplyingCategory ? 'جاري التطبيق...' : 'تأكيد وتطبيق التغيير'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
