import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckCircle2, AlertTriangle, 
  ShieldCheck, CornerDownLeft, Clock, Sparkles
} from 'lucide-react';

export default function CustomerStatementModal({ customerId, isOpen, onClose, onRefreshRequired, isReadOnly }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exceptionModalInv, setExceptionModalInv] = useState(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) {
      loadStatement();
    }
  }, [isOpen, customerId]);

  const loadStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.getCustomerStatement(customerId);
      setStatement(data);
    } catch (err) {
      setError(err.message || 'فشل في تحميل كشف الحساب.');
    } finally {
      setLoading(false);
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

  const handlePrint = async () => {
    try {
      await window.api.printStatement();
    } catch (err) {
      window.print();
    }
  };

  const handleExportPdf = async () => {
    if (!statement) return;
    try {
      setExportingPdf(true);
      const filePath = await window.api.exportStatementPDF(
        statement.customer.name,
        statement.customer.accounting_system_id
      );
      if (filePath) {
        alert(`تم تصدير كشف الحساب بنجاح إلى:\n${filePath}`);
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

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/80 text-spruce-900 border-b border-slate-200 uppercase font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">رقم الفاتورة</th>
                        <th className="py-2.5 px-3">التاريخ</th>
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
                          <td colSpan="11" className="py-8 text-center text-slate-400">
                            لا توجد فواتير مسجلة لهذا العميل حتى الآن.
                          </td>
                        </tr>
                      ) : (
                        statement.breakdown.map((inv) => (
                          <React.Fragment key={inv.id}>
                            {/* Main Invoice Row */}
                            <tr className="hover:bg-slate-50/80 transition-colors font-medium">
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
                              <td className="py-3 px-3 text-slate-600">{inv.invoice_date}</td>
                              <td className="py-3 px-3 font-semibold text-slate-800">{inv.gross_amount.toLocaleString()} ر.س</td>
                              <td className="py-3 px-3 text-rose-600">
                                {inv.total_returns > 0 ? `-${inv.total_returns.toLocaleString()} ر.س` : '-'}
                              </td>
                              <td className="py-3 px-3 font-bold text-spruce-900">{inv.net_total.toLocaleString()} ر.س</td>
                              <td className="py-3 px-3 text-slate-700">{(inv.discount_rate * 100).toFixed(1)}%</td>
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
                              </td>
                            </tr>

                            {/* Exception Reason Banner */}
                            {inv.is_exception_granted === 1 && (
                              <tr className="bg-sand-light/50">
                                <td colSpan="11" className="py-1 px-4 text-xs text-spruce-900 border-b border-sand-warm">
                                  <span className="font-bold text-gold-bronze">ملاحظة الاستثناء الإداري:</span> تم اعتماد الخصم استثنائياً - التبرير: "{inv.exception_reason}"
                                </td>
                              </tr>
                            )}

                            {/* Nested Returns Rows */}
                            {inv.returns.map((ret) => (
                              <tr key={`ret-${ret.id}`} className="bg-rose-50/40 text-rose-800 text-[11px]">
                                <td className="py-1.5 px-3 pr-8" colSpan="3">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownLeft className="w-3.5 h-3.5 text-rose-500" />
                                    <span>مرتجع/تالف بسند <strong>{ret.accounting_trans_id}</strong> بتاريخ {ret.adjustment_date}</span>
                                    {ret.notes && <span className="text-slate-500">({ret.notes})</span>}
                                  </div>
                                </td>
                                <td className="py-1.5 px-3 font-bold">-{ret.amount.toLocaleString()} ر.س</td>
                                <td colSpan="7" className="py-1.5 px-3 text-slate-500 text-[10px]">
                                  (تم خفض وعاء الفاتورة وصافيها تلقائياً)
                                </td>
                              </tr>
                            ))}

                            {/* Nested Settlement / Payment Rows */}
                            {inv.settlements.map((settle, sIdx) => (
                              <tr key={`settle-${sIdx}`} className="bg-teal-forest/5 text-slate-700 text-[11px]">
                                <td className="py-1.5 px-3 pr-8" colSpan="4">
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
    </div>
  );
}
