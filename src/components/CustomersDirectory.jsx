import React, { useState, useEffect } from 'react';
import { 
  Users, Search, UserPlus, DollarSign, TrendingUp, 
  AlertCircle, Edit, Trash2, Mail, Phone, Hash, 
  CheckCircle2, FileText, ArrowUpRight, Send, Sparkles, Check
} from 'lucide-react';
import CustomerStatementModal from './CustomerStatementModal';

export default function CustomersDirectory({ onSelectCustomerForEntry, isReadOnly }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Statement Modal State
  const [statementCustomerId, setStatementCustomerId] = useState(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Customer Add/Edit Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    accounting_system_id: '',
    email: '',
    phone: '',
    default_discount_rate: 7,
    default_grace_days: 30
  });
  const [modalError, setModalError] = useState(null);

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

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      accounting_system_id: '',
      email: '',
      phone: '',
      default_discount_rate: 7,
      default_grace_days: 30
    });
    setModalError(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditModal = (cust) => {
    setEditingCustomer(cust);
    setCustomerForm({
      name: cust.name,
      accounting_system_id: cust.accounting_system_id,
      email: cust.email,
      phone: cust.phone || '',
      default_discount_rate: cust.default_discount_rate ? cust.default_discount_rate * 100 : 7,
      default_grace_days: cust.default_grace_days || 30
    });
    setModalError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e, shouldSendWelcome = false) => {
    if (e) e.preventDefault();
    setModalError(null);

    try {
      const payload = {
        name: customerForm.name.trim(),
        accounting_system_id: customerForm.accounting_system_id.trim(),
        email: customerForm.email.trim(),
        phone: customerForm.phone.trim() || null,
        default_discount_rate: parseFloat(customerForm.default_discount_rate) / 100,
        default_grace_days: parseInt(customerForm.default_grace_days, 10)
      };

      let savedCustomer;
      if (editingCustomer) {
        savedCustomer = await window.api.updateCustomer(editingCustomer.id, payload);
      } else {
        savedCustomer = await window.api.createCustomer(payload);
      }

      setIsCustomerModalOpen(false);
      await loadCustomers();

      // If user requested to send welcome email upon saving
      if (shouldSendWelcome && savedCustomer?.id) {
        await handleSendWelcomeEmail(savedCustomer.id, savedCustomer.email);
      } else {
        showToast('تم حفظ بيانات العميل بنجاح.');
      }
    } catch (err) {
      setModalError(err.message || 'حدث خطأ أثناء حفظ بيانات العميل.');
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
          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm rounded-xl text-xs font-bold shadow-sm transition border border-teal-forest"
            >
              <UserPlus className="w-4 h-4 text-gold-bronze" />
              إضافة عميل جديد
            </button>
          )}
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
                      <div>{(cust.default_discount_rate * 100).toFixed(1)}% خصم</div>
                      <div className="text-slate-400 text-[10px] font-normal">{cust.default_grace_days} يوم مهلة</div>
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
                        
                        {/* Statement Modal Button */}
                        <button
                          onClick={() => {
                            setStatementCustomerId(cust.id);
                            setIsStatementOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-spruce-900 text-sand-warm hover:bg-spruce-800 rounded-lg text-xs font-bold transition shadow-sm"
                          title="عرض وتدقيق كشف الحساب التفصيلي"
                        >
                          <FileText className="w-3.5 h-3.5 text-gold-bronze" />
                          كشف الحساب
                        </button>

                        {!isReadOnly && (
                          <>
                            {/* Fast Entry Button */}
                            <button
                              onClick={() => onSelectCustomerForEntry(cust.id)}
                              className="p-1.5 bg-sand-light text-spruce-900 hover:bg-sand-warm border border-sand-warm rounded-lg text-xs font-bold transition"
                              title="تسجيل حركة سريعة لهذا العميل"
                            >
                              <ArrowUpRight className="w-4 h-4 text-gold-bronze" />
                            </button>

                            {/* Welcome Email Button */}
                            <button
                              onClick={() => handleSendWelcomeEmail(cust.id, cust.email)}
                              disabled={sendingWelcomeId === cust.id}
                              className="p-1.5 bg-teal-forest/10 hover:bg-teal-forest text-teal-forest hover:text-white rounded-lg text-xs transition border border-teal-forest/20"
                              title="إرسال بريد ترحيبي وتعريفي بنظام الخصم الذكي"
                            >
                              <Send className={`w-3.5 h-3.5 ${sendingWelcomeId === cust.id ? 'animate-pulse' : ''}`} />
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditModal(cust)}
                              className="p-1.5 text-slate-400 hover:text-spruce-900 hover:bg-slate-100 rounded-lg transition"
                              title="تعديل بيانات العميل"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
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

      {/* Add / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-spruce-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-corporate-lg max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-spruce-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-forest" />
                {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد للنظام'}
              </h3>
            </div>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-spruce-900 mb-1">اسم العميل / الشركة:</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="مثال: مؤسسة الأمل للتجارة"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none font-semibold text-spruce-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-spruce-900 mb-1">الرقم بالنظام المحاسبي (فريد):</label>
                  <input
                    type="text"
                    required
                    value={customerForm.accounting_system_id}
                    onChange={(e) => setCustomerForm({ ...customerForm, accounting_system_id: e.target.value })}
                    placeholder="مثال: CUST-010"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-spruce-900 mb-1">البريد الإلكتروني للإشعارات:</label>
                  <input
                    type="email"
                    required
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="client@domain.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-spruce-900 mb-1">نسبة الخصم المقترحة (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={customerForm.default_discount_rate}
                    onChange={(e) => setCustomerForm({ ...customerForm, default_discount_rate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-forest focus:outline-none font-bold"
                  />
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
              </div>

              {/* Action Buttons inside Modal */}
              <div className="pt-4 flex flex-col gap-2">
                
                {/* User Request Feature: Save & Send Welcome Email */}
                {!editingCustomer && (
                  <button
                    type="button"
                    onClick={(e) => handleSaveCustomer(e, true)}
                    className="w-full py-2.5 px-4 bg-sand-light hover:bg-sand-warm text-spruce-900 border border-sand-warm rounded-xl font-black text-xs transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-gold-bronze" />
                    حفظ العميل وإرسال بريد ترحيبي بالخصم الذكي فوراً
                  </button>
                )}

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
                    {editingCustomer ? 'حفظ التعديلات' : 'حفظ العميل فقط'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
