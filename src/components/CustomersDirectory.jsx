import React, { useState, useEffect } from 'react';
import { 
  Users, Search, DollarSign, TrendingUp, 
  AlertCircle, Edit, Trash2, Mail, Phone, Hash, 
  CheckCircle2, FileText, Send, Sparkles, Check, RotateCw,
  ShieldCheck, X
} from 'lucide-react';
import CustomerStatementModal from './CustomerStatementModal';

const rateToPercent = (rate, defaultVal = 0) => {
  if (rate === undefined || rate === null || isNaN(rate)) return defaultVal;
  return Math.round((Number(rate) * 100 + Number.EPSILON) * 100) / 100;
};

export default function CustomersDirectory({ isReadOnly }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  // Statement Modal State
  const [statementCustomerId, setStatementCustomerId] = useState(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Customer Settings Modal (Edit Terms & Contact)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    accounting_system_id: '',
    email: '',
    phone: '',
    default_discount_rate: 7,
    default_grace_days: 30,
    cat1_discount_rate: 0,
    cat2_discount_rate: 3,
    cat3_discount_rate: 7
  });
  const [modalError, setModalError] = useState(null);

  // InfoSoft Sync Modal State
  const [isInfosoftSyncModalOpen, setIsInfosoftSyncModalOpen] = useState(false);
  const [infosoftCustomersList, setInfosoftCustomersList] = useState([]);
  const [loadingInfosoftCusts, setLoadingInfosoftCusts] = useState(false);
  const [infosoftFilter, setInfosoftFilter] = useState('');
  const [syncingId, setSyncingId] = useState(null);

  // Welcome Email Sending State & Notifications
  const [sendingWelcomeId, setSendingWelcomeId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const list = await window.api.getAllCustomers();
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (cust) => {
    setEditingCustomer(cust);
    setCustomerForm({
      name: cust.name,
      accounting_system_id: cust.accounting_system_id,
      email: cust.email || '',
      phone: cust.phone || '',
      default_discount_rate: rateToPercent(cust.default_discount_rate, 7),
      default_grace_days: cust.default_grace_days || 30,
      cat1_discount_rate: rateToPercent(cust.cat1_discount_rate, 0),
      cat2_discount_rate: rateToPercent(cust.cat2_discount_rate, 3),
      cat3_discount_rate: rateToPercent(cust.cat3_discount_rate, 7)
    });
    setModalError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e, shouldSendWelcome = false) => {
    if (e) e.preventDefault();
    if (!editingCustomer) return;
    setModalError(null);

    try {
      const payload = {
        name: editingCustomer.name,
        accounting_system_id: editingCustomer.accounting_system_id,
        email: customerForm.email.trim(),
        phone: customerForm.phone.trim() || null,
        default_discount_rate: Math.round(parseFloat(customerForm.cat3_discount_rate || customerForm.default_discount_rate) * 100) / 10000,
        default_grace_days: parseInt(customerForm.default_grace_days, 10),
        cat1_discount_rate: Math.round(parseFloat(customerForm.cat1_discount_rate) * 100) / 10000,
        cat2_discount_rate: Math.round(parseFloat(customerForm.cat2_discount_rate) * 100) / 10000,
        cat3_discount_rate: Math.round(parseFloat(customerForm.cat3_discount_rate) * 100) / 10000
      };

      const savedCustomer = await window.api.updateCustomer(editingCustomer.id, payload);
      setIsCustomerModalOpen(false);
      await loadCustomers();

      // If user requested to send welcome email upon saving
      if (shouldSendWelcome && savedCustomer?.id) {
        await handleSendWelcomeEmail(savedCustomer.id, savedCustomer.email);
      } else {
        showToast('تم تحديث شروط الخصم وبيانات التواصل بنجاح.');
      }
    } catch (err) {
      setModalError(err.message || 'حدث خطأ أثناء حفظ شروط العميل.');
    }
  };

  const handleOpenInfosoftSync = async () => {
    try {
      setIsInfosoftSyncModalOpen(true);
      setLoadingInfosoftCusts(true);
      const list = await window.api.infosoft.getCustomers();
      setInfosoftCustomersList(list || []);
    } catch (err) {
      alert('تعذر جلب قائمة عملاء إنفوسوفت: ' + err.message);
    } finally {
      setLoadingInfosoftCusts(false);
    }
  };

  const handleSyncCustomerDirectly = async (cust) => {
    try {
      setSyncingId(cust.accounting_system_id);
      await window.api.infosoft.syncCustomer(cust.accounting_system_id, {
        email: cust.email || '',
        cat1_discount_rate: 0.00,
        cat2_discount_rate: 0.03,
        cat3_discount_rate: 0.07,
        grace_days: 30
      });
      await loadCustomers();
      showToast(`تمت مزامنة العميل [${cust.name}] من إنفوسوفت بنجاح.`);
    } catch (err) {
      alert('خطأ أثناء المزامنة: ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllAccounts = async () => {
    try {
      setIsBatchSyncing(true);
      const res = await window.api.infosoft.syncAllCustomers();
      if (res && res.success) {
        showToast(`تمت مزامنة دليل الحسابات بنجاح: تم استيراد ${res.addedCount} جديد وتحديث ${res.updatedCount} عميل.`);
        await loadCustomers();
      } else {
        alert(res?.message || 'تعذر مزامنة الحسابات من إنفوسوفت.');
      }
    } catch (err) {
      alert('خطأ أثناء مزامنة كافة الحسابات: ' + err.message);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleSendWelcomeEmail = async (customerId, targetEmail) => {
    try {
      setSendingWelcomeId(customerId);
      await window.api.sendWelcomeEmail(customerId);
      showToast(`تم إرسال البريد الترحيبي بنظام الخصم الذكي بنجاح إلى: ${targetEmail}`);
    } catch (err) {
      alert(`تعذر إرسال البريد الترحيبي: ${err.message}`);
    } finally {
      setSendingWelcomeId(null);
    }
  };

  const handleDeleteCustomer = async (cust) => {
    if (isReadOnly) return;
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${cust.name}"؟`)) return;

    try {
      await window.api.deleteCustomer(cust.id);
      await loadCustomers();
      showToast('تم حذف العميل بنجاح.');
    } catch (err) {
      alert(err.message);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.accounting_system_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Overall Directory Aggregates
  const totalNetSalesAll = customers.reduce((sum, c) => sum + (c.total_net_sales || 0), 0);
  const totalRebateAll = customers.reduce((sum, c) => sum + (c.total_rebate_earned || 0), 0);
  const totalUnpaidAll = customers.reduce((sum, c) => sum + (c.total_remaining_unpaid || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-spruce-900 text-sand-warm px-5 py-3 rounded-xl shadow-corporate-lg border border-teal-forest flex items-center gap-2.5 text-xs font-bold animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-gold-bronze" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Corporate KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-corporate border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-spruce-900">صافي المبيعات الكلي</span>
            <div className="p-2 bg-slate-50 text-teal-forest rounded-xl border border-slate-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-spruce-900 tracking-tight">
            {totalNetSalesAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">إجمالي المبيعات بعد خصم المرتجعات</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-corporate border border-sand-warm/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-gold-bronze"></div>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-spruce-900">إجمالي الخصم المجمع المعتمد</span>
            <div className="p-2 bg-sand-light text-gold-bronze rounded-xl border border-sand-warm/40">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gold-bronze tracking-tight">
            {totalRebateAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">الرصيد التراكمي المكتسب للتسوية السنوية</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-corporate border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-spruce-900">المبالغ غير المسددة</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 tracking-tight">
            {totalUnpaidAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">إجمالي الفواتير المفتوحة لدى العملاء</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-corporate border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-spruce-900">عدد العملاء المعتمدين</span>
            <div className="p-2 bg-teal-forest/10 text-teal-forest rounded-xl border border-teal-forest/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-spruce-900 tracking-tight">
            {customers.length} <span className="text-xs font-normal text-slate-400">عميل</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">قاعدة العملاء المسجلة بالنظام</div>
        </div>
      </div>

      {/* Control Bar: Search & Actions */}
      <div className="bg-white p-4 rounded-2xl shadow-corporate border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث فوري باسم العميل أو رقمه المحاسبي..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:ring-1 focus:ring-teal-forest focus:outline-none transition text-spruce-900"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleSyncAllAccounts}
            disabled={isBatchSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-spruce-900 hover:bg-spruce-800 text-sand-warm rounded-xl text-xs font-bold shadow-sm transition border border-teal-forest"
            title="مزامنة وتحديث كافة حسابات العملاء من قاعدة بيانات إنفوسوفت ERP"
          >
            <RotateCw className={`w-4 h-4 text-gold-bronze ${isBatchSyncing ? 'animate-spin' : ''}`} />
            {isBatchSyncing ? 'جاري المزامنة...' : 'مزامنة كافة الحسابات'}
          </button>
          <button
            onClick={handleOpenInfosoftSync}
            className="flex items-center gap-2 px-4 py-2.5 bg-spruce-900 hover:bg-spruce-800 text-sand-warm rounded-xl text-xs font-bold shadow-sm transition border border-teal-forest"
          >
            <Sparkles className="w-4 h-4 text-gold-bronze" />
            استيراد من إنفوسوفت ERP
          </button>
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-2xl shadow-corporate border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 text-spruce-900 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">العميل والرقم المحاسبي</th>
                <th className="py-3 px-4">بيانات التواصل</th>
                <th className="py-3 px-4">الشروط المعتمدة</th>
                <th className="py-3 px-4">صافي المبيعات</th>
                <th className="py-3 px-4 text-gold-bronze">الخصم المجمع المعتمد</th>
                <th className="py-3 px-4">الرصيد المالي</th>
                <th className="py-3 px-4">الفواتير</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    جاري تحميل دليل العملاء المعتمدين...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    {searchQuery ? 'لا توجد نتائج مطابقة لبحثك.' : 'لم يتم تسجيل أي عملاء حتى الآن.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-xs text-spruce-900">{cust.name}</div>
                      <div className="text-[11px] text-teal-forest font-mono mt-0.5 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-slate-400" />
                        {cust.accounting_system_id}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{cust.email}</span>
                      </div>
                      {cust.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{cust.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-semibold">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-rose-600 font-bold" title="فئة 1: لا تشمل">ف1: {rateToPercent(cust.cat1_discount_rate, 0)}%</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-amber-600 font-bold" title="فئة 2: مخفض">ف2: {rateToPercent(cust.cat2_discount_rate, 3)}%</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-600 font-bold" title="فئة 3: عام">ف3: {rateToPercent(cust.cat3_discount_rate !== undefined ? cust.cat3_discount_rate : (cust.default_discount_rate || 0.07), 7)}%</span>
                      </div>
                      <div className="text-slate-400 text-[10px] font-normal">{cust.default_grace_days || 30} يوم مهلة سداد</div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-spruce-900">
                      {cust.total_net_sales?.toLocaleString() || 0} ر.س
                    </td>

                    <td className="py-3.5 px-4 font-black text-sm text-gold-bronze">
                      {cust.total_rebate_earned?.toLocaleString() || 0} ر.س
                    </td>

                    <td className="py-3.5 px-4 font-bold">
                      {cust.customer_balance > 0 ? (
                        <span className="text-amber-800 font-semibold">{cust.customer_balance.toLocaleString()} ر.س</span>
                      ) : cust.customer_balance < 0 ? (
                        <span className="text-teal-forest font-semibold">دائن: {Math.abs(cust.customer_balance).toLocaleString()} ر.س</span>
                      ) : (
                        <span className="text-slate-400 font-normal">خالص</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-medium">{cust.invoice_count} فاتورة</div>
                      {cust.unpaid_invoice_count > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold">
                          ({cust.unpaid_invoice_count} معلقة)
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {/* Statement Modal Button - Primary Action */}
                        <button
                          onClick={() => {
                            setStatementCustomerId(cust.id);
                            setIsStatementOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-spruce-900 text-sand-warm hover:bg-spruce-800 rounded-xl text-xs font-bold transition shadow-sm border border-teal-forest"
                          title="عرض وتدقيق كشف الحساب التفصيلي وشجرة الحركات"
                        >
                          <FileText className="w-3.5 h-3.5 text-gold-bronze" />
                          كشف الحساب والتدقيق
                        </button>

                        {!isReadOnly && (
                          <>
                            {/* Welcome Email Button */}
                            <button
                              onClick={() => handleSendWelcomeEmail(cust.id, cust.email)}
                              disabled={sendingWelcomeId === cust.id}
                              className="p-1.5 bg-teal-forest/10 hover:bg-teal-forest text-teal-forest hover:text-white rounded-lg text-xs transition border border-teal-forest/20"
                              title="إرسال بريد ترحيبي وتعريفي بنظام الخصم الذكي"
                            >
                              <Send className={`w-3.5 h-3.5 ${sendingWelcomeId === cust.id ? 'animate-pulse' : ''}`} />
                            </button>

                            {/* Edit Customer Settings Button */}
                            <button
                              onClick={() => handleOpenEditModal(cust)}
                              className="p-1.5 text-slate-500 hover:text-spruce-900 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200"
                              title="تعديل شروط ونسب الخصم والبريد للعميل"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button (only if 0 invoices) */}
                            {cust.invoice_count === 0 && (
                              <button
                                onClick={() => handleDeleteCustomer(cust)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="حذف العميل"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement Modal */}
      {isStatementOpen && (
        <CustomerStatementModal
          customerId={statementCustomerId}
          isOpen={isStatementOpen}
          onClose={() => setIsStatementOpen(false)}
          onRefreshRequired={loadCustomers}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Customer Settings & Terms Modal (Edit only - No manual customer creation) */}
      {isCustomerModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-spruce-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-corporate-lg max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-spruce-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-forest" />
                تعديل شروط ونسب الخصم والاتصال للعميل
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-only Customer Info Banner */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl mb-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-medium">اسم العميل:</span>
                  <span className="font-bold text-spruce-900 mr-1.5">{editingCustomer.name}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-teal-forest font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>{editingCustomer.accounting_system_id}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                * الحساب مرتبط ومزامن آلياً من قاعدة بيانات إنفوسوفت ERP.
              </div>
            </div>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-spruce-900 mb-1">البريد الإلكتروني للإشعارات:</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="client@domain.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-spruce-900 mb-1">رقم الهاتف (اختياري):</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-bold text-spruce-900 mb-2">معدلات الخصم المعتمدة للفئات الثلاث (إنفوسوفت):</label>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2 bg-rose-50/60 border border-rose-200 rounded-xl">
                    <label className="block text-[11px] font-bold text-rose-800 mb-1">فئة 1 (لا تشمل):</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        value={customerForm.cat1_discount_rate}
                        onChange={(e) => setCustomerForm({ ...customerForm, cat1_discount_rate: e.target.value })}
                        className="w-full p-1.5 bg-white border border-rose-300 rounded-lg focus:outline-none text-center font-bold text-xs"
                      />
                      <span className="text-xs text-rose-700 font-bold">%</span>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-xl">
                    <label className="block text-[11px] font-bold text-amber-800 mb-1">فئة 2 (مخفض):</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        value={customerForm.cat2_discount_rate}
                        onChange={(e) => setCustomerForm({ ...customerForm, cat2_discount_rate: e.target.value })}
                        className="w-full p-1.5 bg-white border border-amber-300 rounded-lg focus:outline-none text-center font-bold text-xs"
                      />
                      <span className="text-xs text-amber-700 font-bold">%</span>
                    </div>
                  </div>

                  <div className="p-2 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <label className="block text-[11px] font-bold text-emerald-800 mb-1">فئة 3 (عام):</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        value={customerForm.cat3_discount_rate}
                        onChange={(e) => setCustomerForm({ ...customerForm, cat3_discount_rate: e.target.value })}
                        className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg focus:outline-none text-center font-bold text-xs"
                      />
                      <span className="text-xs text-emerald-700 font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-spruce-900 mb-1">مهلة السداد (بالأيام):</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={customerForm.default_grace_days}
                  onChange={(e) => setCustomerForm({ ...customerForm, default_grace_days: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none font-bold"
                />
              </div>

              {/* Action Buttons inside Modal */}
              <div className="pt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSaveCustomer(e, true)}
                  disabled={!customerForm.email}
                  className="w-full py-2.5 px-4 bg-sand-light hover:bg-sand-warm text-spruce-900 border border-sand-warm rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-gold-bronze" />
                  حفظ الشروط وإرسال بريد ترحيبي بالخصم الذكي للعميل
                </button>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSaveCustomer(e, false)}
                    className="px-5 py-2 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl font-bold shadow-sm"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* InfoSoft Sync Modal */}
      {isInfosoftSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-spruce-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-corporate-lg max-w-2xl w-full p-6 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-black text-spruce-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold-bronze" />
                  استيراد ومزامنة العملاء من قاعدة بيانات إنفوسوفت ERP
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  جلب قائمة الحسابات من localhost,49916 ومزامنة الفواتير والمرتجعات والسدادات تلقائياً وتصنيف الفئات الثلاث.
                </p>
              </div>
              <button
                onClick={() => setIsInfosoftSyncModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Filter */}
            <div className="mb-3">
              <input
                type="text"
                value={infosoftFilter}
                onChange={(e) => setInfosoftFilter(e.target.value)}
                placeholder="ابحث باسم العميل أو رقمه في إنفوسوفت..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
              />
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {loadingInfosoftCusts ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  جاري جلب قائمة العملاء من قاعدة بيانات إنفوسوفت...
                </div>
              ) : infosoftCustomersList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لم يتم العثور على عملاء في إنفوسوفت أو تعذر الاتصال بالقاعدة.
                </div>
              ) : (
                infosoftCustomersList
                  .filter(c => 
                    !infosoftFilter || 
                    c.name.toLowerCase().includes(infosoftFilter.toLowerCase()) || 
                    c.accounting_system_id.toLowerCase().includes(infosoftFilter.toLowerCase())
                  )
                  .map(cust => {
                    const isAlreadyImported = customers.some(c => String(c.accounting_system_id) === String(cust.accounting_system_id));
                    const isSyncing = syncingId === cust.accounting_system_id;

                    return (
                      <div key={cust.accounting_system_id} className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                        <div>
                          <div className="font-bold text-xs text-spruce-900 flex items-center gap-2">
                            <span>{cust.name}</span>
                            {isAlreadyImported && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-teal-forest/10 text-teal-forest font-bold">
                                موجود بالنظام
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            رقم الحساب: #{cust.accounting_system_id}
                          </div>
                        </div>

                        <div>
                          <button
                            onClick={() => handleSyncCustomerDirectly(cust)}
                            disabled={isSyncing}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                              isSyncing 
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                                : isAlreadyImported 
                                  ? 'bg-sand-light hover:bg-sand-warm text-spruce-900 border border-sand-warm' 
                                  : 'bg-teal-forest hover:bg-teal-forest-hover text-sand-warm'
                            }`}
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'جاري المزامنة...' : isAlreadyImported ? 'إعادة مزامنة وتحديث' : 'استيراد ومزامنة'}
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
              <span>إجمالي العملاء المتوفرين في إنفوسوفت: <strong>{infosoftCustomersList.length}</strong></span>
              <button
                onClick={() => setIsInfosoftSyncModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
