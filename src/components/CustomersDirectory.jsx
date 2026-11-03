import React, { useState, useEffect } from 'react';
import { 
  Users, Search, UserPlus, FileSpreadsheet, ArrowUpRight, 
  DollarSign, TrendingUp, AlertCircle, Edit, Trash2, 
  ExternalLink, Mail, Phone, Hash, CheckCircle2, FileText
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

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
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

      if (editingCustomer) {
        await window.api.updateCustomer(editingCustomer.id, payload);
      } else {
        await window.api.createCustomer(payload);
      }

      setIsCustomerModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setModalError(err.message || 'حدث خطأ أثناء حفظ بيانات العميل.');
    }
  };

  const handleDeleteCustomer = async (cust) => {
    if (isReadOnly) return;
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${cust.name}"؟`)) return;

    try {
      await window.api.deleteCustomer(cust.id);
      await loadCustomers();
    } catch (err) {
      alert(err.message);
    }
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
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">صافي المبيعات الكلي</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {totalNetSalesAll.toLocaleString()} <span className="text-xs font-normal text-slate-500">ر.س</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">إجمالي المبيعات بعد خصم المرتجعات</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">إجمالي الخصم المجمع المعتمد</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {totalRebateAll.toLocaleString()} <span className="text-xs font-normal text-slate-500">ر.س</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">الرصيد المستحق للتسوية مع العملاء</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">المبالغ غير المسددة</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">
            {totalUnpaidAll.toLocaleString()} <span className="text-xs font-normal text-slate-500">ر.س</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">إجمالي الفواتير المفتوحة لدى العملاء</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">عدد العملاء المسجلين</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800">
            {customers.length} <span className="text-xs font-normal text-slate-500">عميل</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">قاعدة العملاء النشطة بالنظام</div>
        </div>
      </div>

      {/* Control Bar: Search & Add Customer */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث سريع باسم العميل أو رقمه المحاسبي..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              إضافة عميل جديد
            </button>
          )}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">العميل والرقم المحاسبي</th>
                <th className="py-3 px-4">بيانات التواصل</th>
                <th className="py-3 px-4">نسبة ومهلة الخصم</th>
                <th className="py-3 px-4">صافي المبيعات</th>
                <th className="py-3 px-4">الخصم المجمع المعتمد</th>
                <th className="py-3 px-4">رصيد الذمة</th>
                <th className="py-3 px-4">الفواتير</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    جاري تحميل دليل العملاء...
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
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-sm text-slate-800">{cust.name}</div>
                      <div className="text-xs text-blue-700 font-mono mt-0.5 flex items-center gap-1">
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

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      <div>{(cust.default_discount_rate * 100).toFixed(1)}% خصم</div>
                      <div className="text-slate-400 text-[11px]">{cust.default_grace_days} يوم مهلة</div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {cust.total_net_sales?.toLocaleString() || 0} ر.س
                    </td>

                    <td className="py-3.5 px-4 font-black text-sm text-emerald-600">
                      {cust.total_rebate_earned?.toLocaleString() || 0} ر.س
                    </td>

                    <td className="py-3.5 px-4 font-bold">
                      {cust.customer_balance > 0 ? (
                        <span className="text-amber-700 font-semibold">{cust.customer_balance.toLocaleString()} ر.س</span>
                      ) : cust.customer_balance < 0 ? (
                        <span className="text-emerald-700 font-semibold">دائن: {Math.abs(cust.customer_balance).toLocaleString()} ر.س</span>
                      ) : (
                        <span className="text-slate-400 font-normal">خالص</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-medium">{cust.invoice_count} فاتورة</div>
                      {cust.unpaid_invoice_count > 0 && (
                        <div className="text-[11px] text-amber-600 font-semibold">
                          ({cust.unpaid_invoice_count} معلقة)
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setStatementCustomerId(cust.id);
                            setIsStatementOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                          title="عرض كشف الحساب والتدقيق المالي"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          كشف الحساب
                        </button>

                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => onSelectCustomerForEntry(cust.id)}
                              className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition"
                              title="إدخال حركة سريعة لهذا العميل"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(cust)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="تعديل بيانات العميل"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {cust.invoice_count === 0 && (
                              <button
                                onClick={() => handleDeleteCustomer(cust)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد للنظام'}
            </h3>

            {modalError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل / المنشأة:</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="مثال: شركة الأمل للتجارة"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم بالنظام المحاسبي (فريد):</label>
                  <input
                    type="text"
                    required
                    value={customerForm.accounting_system_id}
                    onChange={(e) => setCustomerForm({ ...customerForm, accounting_system_id: e.target.value })}
                    placeholder="مثال: CUST-010"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني للإشعارات:</label>
                  <input
                    type="email"
                    required
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="client@domain.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف (اختياري):</label>
                <input
                  type="text"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة الخصم الافتراضية (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={customerForm.default_discount_rate}
                    onChange={(e) => setCustomerForm({ ...customerForm, default_discount_rate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">تُقترح تلقائياً عند تحرير فاتورة</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">مهلة السداد بالأيام:</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={customerForm.default_grace_days}
                    onChange={(e) => setCustomerForm({ ...customerForm, default_grace_days: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">مهلة استحقاق الخصم</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm"
                >
                  {editingCustomer ? 'حفظ التعديلات' : 'تسجيل العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
