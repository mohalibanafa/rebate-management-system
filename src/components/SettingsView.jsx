import React, { useState, useEffect } from 'react';
import { 
  Building2, Mail, Server, ShieldCheck, CheckCircle2, 
  AlertCircle, Send, RotateCw, Save, Download, Archive, 
  HelpCircle, Eye, EyeOff, Radio, RefreshCw, Check
} from 'lucide-react';

export default function SettingsView({ onOpenYearClose, isReadOnly }) {
  const [companyName, setCompanyName] = useState('مؤسسة الحلول التجارية');
  const [defaultDiscountRate, setDefaultDiscountRate] = useState(7);
  const [defaultGraceDays, setDefaultGraceDays] = useState(30);

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Connection & Test Mail States
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // { success: bool, message: string }
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState(null);

  // Queue and Stats
  const [queueStatus, setQueueStatus] = useState([]);
  const [recentEmails, setRecentEmails] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Feedback Messages
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [backupMessage, setBackupMessage] = useState(null);

  useEffect(() => {
    loadAllSettings();
    loadQueueData();
  }, []);

  const loadAllSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res.company_name) setCompanyName(res.company_name);
      if (res.default_rate) setDefaultDiscountRate(Number(res.default_rate));
      if (res.default_grace) setDefaultGraceDays(Number(res.default_grace));

      if (res.smtp_config) {
        setSmtpHost(res.smtp_config.host || '');
        setSmtpPort(String(res.smtp_config.port || 587));
        setSmtpUser(res.smtp_config.user || '');
        setSmtpPass(res.smtp_config.pass || '');
        setSmtpFrom(res.smtp_config.from || '');
        setTestEmailTarget(res.smtp_config.user || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadQueueData = async () => {
    try {
      setIsLoadingQueue(true);
      const stats = await window.api.getEmailQueueStatus();
      setQueueStatus(stats);
      const recents = await window.api.getRecentEmails();
      setRecentEmails(recents);
    } catch (err) {
      console.error('Failed to load queue data:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Provider Presets
  const applyPreset = (preset) => {
    if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
    } else if (preset === 'outlook') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort('587');
    } else if (preset === 'brevo') {
      setSmtpHost('smtp-relay.brevo.com');
      setSmtpPort('587');
    }
    setConnectionStatus(null);
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await window.api.saveSettings({
        company_name: companyName.trim(),
        default_rate: defaultDiscountRate,
        default_grace: defaultGraceDays,
        smtp_config: {
          host: smtpHost.trim(),
          port: parseInt(smtpPort, 10),
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
          from: smtpFrom.trim() || smtpUser.trim()
        }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      loadQueueData();
    } catch (err) {
      setSaveError(err.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);

    const config = {
      host: smtpHost.trim(),
      port: parseInt(smtpPort, 10),
      user: smtpUser.trim(),
      pass: smtpPass.trim()
    };

    try {
      const res = await window.api.testSmtpConnection(config);
      setConnectionStatus({ success: true, message: res.message || 'تم الاتصال بخادم البريد بنجاح!' });
    } catch (err) {
      setConnectionStatus({ success: false, message: err.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailTarget.trim()) return;

    setIsSendingTestEmail(true);
    setTestEmailStatus(null);

    const config = {
      host: smtpHost.trim(),
      port: parseInt(smtpPort, 10),
      user: smtpUser.trim(),
      pass: smtpPass.trim(),
      from: smtpFrom.trim() || smtpUser.trim()
    };

    try {
      await window.api.sendTestEmail(testEmailTarget.trim(), config);
      setTestEmailStatus({ success: true, message: `تم إرسال البريد الاختباري بنجاح إلى: ${testEmailTarget}` });
      loadQueueData();
    } catch (err) {
      setTestEmailStatus({ success: false, message: err.message });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleResendEmail = async (queueId) => {
    try {
      await window.api.resendEmail(queueId);
      loadQueueData();
    } catch (err) {
      alert('فشل إعادة الإرسال: ' + err.message);
    }
  };

  const handleBackupDatabase = async () => {
    setBackupMessage(null);
    try {
      const savedPath = await window.api.backupDatabase();
      if (savedPath) {
        setBackupMessage(`تم حفظ النسخة الاحتياطية بنجاح في:\n${savedPath}`);
      }
    } catch (err) {
      alert('فشل النسخ الاحتياطي: ' + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Header Banner */}
      <div className="bg-spruce-900 text-sand-warm p-6 rounded-2xl shadow-corporate-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-teal-forest">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-forest rounded-xl text-sand-warm">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-sand-warm tracking-wide">
                مركز الإعدادات والتهيئة المؤسسية
              </h2>
              <p className="text-xs text-sage-soft mt-0.5">
                إدارة هوية المنشأة، خادم البريد SMTP، ومراقبة الإشعارات الحية والنسخ الاحتياطي
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackupDatabase}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm text-xs font-bold rounded-xl transition shadow-sm border border-sage-soft/30"
          >
            <Download className="w-4 h-4 text-gold-bronze" />
            نسخ احتياطي للبيانات
          </button>

          {!isReadOnly && (
            <button
              onClick={onOpenYearClose}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gold-bronze hover:bg-gold-bronze-hover text-spruce-900 text-xs font-black rounded-xl transition shadow-sm"
            >
              <Archive className="w-4 h-4" />
              إغلاق السنة المالية
            </button>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5 font-bold shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>تم حفظ الإعدادات المؤسسية وخادم البريد بنجاح!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2.5 font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {backupMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-amber-700" />
            <span className="whitespace-pre-line">{backupMessage}</span>
          </div>
          <button onClick={() => setBackupMessage(null)} className="text-amber-800 underline font-bold text-xs">
            إغلاق
          </button>
        </div>
      )}

      {/* Grid: Company Profile & SMTP Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column: Company Profile (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-corporate border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 text-spruce-900 font-black text-sm border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-teal-forest" />
              هوية المنشأة والشروط الافتراضية
            </div>

            <div>
              <label className="block text-xs font-bold text-spruce-900 mb-1.5">
                اسم المنشأة / الشركة (يظهر في الترويسة والتقارير):
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="مثال: شركة الأعمال المتقدمة للتجارة"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:ring-1 focus:ring-teal-forest focus:outline-none transition"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                يظهر هذا الاسم كمرسل في الإيميلات ورأس كشف الحساب الرسمي.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1.5">
                  نسبة الخصم الافتراضية (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={defaultDiscountRate}
                  onChange={(e) => setDefaultDiscountRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1.5">
                  مهلة السماح (أيام):
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={defaultGraceDays}
                  onChange={(e) => setDefaultGraceDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-2.5 px-4 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4 text-gold-bronze" />
                حفظ بيانات المنشأة
              </button>
            </div>
          </div>

          {/* Guidelines Box */}
          <div className="bg-sand-light p-5 rounded-2xl border border-sand-warm text-spruce-900 space-y-2">
            <h4 className="font-bold text-xs flex items-center gap-1.5 text-gold-bronze">
              <HelpCircle className="w-4 h-4" />
              إرشادات هامة لربط البريد (Gmail):
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-700">
              لحسابات <strong>جيميل</strong>، يجب استخدام <strong>"كلمة مرور التطبيقات (App Password)"</strong> المكونة من 16 حرفاً بدلاً من كلمة المرور العادية لضمان السماح للبرنامج المكتبي بإرسال الإشعارات بدون قيود أمان جوجل.
            </p>
          </div>
        </div>

        {/* Right Column: SMTP Server Settings & Live Testing (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-corporate border border-slate-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-spruce-900 font-black text-sm">
                <Mail className="w-5 h-5 text-teal-forest" />
                إعدادات خادم البريد الإلكتروني (SMTP)
              </div>

              {/* Provider Quick Presets */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 ml-1">إكمال سريع:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('gmail')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold"
                >
                  Gmail
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('outlook')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold"
                >
                  Outlook
                </button>
              </div>
            </div>

            {/* SMTP Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-spruce-900 mb-1">خادم SMTP (Host):</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com أو mail.domain.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1">المنفذ (Port):</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587 أو 465"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-spruce-900 mb-1">اسم المستخدم / البريد:</label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="notifications@company.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1">كلمة المرور / App Password:</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-spruce-900 mb-1">
                  عنوان البريد المرسل (From Address - اختياري):
                </label>
                <input
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder="نفس بريد المستخدم افتراضياً"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-teal-forest focus:outline-none"
                />
              </div>
            </div>

            {/* Test Connection Action */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-spruce-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-forest" />
                  فحص الاتصال والتأكد من صحة بيانات الخادم:
                </span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !smtpHost || !smtpUser || !smtpPass}
                  className="px-3 py-1.5 bg-spruce-900 hover:bg-spruce-800 text-sand-warm text-xs font-bold rounded-lg transition disabled:opacity-40"
                >
                  {isTestingConnection ? 'جاري الفحص...' : 'فحص الاتصال الآن'}
                </button>
              </div>

              {connectionStatus && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  connectionStatus.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {connectionStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{connectionStatus.message}</span>
                </div>
              )}
            </div>

            {/* Send Test Email Action */}
            <form onSubmit={handleSendTestEmail} className="p-4 bg-sand-light/50 rounded-xl border border-sand-warm/60 space-y-2">
              <div className="text-xs font-bold text-spruce-900 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-gold-bronze" />
                إرسال بريد اختباري لصندوق الوارد:
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  placeholder="اكتب بريدك لاستلام رسالة التجربة..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSendingTestEmail || !smtpHost || !smtpPass}
                  className="px-4 py-2 bg-gold-bronze hover:bg-gold-bronze-hover text-spruce-900 text-xs font-black rounded-lg transition disabled:opacity-40"
                >
                  {isSendingTestEmail ? 'جاري الإرسال...' : 'إرسال تجريبي'}
                </button>
              </div>

              {testEmailStatus && (
                <div className={`p-2 rounded text-xs font-semibold ${
                  testEmailStatus.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {testEmailStatus.message}
                </div>
              )}
            </form>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="py-2.5 px-6 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-gold-bronze" />
                حفظ إعدادات البريد بالكامل
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Live Email Queue Monitor */}
      <div className="bg-white rounded-2xl shadow-corporate border border-slate-200/80 overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-teal-forest" />
            <h3 className="text-sm font-bold text-spruce-900">
              سجل وطابور الإشعارات الصادرة (Email Dispatch Monitor)
            </h3>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-slate-500">
              قيد الانتظار: <strong className="text-amber-700">{queueStatus.find(q => q.status === 'PENDING')?.count || 0}</strong>
            </span>
            <span className="text-slate-500">
              تم الإرسال: <strong className="text-emerald-700">{queueStatus.find(q => q.status === 'SENT')?.count || 0}</strong>
            </span>
            <span className="text-slate-500">
              فشلت: <strong className="text-rose-700">{queueStatus.find(q => q.status === 'FAILED')?.count || 0}</strong>
            </span>
            <button
              onClick={loadQueueData}
              disabled={isLoadingQueue}
              className="p-1.5 text-slate-400 hover:text-spruce-900 hover:bg-slate-200 rounded-lg transition"
              title="تحديث السجل"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-2.5 px-4">رقم الإشعار</th>
                <th className="py-2.5 px-4">المستلم</th>
                <th className="py-2.5 px-4">موضوع الرسالة</th>
                <th className="py-2.5 px-4">النوع المرجعي</th>
                <th className="py-2.5 px-4">الحالة</th>
                <th className="py-2.5 px-4">وقت الإرسال / الإنشاء</th>
                <th className="py-2.5 px-4 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEmails.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    لا توجد رسائل مسجلة في الطابور حتى الآن.
                  </td>
                </tr>
              ) : (
                recentEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-500">#{email.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-spruce-900">{email.recipient_email}</td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">{email.subject}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                        {email.reference_type || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {email.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> تم الإرسال
                        </span>
                      ) : email.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-bold">
                          <RotateCw className="w-3 h-3 animate-spin" /> قيد الانتظار
                        </span>
                      ) : email.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 text-[11px] font-bold" title={email.error_message}>
                          <AlertCircle className="w-3 h-3" /> تعثر
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">ملغاة</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {email.sent_at || email.created_at}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {email.status === 'FAILED' && (
                        <button
                          onClick={() => handleResendEmail(email.id)}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold transition"
                        >
                          إعادة الإرسال
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
