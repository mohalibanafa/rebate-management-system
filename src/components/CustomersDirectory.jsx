import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, DollarSign, TrendingUp, 
  AlertCircle, Edit, Trash2, Hash, 
  CheckCircle2, FileText, Send, Sparkles, Check, RotateCw,
  ShieldCheck, X, Filter
} from 'lucide-react';
import CustomerStatementModal from './CustomerStatementModal';

const rateToPercent = (rate, defaultVal = 0) => {
  if (rate === undefined || rate === null || isNaN(rate)) return defaultVal;
  return Math.round((Number(rate) * 100 + Number.EPSILON) * 100) / 100;
};

export default function CustomersDirectory({ isReadOnly }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNPAID' | 'SETTLED'
  const [loading, setLoading] = useState(true);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  // Statement Modal State
  const [statementCustomerId, setStatementCustomerId] = useState(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Customer Settings Modal
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
      setCustomers(list || []);
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

      if (shouldSendWelcome && savedCustomer?.id) {
        await handleSendWelcomeEmail(savedCustomer.id, savedCustomer.email);
      } else {
        showToast('تم حفظ التعديلات بنجاح.');
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
      showToast(`تمت مزامنة العميل [${cust.name}] بنجاح.`);
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
        showToast(`تم تحديث الحسابات: ${res.addedCount} جديد، ${res.updatedCount} محدث.`);
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
      showToast(`تم إرسال الإشعار الترحيبي إلى: ${targetEmail}`);
    } catch (err) {
      alert(`تعذر الإرسال: ${err.message}`);
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
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter & Sort Logic
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.accounting_system_id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'UNPAID') return (c.customer_balance || 0) > 0;
      if (statusFilter === 'SETTLED') return (c.customer_balance || 0) <= 0;

      return true;
    }).sort((a, b) => (b.total_net_sales || 0) - (a.total_net_sales || 0));
  }, [customers, searchQuery, statusFilter]);

  // Aggregates
  const totalNetSalesAll = customers.reduce((sum, c) => sum + (c.total_net_sales || 0), 0);
  const totalRebateAll = customers.reduce((sum, c) => sum + (c.total_rebate_earned || 0), 0);
  const totalUnpaidAll = customers.reduce((sum, c) => sum + (c.total_remaining_unpaid || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean 3 Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1">إجمالي المبيعات الصافية</div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {totalNetSalesAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1">إجمالي الخصم المعتمد المستحق</div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {totalRebateAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="text-xs text-slate-500 font-medium mb-1">المبالغ غير المسددة</div>
          <div className="text-2xl font-bold font-mono text-rose-700">
            {totalUnpaidAll.toLocaleString()} <span className="text-xs font-normal text-slate-400">ر.س</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Simple Search & Sync */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العميل أو رقمه المحاسبي..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-slate-400 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              الكل ({customers.length})
            </button>
            <button
              onClick={() => setStatusFilter('UNPAID')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'UNPAID' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              عليهم مستحقات
            </button>
            <button
              onClick={() => setStatusFilter('SETTLED')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'SETTLED' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              خالصين
            </button>
          </div>

          <button
            onClick={handleSyncAllAccounts}
            disabled={isBatchSyncing}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition border border-slate-200"
            title="مزامنة شاملة من إنفوسوفت"
          >
            <RotateCw className={`w-4 h-4 ${isBatchSyncing ? 'animate-spin text-teal-600' : ''}`} />
          </button>

          <button
            onClick={handleOpenInfosoftSync}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition"
          >
            استيراد من إنفوسوفت ERP
          </button>
        </div>
      </div>

      {/* Clean 4-Column Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-6">العميل والحساب</th>
                <th className="py-3 px-4 text-left">صافي المبيعات</th>
                <th className="py-3 px-4 text-left text-emerald-800 font-bold">الخصم المعتمد المستحق</th>
                <th className="py-3 px-4 text-left">الموقف المالي</th>
                <th className="py-3 px-6 text-center w-40">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400 text-xs font-sans">
                    جاري تحميل دليل العملاء...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400 text-xs font-sans">
                    لا توجد نتائج مطابقة.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const hasDebt = (cust.customer_balance || 0) > 0;
                  const isCredit = (cust.customer_balance || 0) < 0;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      
                      {/* Customer Name & Account */}
                      <td className="py-4 px-6 font-sans">
                        <div className="font-bold text-slate-900 text-xs">
                          {cust.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          #{cust.accounting_system_id}
                        </div>
                      </td>

                      {/* Net Sales */}
                      <td className="py-4 px-4 text-left text-slate-800 font-mono font-bold text-sm">
                        {cust.total_net_sales?.toLocaleString() || 0} <span className="text-xs font-normal text-slate-400 font-sans">ر.س</span>
                      </td>

                      {/* Earned Rebate */}
                      <td className="py-4 px-4 text-left font-mono font-bold text-sm">
                        <span className="text-emerald-700 font-black">
                          +{cust.total_rebate_earned?.toLocaleString() || 0} <span className="text-xs font-normal font-sans">ر.س</span>
                        </span>
                      </td>

                      {/* Financial Balance */}
                      <td className="py-4 px-4 text-left font-sans">
                        {hasDebt ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-50 text-rose-700">
                            متبقي: {cust.customer_balance.toLocaleString()} ر.س
                          </span>
                        ) : isCredit ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-teal-50 text-teal-700">
                            دائن: {Math.abs(cust.customer_balance).toLocaleString()} ر.س
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                            خالص ✓
                          </span>
                        )}
                      </td>

                      {/* Single Primary Action Button */}
                      <td className="py-4 px-6 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setStatementCustomerId(cust.id);
                              setIsStatementOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition shadow-xs"
                          >
                            كشف الحساب والخصم
                          </button>

                          {!isReadOnly && (
                            <button
                              onClick={() => handleOpenEditModal(cust)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                              title="تعديل الشروط والبيانات"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Customer Settings & Terms Modal */}
      {isCustomerModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                تعديل شروط العميل: {editingCustomer.name}
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={(e) => handleSaveCustomer(e, false)} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">البريد الإلكتروني:</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="client@domain.com"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1">فئة 1 (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customerForm.cat1_discount_rate}
                    onChange={(e) => setCustomerForm({ ...customerForm, cat1_discount_rate: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">فئة 2 (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customerForm.cat2_discount_rate}
                    onChange={(e) => setCustomerForm({ ...customerForm, cat2_discount_rate: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">فئة 3 (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customerForm.cat3_discount_rate}
                    onChange={(e) => setCustomerForm({ ...customerForm, cat3_discount_rate: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">مهلة السداد (يوم):</label>
                <input
                  type="number"
                  value={customerForm.default_grace_days}
                  onChange={(e) => setCustomerForm({ ...customerForm, default_grace_days: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white rounded-lg font-medium"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* InfoSoft Sync Modal */}
      {isInfosoftSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                استيراد الحسابات من إنفوسوفت ERP
              </h3>
              <button onClick={() => setIsInfosoftSyncModalOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="mb-3">
              <input
                type="text"
                value={infosoftFilter}
                onChange={(e) => setInfosoftFilter(e.target.value)}
                placeholder="ابحث باسم العميل أو رقمه..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {loadingInfosoftCusts ? (
                <div className="p-8 text-center text-slate-400 text-xs">جاري الاتصال بإنفوسوفت...</div>
              ) : infosoftCustomersList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">لا توجد حسابات متاحة.</div>
              ) : (
                infosoftCustomersList
                  .filter(c => !infosoftFilter || c.name.toLowerCase().includes(infosoftFilter.toLowerCase()) || c.accounting_system_id.toLowerCase().includes(infosoftFilter.toLowerCase()))
                  .map(cust => {
                    const isAlready = customers.some(c => String(c.accounting_system_id) === String(cust.accounting_system_id));
                    const isSyncing = syncingId === cust.accounting_system_id;

                    return (
                      <div key={cust.accounting_system_id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{cust.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">#{cust.accounting_system_id}</div>
                        </div>
                        <button
                          onClick={() => handleSyncCustomerDirectly(cust)}
                          disabled={isSyncing}
                          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition"
                        >
                          {isSyncing ? 'مزامنة...' : isAlready ? 'تحديث' : 'استيراد'}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setIsInfosoftSyncModalOpen(false)} className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">إغلاق</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
