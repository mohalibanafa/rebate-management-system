import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, CheckCircle, AlertCircle, ArrowRightLeft, 
  Receipt, CreditCard, RotateCcw, Send, Check, Search, UserCheck
} from 'lucide-react';

export default function FastTransactionEntry({ preselectedCustomerId, onTransactionSaved, isReadOnly }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [transType, setTransType] = useState('INVOICE'); // 'INVOICE' | 'PAYMENT' | 'RETURN'
  const [accountingTransId, setAccountingTransId] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [discountRate, setDiscountRate] = useState(7); // percentage (e.g. 7 for 7%)
  const [graceDays, setGraceDays] = useState(30);

  // For Return/Adjustments
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [returnType, setReturnType] = useState('RETURN');
  const [returnNotes, setReturnNotes] = useState('');

  // Email Notification Toggle
  const [sendNotification, setSendNotification] = useState(true);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const customerInputRef = useRef(null);
  const transIdInputRef = useRef(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const found = customers.find(c => c.id === preselectedCustomerId);
      if (found) {
        selectCustomer(found);
      }
    }
  }, [preselectedCustomerId, customers]);

  const loadCustomers = async () => {
    try {
      const list = await window.api.getAllCustomers();
      setCustomers(list);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const selectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearch(`${cust.name} (${cust.accounting_system_id})`);
    setShowCustomerDropdown(false);

    // Apply customer defaults if in invoice mode
    setDiscountRate(cust.default_discount_rate ? cust.default_discount_rate * 100 : 7);
    setGraceDays(cust.default_grace_days || 30);

    // If in return mode, load invoices
    loadInvoicesForCustomer(cust.id);

    // Focus on reference ID input
    setTimeout(() => {
      transIdInputRef.current?.focus();
    }, 50);
  };

  const loadInvoicesForCustomer = async (custId) => {
    try {
      const invs = await window.api.getInvoicesForCustomer(custId);
      setCustomerInvoices(invs);
      if (invs.length > 0) {
        setSelectedInvoiceId(invs[0].id);
      } else {
        setSelectedInvoiceId('');
      }
    } catch (err) {
      console.error('Failed to load customer invoices:', err);
    }
  };

  const handleTransTypeChange = (type) => {
    setTransType(type);
    setErrorMessage(null);
    if (type === 'RETURN' && selectedCustomer) {
      loadInvoicesForCustomer(selectedCustomer.id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isReadOnly) {
      setErrorMessage('النظام في وضع الأرشيف (للقراءة فقط). لا يمكن إضافة حركات.');
      return;
    }

    if (!selectedCustomer) {
      setErrorMessage('يرجى اختيار العميل أولاً.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (!accountingTransId.trim()) {
      setErrorMessage('يرجى إدخال رقم الحركة في النظام المحاسبي.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (transType === 'INVOICE') {
        const rateDecimal = parseFloat(discountRate) / 100;
        await window.api.createInvoice({
          customer_id: selectedCustomer.id,
          accounting_trans_id: accountingTransId.trim(),
          invoice_date: transDate,
          total_amount: numAmount,
          discount_rate: rateDecimal,
          grace_days: parseInt(graceDays, 10),
          send_notification: sendNotification
        });

        setSuccessMessage(`تم حفظ الفاتورة [${accountingTransId}] بنجاح، وتحديث رصيد العميل.`);
      } else if (transType === 'PAYMENT') {
        await window.api.createPayment({
          customer_id: selectedCustomer.id,
          accounting_trans_id: accountingTransId.trim(),
          payment_date: transDate,
          amount: numAmount,
          send_notification: sendNotification
        });

        setSuccessMessage(`تم تسجيل سند السداد [${accountingTransId}] وتطبيق توزيع FIFO على أقدم الفواتير.`);
      } else if (transType === 'RETURN') {
        if (!selectedInvoiceId) {
          throw new Error('يرجى اختيار الفاتورة الأصلية المستهدفة للمرتجع.');
        }

        await window.api.createAdjustment({
          invoice_id: parseInt(selectedInvoiceId, 10),
          accounting_trans_id: accountingTransId.trim(),
          adjustment_date: transDate,
          amount: numAmount,
          type: returnType,
          notes: returnNotes
        });

        setSuccessMessage(`تم تسجيل المرتجع [${accountingTransId}] وربطه بالفاتورة بنجاح.`);
      }

      // Reset form fields
      setAccountingTransId('');
      setAmount('');
      setReturnNotes('');
      if (onTransactionSaved) {
        onTransactionSaved();
      }

      // Refocus customer search or trans id for fast continuous entry
      setTimeout(() => {
        transIdInputRef.current?.focus();
      }, 100);

    } catch (err) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الحركة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.accounting_system_id.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Page Title Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-blue-600" />
            شاشة الإدخال السريع للحركات اليومية
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تسجيل الفواتير، سندات السداد، والمرتجعات مع إعادة بناء الرصيد وحساب الخصم لحظياً
          </p>
        </div>

        {isReadOnly && (
          <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
            وضع الأرشيف (للقراءة فقط)
          </div>
        )}
      </div>

      {/* Main Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        
        {/* Alerts */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSuccessMessage(null)} 
              className="text-xs text-emerald-700 underline font-semibold"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* 1. Customer Selection */}
        <div className="relative">
          <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-600" />
            العميل المستهدف (ابحث بالاسم أو الرقم المحاسبي):
          </label>
          <div className="relative">
            <input
              ref={customerInputRef}
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
                if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                  setSelectedCustomer(null);
                }
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="اكتب اسم العميل أو رقمه المحاسبي..."
              disabled={isReadOnly}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>

          {/* Autocomplete Dropdown */}
          {showCustomerDropdown && customerSearch.length > 0 && !selectedCustomer && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 text-center">لا يوجد عميل مطابق للبحث</div>
              ) : (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <strong className="text-slate-800 font-bold block">{c.name}</strong>
                      <span className="text-slate-500">الرقم المحاسبي: {c.accounting_system_id} | البريد: {c.email}</span>
                    </div>
                    <div className="text-left font-semibold text-emerald-700">
                      رصيد الخصم: {c.total_rebate_earned?.toLocaleString() || 0} ر.س
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedCustomer && (
            <div className="mt-2 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <span>
                العميل المختار: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.accounting_system_id})
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                  customerInputRef.current?.focus();
                }}
                className="text-xs text-blue-700 hover:text-red-600 underline"
              >
                تغيير العميل
              </button>
            </div>
          )}
        </div>

        {/* 2. Transaction Type Radio Pills */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">نوع الحركة:</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleTransTypeChange('INVOICE')}
              className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition ${
                transType === 'INVOICE'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              فاتورة جديدة
            </button>

            <button
              type="button"
              onClick={() => handleTransTypeChange('PAYMENT')}
              className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition ${
                transType === 'PAYMENT'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              سداد / سند قبض
            </button>

            <button
              type="button"
              onClick={() => handleTransTypeChange('RETURN')}
              className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold transition ${
                transType === 'RETURN'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              مرتجع / تالف
            </button>
          </div>
        </div>

        {/* 3. Transaction Details Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              رقم الحركة في النظام المحاسبي (إلزامي للتدقيق):
            </label>
            <input
              ref={transIdInputRef}
              type="text"
              required
              value={accountingTransId}
              onChange={(e) => setAccountingTransId(e.target.value)}
              placeholder={transType === 'INVOICE' ? 'مثال: INV-10452' : transType === 'PAYMENT' ? 'مثال: REC-9081' : 'مثال: RET-302'}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {transType === 'PAYMENT' ? 'تاريخ السند الفعلي (المرجع الزمني للمهلة):' : 'تاريخ الحركة الفعلي:'}
            </label>
            <input
              type="date"
              required
              value={transDate}
              onChange={(e) => setTransDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className={transType === 'INVOICE' ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              المبلغ الإجمالي (ر.س):
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Conditional Fields for Invoice: Discount Rate & Grace Days */}
          {transType === 'INVOICE' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نسبة الخصم لهذه الفاتورة (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  قيمة الخصم المتوقعة: {amount && discountRate ? ((parseFloat(amount) * parseFloat(discountRate)) / 100).toFixed(2) : '0.00'} ر.س
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مهلة السداد المسموحة (بالأيام):
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={graceDays}
                  onChange={(e) => setGraceDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Conditional Fields for Return: Target Invoice selection */}
          {transType === 'RETURN' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الفاتورة الأصلية المستهدفة (إلزامي):
                </label>
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="">-- اختر الفاتورة الأصلية --</option>
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      فاتورة {inv.accounting_trans_id} بتاريخ {inv.invoice_date} (الصافي الحالي: {inv.net_total.toLocaleString()} ر.س)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع الحركة:
                </label>
                <select
                  value={returnType}
                  onChange={(e) => setReturnType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="RETURN">مرتجع بضاعة (RETURN)</option>
                  <option value="DAMAGED">تالف أو عيوب تصنيع (DAMAGED)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو سبب الإرجاع (اختياري):
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="سبب المرتجع..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        {/* 4. Instant Email Notification Toggle */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${sendNotification ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">إرسال إشعار فوري للعميل عبر الإيميل</div>
              <div className="text-xs text-slate-500">
                إشعار العميل بتفاصيل الحركة ورصيد الخصم التراكمي المعتمد حتى اللحظة.
                (أطفئ المفتاح عند إدخال حركات سابقة أو تصحيحية).
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
              disabled={isReadOnly}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* 5. Big Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || isReadOnly}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-base text-white shadow-md transition flex items-center justify-center gap-2 ${
              transType === 'INVOICE'
                ? 'bg-blue-600 hover:bg-blue-700'
                : transType === 'PAYMENT'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            } disabled:opacity-50`}
          >
            {isSubmitting ? (
              <span>جاري الحفظ وإعادة الاحتساب...</span>
            ) : (
              <>
                <Check className="w-5 h-5" />
                حفظ الحركة وتحديث رصيد العميل فورياً
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
