import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, Archive, Settings, Database, 
  ShieldAlert, Sparkles, Building2, Server
} from 'lucide-react';
import CustomersDirectory from './components/CustomersDirectory';
import FastTransactionEntry from './components/FastTransactionEntry';
import SettingsView from './components/SettingsView';
import YearCloseModal from './components/YearCloseModal';

// Mock fallback for browser-only development preview if not running in Electron
if (typeof window !== 'undefined' && !window.api) {
  console.warn('Running outside Electron. Initializing in-memory mock window.api');
  const mockCustomers = [
    { id: 1, name: 'شركة الأفق لمواد البناء', accounting_system_id: 'CUST-001', email: 'alofooq@example.com', phone: '0501112233', default_discount_rate: 0.07, default_grace_days: 30, total_gross_sales: 50000, total_returns: 2000, total_net_sales: 48000, total_payments: 40000, total_rebate_earned: 2800, total_remaining_unpaid: 8000, unallocated_cash: 0, customer_balance: 8000, invoice_count: 5, unpaid_invoice_count: 1 },
    { id: 2, name: 'مؤسسة الرياض للتوريدات', accounting_system_id: 'CUST-002', email: 'riyadh@example.com', phone: '0554443322', default_discount_rate: 0.05, default_grace_days: 20, total_gross_sales: 30000, total_returns: 0, total_net_sales: 30000, total_payments: 30000, total_rebate_earned: 1500, total_remaining_unpaid: 0, unallocated_cash: 0, customer_balance: 0, invoice_count: 3, unpaid_invoice_count: 0 }
  ];

  window.api = {
    getDatabaseStatus: async () => ({ path: 'local_active.db', isReadOnly: false, fileName: 'local_active.db' }),
    listAvailableDatabases: async () => ([
      { id: 'active', name: 'قاعدة البيانات النشطة (السنة الحالية)', path: 'local_active.db', isReadOnly: false, isActive: true }
    ]),
    switchDatabase: async (p, ro) => ({ path: p, isReadOnly: ro, fileName: p }),
    closeFiscalYear: async (y) => ({ success: true, archivedDbPath: `archives/${y}/closed.db`, pdfDir: `archives/${y}/PDF`, nextYear: y + 1 }),
    getAllCustomers: async () => mockCustomers,
    getCustomerById: async (id) => mockCustomers.find(c => c.id === id),
    createCustomer: async (d) => { const c = { ...d, id: Date.now() }; mockCustomers.push(c); return c; },
    updateCustomer: async (id, d) => ({ ...d, id }),
    deleteCustomer: async () => true,
    getCustomerStatement: async (id) => ({
      customer: mockCustomers.find(c => c.id === id) || mockCustomers[0],
      breakdown: [
        {
          id: 101,
          accounting_trans_id: 'INV-901',
          invoice_date: '2026-03-01',
          gross_amount: 10000,
          total_returns: 1000,
          net_total: 9000,
          discount_rate: 0.07,
          grace_days: 30,
          earned_discount: 630,
          remaining_unpaid: 0,
          status: 'FULLY_PAID',
          returns: [{ id: 1, accounting_trans_id: 'RET-01', adjustment_date: '2026-03-05', amount: 1000 }],
          settlements: [{ payment_trans_id: 'REC-501', payment_date: '2026-03-15', amount_applied: 9000, diff_days: 14, grace_days: 30, is_eligible: true, discount_earned: 630 }]
        }
      ],
      totalGrossSales: 10000,
      totalReturns: 1000,
      totalNetSales: 9000,
      totalPayments: 9000,
      totalRebateEarned: 630,
      totalRemainingUnpaid: 0,
      unallocatedCash: 0,
      customerBalance: 0
    }),
    getInvoicesForCustomer: async () => ([
      { id: 101, accounting_trans_id: 'INV-901', invoice_date: '2026-03-01', net_total: 9000 }
    ]),
    createInvoice: async () => ({ id: 1 }),
    updateInvoice: async () => ({ id: 1 }),
    grantInvoiceException: async () => true,
    revokeInvoiceException: async () => true,
    createPayment: async () => ({ id: 1 }),
    updatePayment: async () => ({ id: 1 }),
    createAdjustment: async () => ({ id: 1 }),
    updateAdjustment: async () => ({ id: 1 }),
    getSettings: async () => ({ company_name: 'مؤسسة الحلول التجارية', smtp_config: null, default_rate: 7, default_grace: 30 }),
    saveSettings: async () => true,
    getEmailQueueStatus: async () => ([{ status: 'SENT', count: 12 }, { status: 'PENDING', count: 0 }]),
    getRecentEmails: async () => ([
      { id: 1, recipient_email: 'client@example.com', subject: 'إشعار صدور فاتورة جديدة', reference_type: 'INVOICE', status: 'SENT', created_at: '2026-06-01' }
    ]),
    testSmtpConnection: async () => ({ success: true, message: 'تم الاتصال بالخادم بنجاح!' }),
    sendTestEmail: async () => ({ success: true }),
    sendWelcomeEmail: async () => ({ success: true }),
    resendEmail: async () => true,
    backupDatabase: async () => 'backup.db',
    printStatement: async () => window.print(),
    exportStatementPDF: async () => 'كشف_حساب.pdf'
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('CUSTOMERS'); // 'CUSTOMERS' | 'ENTRY' | 'SETTINGS'
  const [preselectedCustomerId, setPreselectedCustomerId] = useState(null);

  // Database and Archive state
  const [dbStatus, setDbStatus] = useState({ isReadOnly: false, fileName: 'rebate_system_active.db' });
  const [availableDbs, setAvailableDbs] = useState([]);

  // Year Close Modal
  const [isYearCloseOpen, setIsYearCloseOpen] = useState(false);

  useEffect(() => {
    loadDatabaseInfo();
  }, []);

  const loadDatabaseInfo = async () => {
    try {
      const status = await window.api.getDatabaseStatus();
      setDbStatus(status);
      const dbs = await window.api.listAvailableDatabases();
      setAvailableDbs(dbs);
    } catch (err) {
      console.error('Failed to load DB info:', err);
    }
  };

  const handleSwitchDatabase = async (dbItem) => {
    try {
      const updatedStatus = await window.api.switchDatabase(dbItem.path, dbItem.isReadOnly);
      setDbStatus(updatedStatus);
      await loadDatabaseInfo();
      setPreselectedCustomerId(null);
    } catch (err) {
      alert('خطأ أثناء تبديل قاعدة البيانات: ' + err.message);
    }
  };

  const handleSelectCustomerForEntry = (customerId) => {
    setPreselectedCustomerId(customerId);
    setActiveTab('ENTRY');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-spruce-900 font-sans">
      
      {/* Archive Warning Banner */}
      {dbStatus.isReadOnly && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
          <span>أنت الآن في وضع الأرشيف (للقراءة فقط). يمكنك استعراض وطباعة الكشوفات دون إمكانية التعديل.</span>
          <button
            onClick={() => {
              const active = availableDbs.find(d => !d.isReadOnly);
              if (active) handleSwitchDatabase(active);
            }}
            className="mr-3 underline hover:text-amber-200"
          >
            العودة للسنة النشطة الحالية
          </button>
        </div>
      )}

      {/* Main Luxury Corporate Navigation Bar */}
      <header className="bg-spruce-900 border-b border-teal-forest shadow-corporate sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-forest border border-sand-warm/30 rounded-xl flex items-center justify-center text-sand-warm shadow-md">
              <Sparkles className="w-5 h-5 text-gold-bronze" />
            </div>
            <div>
              <h1 className="text-base font-black text-sand-warm tracking-wide flex items-center gap-2">
                نظام إدارة خصم تعجيل الدفع المجمع
                <span className="text-[10px] font-bold bg-gold-bronze text-spruce-900 px-2 py-0.5 rounded-full">
                  Rebate System
                </span>
              </h1>
              <p className="text-xs text-sage-soft font-medium">
                توزيع السيولة بأسلوب FIFO • الاحتساب اللحظي المباشر • أرشفة سنوية
              </p>
            </div>
          </div>

          {/* Database Selector & Top Actions */}
          <div className="flex items-center gap-3">
            
            {/* Database Selector Dropdown */}
            <div className="flex items-center gap-2 bg-spruce-800 border border-teal-forest rounded-xl px-3 py-1.5 text-xs text-sand-warm">
              <Database className="w-4 h-4 text-gold-bronze flex-shrink-0" />
              <select
                value={availableDbs.find(d => d.isActive)?.id || 'active'}
                onChange={(e) => {
                  const target = availableDbs.find(d => d.id === e.target.value);
                  if (target) handleSwitchDatabase(target);
                }}
                className="bg-transparent font-bold text-sand-warm focus:outline-none cursor-pointer"
              >
                {availableDbs.map((d) => (
                  <option key={d.id} value={d.id} className="bg-spruce-900 text-white">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fiscal Year Close Button */}
            {!dbStatus.isReadOnly && (
              <button
                onClick={() => setIsYearCloseOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm border border-sage-soft/30 rounded-xl text-xs font-bold transition shadow-sm"
                title="إغلاق السنة المالية وتجميد الأرشيف"
              >
                <Archive className="w-4 h-4 text-gold-bronze" />
                إغلاق السنة والأرشفة
              </button>
            )}
          </div>
        </div>

        {/* 3 Main Corporate Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-8 text-xs border-t border-teal-forest/40">
          <button
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`py-3 px-2 font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'CUSTOMERS'
                ? 'border-gold-bronze text-sand-warm'
                : 'border-transparent text-sage-soft hover:text-sand-warm'
            }`}
          >
            <Users className="w-4 h-4 text-gold-bronze" />
            دليل العملاء وكشوفات الحساب
          </button>

          <button
            onClick={() => setActiveTab('ENTRY')}
            className={`py-3 px-2 font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'ENTRY'
                ? 'border-gold-bronze text-sand-warm'
                : 'border-transparent text-sage-soft hover:text-sand-warm'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-gold-bronze" />
            الإدخال السريع للحركات
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`py-3 px-2 font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'SETTINGS'
                ? 'border-gold-bronze text-sand-warm'
                : 'border-transparent text-sage-soft hover:text-sand-warm'
            }`}
          >
            <Settings className="w-4 h-4 text-gold-bronze" />
            الإعدادات والنظام المؤسسي
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full">
        {activeTab === 'CUSTOMERS' ? (
          <CustomersDirectory
            onSelectCustomerForEntry={handleSelectCustomerForEntry}
            isReadOnly={dbStatus.isReadOnly}
          />
        ) : activeTab === 'ENTRY' ? (
          <FastTransactionEntry
            preselectedCustomerId={preselectedCustomerId}
            onTransactionSaved={() => {}}
            isReadOnly={dbStatus.isReadOnly}
          />
        ) : (
          <SettingsView
            onOpenYearClose={() => setIsYearCloseOpen(true)}
            isReadOnly={dbStatus.isReadOnly}
          />
        )}
      </main>

      {/* Corporate Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-400 no-print">
        نظام إدارة خصم تعجيل الدفع المجمع © {new Date().getFullYear()} • النسخة المؤسسية المتكاملة
      </footer>

      {/* Year Close Modal */}
      <YearCloseModal
        isOpen={isYearCloseOpen}
        onClose={() => setIsYearCloseOpen(false)}
        onSuccess={loadDatabaseInfo}
      />
    </div>
  );
}
