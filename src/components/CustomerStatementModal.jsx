import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckCircle2, AlertTriangle, 
  ShieldCheck, CornerDownLeft, Clock, Sparkles, RotateCw,
  Tag, CheckSquare, Square, Layers, Info
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
                      onClick={handleSyncFromInfosoft} 
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

              {/* Invoices & Settlements Tree Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-spruce-900 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-forest" />
                    جدول الفواتير التفصيلي وتوزيع السدادات بطريقة FIFO مع احتساب الخصم
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    عدد الفواتير: {statement.breakdown.length}
                  </span>
                </div>

                {/* Batch Selection Action Bar */}
                {selectedInvoiceIds.length > 0 && (
                  <div className="bg-teal-50 border-b border-teal-200 px-4 py-2.5 flex items-center justify-between no-print animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-teal-900">
                        تم تحديد {selectedInvoiceIds.length} فاتورة
                      </span>
                      <span className="text-[11px] text-teal-700">
                        (من إجمالي {statement.breakdown.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCategoryModal()}
                        disabled={isReadOnly}
                        className="px-3.5 py-1.5 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Tag className="w-3.5 h-3.5 text-gold-bronze" />
                        تغيير فئة الخصم للفواتير المحددة
                      </button>
                      <button
                        onClick={() => setSelectedInvoiceIds([])}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/80 text-spruce-900 border-b border-slate-200 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center no-print">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.length > 0 && selectedInvoiceIds.length === statement.breakdown.length}
                            onChange={handleToggleSelectAll}
                            disabled={isReadOnly || statement.breakdown.length === 0}
                            className="w-4 h-4 rounded text-teal-forest border-slate-300 focus:ring-teal-forest cursor-pointer"
                            title="تحديد كل الفواتير"
                          />
                        </th>
                        <th className="py-2.5 px-3">رقم الفاتورة</th>
                        <th className="py-2.5 px-3">التاريخ</th>
                        <th className="py-2.5 px-3">بيان الفاتورة (custnm)</th>
                        <th className="py-2.5 px-3">فئة الخصم</th>
                        <th className="py-2.5 px-3">الإجمالي (أصل)</th>
                        <th className="py-2.5 px-3">المرتجع</th>
                        <th className="py-2.5 px-3">الصافي</th>
                        <th className="py-2.5 px-3">نسبة الخصم</th>
                        <th className="py-2.5 px-3">المهلة</th>
                        <th className="py-2.5 px-3 text-gold-bronze">الخصم المعتمد</th>
                        <th className="py-2.5 px-3">المتبقي</th>
                        <th className="py-2.5 px-3">الحالة</th>
                        <th className="py-2.5 px-3 no-print">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statement.breakdown.length === 0 ? (
                        <tr>
                          <td colSpan="14" className="py-8 text-center text-slate-400">
                            لا توجد فواتير مسجلة لهذا العميل حتى الآن.
                          </td>
                        </tr>
                      ) : (
                        statement.breakdown.map((inv) => (
                          <React.Fragment key={inv.id}>
                            {/* Main Invoice Row */}
                            <tr className={`hover:bg-slate-50/80 transition-colors font-medium ${selectedInvoiceIds.includes(inv.id) ? 'bg-teal-50/40' : ''}`}>
                              <td className="py-3 px-3 w-8 text-center no-print">
                                <input
                                  type="checkbox"
                                  checked={selectedInvoiceIds.includes(inv.id)}
                                  onChange={() => handleToggleSelectInvoice(inv.id)}
                                  disabled={isReadOnly}
                                  className="w-4 h-4 rounded text-teal-forest border-slate-300 focus:ring-teal-forest cursor-pointer"
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-spruce-900">{inv.accounting_trans_id}</span>
                                  {inv.is_corrected === 1 && (
                                    <span className="text-[10px] bg-sand-light text-spruce-900 border border-sand-warm px-1 rounded">
                                      مصححة
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{inv.invoice_date}</td>
                              <td className="py-3 px-3 text-slate-700 max-w-xs truncate" title={inv.description}>
                                {inv.description || '-'}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shadow-xs ${
                                    inv.category_id === 1 
                                      ? 'bg-rose-50 text-rose-800 border-rose-300' 
                                      : inv.category_id === 2 
                                        ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                        : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  }`}>
                                    {inv.category_id === 1 ? '1. لا تشمل (0%)' : inv.category_id === 2 ? `2. مخفض (${(inv.discount_rate * 100).toFixed(1)}%)` : `3. عام (${(inv.discount_rate * 100).toFixed(1)}%)`}
                                  </span>
                                  {inv.is_category_manual === 1 && (
                                    <span className="text-[9px] text-teal-forest font-black" title="تم تحديد الفئة يدوياً من قبل المستخدم">
                                      ★ يدوي
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-800">{inv.gross_amount.toLocaleString()} ر.س</td>
                              <td className="py-3 px-3 text-rose-600">
                                {inv.total_returns > 0 ? `-${inv.total_returns.toLocaleString()} ر.س` : '-'}
                              </td>
                              <td className="py-3 px-3 font-bold text-spruce-900">{inv.net_total.toLocaleString()} ر.س</td>
                              <td className="py-3 px-3 text-slate-700 font-mono">{(inv.discount_rate * 100).toFixed(1)}%</td>
                              <td className="py-3 px-3 text-slate-700">{inv.grace_days} يوم</td>
                              <td className="py-3 px-3 font-black text-gold-bronze">
                                {inv.earned_discount > 0 ? `${inv.earned_discount.toLocaleString()} ر.س` : '0 ر.س'}
                              </td>
                              <td className="py-3 px-3 font-semibold">
                                {inv.remaining_unpaid > 0 ? (
                                  <span className="text-amber-800 font-bold">{inv.remaining_unpaid.toLocaleString()} ر.س</span>
                                ) : (
                                  <span className="text-teal-forest font-bold">0.00 ر.س</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                {inv.status === 'FULLY_PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-teal-forest/15 text-teal-forest font-bold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    مسددة بالكامل
                                  </span>
                                ) : inv.status === 'PARTIALLY_PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                                    مسددة جزئياً
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-medium">
                                    غير مسددة
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 no-print">
                                <div className="flex items-center gap-1.5">
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCategoryModal(inv.id)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-forest border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                      title="تغيير فئة الخصم لهذه الفاتورة عبر نافذة الاختيار"
                                    >
                                      <Tag className="w-3 h-3 text-gold-bronze" />
                                      تغيير الفئة
                                    </button>
                                  )}
                                  {!isReadOnly && (
                                    inv.is_exception_granted === 1 ? (
                                      <button
                                        onClick={() => handleRevokeException(inv.id)}
                                        className="text-[11px] text-gold-bronze hover:text-rose-700 underline font-bold"
                                        title={inv.exception_reason}
                                      >
                                        إلغاء الاستثناء
                                      </button>
                                    ) : (
                                      inv.settlements.some(s => !s.is_eligible) && (
                                        <button
                                          onClick={() => {
                                            setExceptionModalInv(inv);
                                            setExceptionReason('');
                                          }}
                                          className="text-[11px] bg-sand-light text-spruce-900 border border-sand-warm hover:bg-sand-warm px-2 py-1 rounded transition font-bold"
                                        >
                                          اعتماد استثنائي
                                        </button>
                                      )
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Exception Reason Banner */}
                            {inv.is_exception_granted === 1 && (
                              <tr className="bg-sand-light/50">
                                <td colSpan="14" className="py-1 px-4 text-xs text-spruce-900 border-b border-sand-warm">
                                  <span className="font-bold text-gold-bronze">ملاحظة الاستثناء الإداري:</span> تم اعتماد الخصم استثنائياً - التبرير: "{inv.exception_reason}"
                                </td>
                              </tr>
                            )}

                            {/* Nested Returns Rows */}
                            {inv.returns.map((ret) => (
                              <tr key={`ret-${ret.id}`} className="bg-rose-50/40 text-rose-800 text-[11px]">
                                <td className="py-1.5 px-3 pr-8" colSpan="6">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <CornerDownLeft className="w-3.5 h-3.5 text-rose-500" />
                                    <span>مرتجع بسند <strong>{ret.accounting_trans_id}</strong> بتاريخ {ret.adjustment_date}</span>
                                    {ret.linked_invoice_year === '2025' && (
                                      <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-200 rounded font-bold text-[10px]">
                                        مرتجع من السنة السابقة (2025)
                                      </span>
                                    )}
                                    <span className="text-[10px] px-1.5 py-0.2 bg-white/80 border border-rose-200 rounded font-semibold text-rose-900">
                                      فئة الخصم: {ret.category_name || (ret.category_id === 1 ? 'لا تشمل' : (ret.category_id === 2 ? 'مخفض' : 'عام'))}
                                    </span>
                                    {ret.notes && <span className="text-slate-500">({ret.notes})</span>}
                                  </div>
                                </td>
                                <td className="py-1.5 px-3 font-bold text-rose-700">-{ret.amount.toLocaleString()} ر.س</td>
                                <td colSpan="7" className="py-1.5 px-3 text-slate-500 text-[10px]">
                                  (محسوم من فئة الفاتورة الأصلية المقابلة)
                                </td>
                              </tr>
                            ))}

                            {/* Nested Settlement / Payment Rows */}
                            {inv.settlements.map((settle, sIdx) => (
                              <tr key={`settle-${sIdx}`} className="bg-teal-forest/5 text-slate-700 text-[11px]">
                                <td className="py-1.5 px-3 pr-8" colSpan="7">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownLeft className="w-3.5 h-3.5 text-teal-forest" />
                                    <span>
                                      سداد بسند قبض رقم <strong className="text-spruce-900">{settle.payment_trans_id}</strong> بتاريخ {settle.payment_date}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-3 font-bold text-spruce-900">
                                  +{settle.amount_applied.toLocaleString()} ر.س
                                </td>
                                <td colSpan="2" className="py-1.5 px-3">
                                  <span className="text-slate-600">
                                    الفارق: <strong>{settle.diff_days}</strong> يوماً (المهلة: {settle.grace_days} يوم)
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 font-black text-gold-bronze">
                                  {settle.discount_earned > 0 ? `+${settle.discount_earned.toLocaleString()} ر.س` : '0 ر.س'}
                                </td>
                                <td colSpan="3" className="py-1.5 px-3">
                                  {settle.is_eligible ? (
                                    <span className="inline-flex items-center gap-1 text-teal-forest font-bold">
                                      <ShieldCheck className="w-3 h-3 text-teal-forest" />
                                      {inv.is_exception_granted === 1 && settle.diff_days > settle.grace_days
                                        ? 'مؤهل (معتمد باستثناء)'
                                        : 'مؤهل للخصم (ضمن المهلة)'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      غير مؤهل (سداد متأخر بعد المهلة)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
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
