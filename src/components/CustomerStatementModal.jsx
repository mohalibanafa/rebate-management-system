import React, { useState, useEffect } from 'react';
import { 
  X, Printer, FileText, CheckCircle2, AlertTriangle, 
  HelpCircle, ShieldCheck, CornerDownLeft, Calendar, 
  DollarSign, ArrowDownRight, ArrowUpRight, Percent, Clock
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                كشف حساب وتدقيق خصم تعجيل الدفع المجمع
                {isReadOnly && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
                    أرشيف - للقراءة فقط
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-400">
                العميل: <strong className="text-white">{statement?.customer?.name || 'جاري التحميل...'}</strong> | الرقم المحاسبي: <strong className="text-blue-400">{statement?.customer?.accounting_system_id}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-sm"
            >
              <FileText className="w-4 h-4" />
              {exportingPdf ? 'جاري التصدير...' : 'تصدير PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              جاري فحص الحركات وإعادة الاحتساب اللحظي...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl">
              {error}
            </div>
          ) : statement ? (
            <>
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500 mb-1">إجمالي المبيعات (أصل)</div>
                  <div className="text-lg font-bold text-slate-800">{statement.totalGrossSales.toLocaleString()} <span className="text-xs font-normal">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-xs text-rose-600 mb-1">إجمالي المرتجعات والتوالف</div>
                  <div className="text-lg font-bold text-rose-700">-{statement.totalReturns.toLocaleString()} <span className="text-xs font-normal">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="text-xs text-blue-700 mb-1">صافي المبيعات الفعلي</div>
                  <div className="text-lg font-bold text-blue-800">{statement.totalNetSales.toLocaleString()} <span className="text-xs font-normal">ر.س</span></div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs text-emerald-700 mb-1">رصيد الخصم المجمع المعتمد</div>
                  <div className="text-xl font-black text-emerald-600">
                    {statement.totalRebateEarned.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-500 mb-1">إجمالي السدادات المستلمة</div>
                  <div className="text-lg font-bold text-slate-700">{statement.totalPayments.toLocaleString()} <span className="text-xs font-normal">ر.س</span></div>
                </div>

                <div className={`p-3.5 rounded-xl border ${statement.customerBalance > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <div className="text-xs mb-1 font-medium">
                    {statement.customerBalance > 0 ? 'المتبقي بذمة العميل' : 'رصيد دائن فائض (مقدم)'}
                  </div>
                  <div className="text-lg font-bold">
                    {Math.abs(statement.customerBalance).toLocaleString()} <span className="text-xs font-normal">ر.س</span>
                  </div>
                </div>
              </div>

              {/* Invoices & Settlements Tree Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    سجل الفواتير وتوزيع السدادات بطريقة FIFO مع فحص مهلة الخصم
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    عدد الفواتير: {statement.breakdown.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">رقم الفاتورة</th>
                        <th className="py-2.5 px-3">تاريخ الفاتورة</th>
                        <th className="py-2.5 px-3">إجمالي الأصل</th>
                        <th className="py-2.5 px-3">المرتجع/تالف</th>
                        <th className="py-2.5 px-3">الصافي</th>
                        <th className="py-2.5 px-3">نسبة الخصم</th>
                        <th className="py-2.5 px-3">مهلة السماح</th>
                        <th className="py-2.5 px-3">الخصم المعتمد</th>
                        <th className="py-2.5 px-3">المتبقي للسداد</th>
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
                                  <span className="font-bold text-blue-900">{inv.accounting_trans_id}</span>
                                  {inv.is_corrected === 1 && (
                                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-normal">
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
                              <td className="py-3 px-3 font-bold text-slate-900">{inv.net_total.toLocaleString()} ر.س</td>
                              <td className="py-3 px-3 text-slate-700">{(inv.discount_rate * 100).toFixed(1)}%</td>
                              <td className="py-3 px-3 text-slate-700">{inv.grace_days} يوم</td>
                              <td className="py-3 px-3 font-bold text-emerald-600">
                                {inv.earned_discount > 0 ? `${inv.earned_discount.toLocaleString()} ر.س` : '0 ر.س'}
                              </td>
                              <td className="py-3 px-3 font-semibold">
                                {inv.remaining_unpaid > 0 ? (
                                  <span className="text-amber-600">{inv.remaining_unpaid.toLocaleString()} ر.س</span>
                                ) : (
                                  <span className="text-emerald-600">0.00 ر.س</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                {inv.status === 'FULLY_PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    مسددة بالكامل
                                  </span>
                                ) : inv.status === 'PARTIALLY_PAID' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800 font-semibold">
                                    مسددة جزئياً
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 font-semibold">
                                    غير مسددة
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 no-print">
                                {!isReadOnly && (
                                  inv.is_exception_granted === 1 ? (
                                    <button
                                      onClick={() => handleRevokeException(inv.id)}
                                      className="text-[11px] text-purple-700 hover:text-red-700 underline font-medium"
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
                                        className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-2 py-1 rounded transition"
                                      >
                                        اعتماد استثنائي
                                      </button>
                                    )
                                  )
                                )}
                              </td>
                            </tr>

                            {/* Exception Reason Banner if granted */}
                            {inv.is_exception_granted === 1 && (
                              <tr className="bg-purple-50/50">
                                <td colSpan="11" className="py-1 px-4 text-xs text-purple-900 border-b border-purple-100">
                                  <span className="font-bold">ملاحظة الاستثناء الإداري:</span> تم اعتماد الخصم استثنائياً - التبرير: "{inv.exception_reason}"
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
                                    {ret.is_corrected === 1 && <span className="bg-rose-200 text-rose-900 px-1 rounded text-[10px]">مصححة</span>}
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
                              <tr key={`settle-${sIdx}`} className="bg-blue-50/30 text-slate-700 text-[11px]">
                                <td className="py-1.5 px-3 pr-8" colSpan="4">
                                  <div className="flex items-center gap-1.5">
                                    <CornerDownLeft className="w-3.5 h-3.5 text-blue-500" />
                                    <span>
                                      سداد بسند قبض رقم <strong className="text-blue-900">{settle.payment_trans_id}</strong> بتاريخ {settle.payment_date}
                                    </span>
                                    {settle.is_corrected === 1 && (
                                      <span className="bg-blue-200 text-blue-900 px-1 rounded text-[10px]">مصححة</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-1.5 px-3 font-semibold text-slate-900">
                                  +{settle.amount_applied.toLocaleString()} ر.س
                                </td>
                                <td colSpan="2" className="py-1.5 px-3">
                                  <span className="text-slate-600">
                                    الفارق: <strong>{settle.diff_days}</strong> يوماً (المهلة: {settle.grace_days} يوم)
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 font-bold text-emerald-700">
                                  {settle.discount_earned > 0 ? `+${settle.discount_earned.toLocaleString()} ر.س` : '0 ر.س'}
                                </td>
                                <td colSpan="3" className="py-1.5 px-3">
                                  {settle.is_eligible ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      {inv.is_exception_granted === 1 && settle.diff_days > settle.grace_days
                                        ? 'مؤهل (معتمد باستثناء)'
                                        : 'مؤهل للخصم (ضمن المهلة)'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
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
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Grant Exception Justification Dialog */}
      {exceptionModalInv && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              اعتماد الخصم استثنائياً للفاتورة رقم {exceptionModalInv.accounting_trans_id}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              هذه الفاتورة تم سدادها بعد انقضاء مهلة السماح. يرجى تدوين سبب وتبرير منح الاستثناء لتوثيقه في سجل التدقيق:
            </p>
            <form onSubmit={handleGrantException} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الاستثناء (إلزامي):</label>
                <textarea
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="مثال: تأخر في التحويل البنكي بسبب إجازة رسمية / موافقة المدير العام..."
                  required
                  rows="3"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExceptionModalInv(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!exceptionReason.trim()}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
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
