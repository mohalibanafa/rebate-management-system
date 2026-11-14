import React, { useState, useEffect } from 'react';
import { 
  Building2, Mail, Server, ShieldCheck, CheckCircle2, 
  AlertCircle, Send, RotateCw, Save, Download, Archive, 
  HelpCircle, Eye, EyeOff, Radio, RefreshCw, Check,
  Pause, Play, Trash2, Copy, FolderOpen, Terminal, Clock
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
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [isPausingQueue, setIsPausingQueue] = useState(false);

  // System Logs & Diagnostics
  const [logs, setLogs] = useState([]);
  const [logFilterCategory, setLogFilterCategory] = useState('ALL');
  const [logFilterErrorsOnly, setLogFilterErrorsOnly] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // InfoSoft ERP Settings
  const [infosoftServer, setInfosoftServer] = useState('localhost,49916');
  const [infosoftCurrentYearDb, setInfosoftCurrentYearDb] = useState('dbc01y26');
  const [infosoftPrevYearDb, setInfosoftPrevYearDb] = useState('dbc01y25');
  const [isTestingInfosoft, setIsTestingInfosoft] = useState(false);
  const [infosoftTestResult, setInfosoftTestResult] = useState(null);
  const [isSavingInfosoft, setIsSavingInfosoft] = useState(false);
  const [infosoftSaveMessage, setInfosoftSaveMessage] = useState(null);

  // Feedback Messages
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [backupMessage, setBackupMessage] = useState(null);

  useEffect(() => {
    loadAllSettings();
    loadQueueData();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logFilterCategory, logFilterErrorsOnly]);

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

      if (window.api?.infosoft?.configure) {
        const infosoftConf = await window.api.infosoft.configure();
        if (infosoftConf) {
          if (infosoftConf.server) setInfosoftServer(infosoftConf.server);
          if (infosoftConf.currentYearDb) setInfosoftCurrentYearDb(infosoftConf.currentYearDb);
          if (infosoftConf.prevYearDb) setInfosoftPrevYearDb(infosoftConf.prevYearDb);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleTestInfosoft = async () => {
    setIsTestingInfosoft(true);
    setInfosoftTestResult(null);
    try {
      const res = await window.api.infosoft.getStatus();
      const isSuccess = Boolean(res && (res.success || res.connected));
      if (isSuccess) {
        const dbsCount = res.databases ? res.databases.length : 0;
        const currentYearFound = res.hasCurrentYear ? '✓ متوفرة' : '⚠️ غير موجودة';
        const prevYearFound = res.hasPrevYear ? '✓ متوفرة' : '⚠️ غير موجودة';
        setInfosoftTestResult({
          success: true,
          message: `تم الاتصال بنجاح بخادم إنفوسوفت!\n• الخادم النشط: ${res.activeServer || res.serverUsed || infosoftServer}\n• قاعدة 2026 (${res.currentYearDb || infosoftCurrentYearDb}): ${currentYearFound}\n• قاعدة 2025 (${res.prevYearDb || infosoftPrevYearDb}): ${prevYearFound}\n• إجمالي قواعد البيانات المكتشفة: ${dbsCount} قاعدة`
        });
      } else {
        const errorMsg = res?.error || res?.message || 'تعذر الوصول إلى الخادم أو المنفذ المحدد';
        setInfosoftTestResult({
          success: false,
          message: `فشل الاتصال بقاعدة بيانات إنفوسوفت:\n${errorMsg}\n\nإرشادات الحل:\n1. تأكد من تشغيل خدمة SQL Server على الجهاز.\n2. تأكد من صحة المنفذ (مثل localhost,49916) أو جرب كتابة: (localdb)\\MSSQLLocalDB\n3. راجع سجل أخطاء النظام بالأسفل لمزيد من التفاصيل.`
        });
      }
    } catch (err) {
      setInfosoftTestResult({
        success: false,
        message: 'خطأ غير متوقع أثناء فحص الاتصال: ' + (err.message || String(err))
      });
    } finally {
      setIsTestingInfosoft(false);
      loadLogs();
    }
  };

  const handleSaveInfosoftConfig = async () => {
    setIsSavingInfosoft(true);
    setInfosoftSaveMessage(null);
    try {
      await window.api.infosoft.configure({
        server: infosoftServer.trim(),
        currentYearDb: infosoftCurrentYearDb.trim(),
        prevYearDb: infosoftPrevYearDb.trim()
      });
      setInfosoftSaveMessage({ success: true, text: 'تم حفظ إعدادات الاتصال بإنفوسوفت بنجاح.' });
      setTimeout(() => setInfosoftSaveMessage(null), 3500);
    } catch (err) {
      setInfosoftSaveMessage({ success: false, text: 'تعذر حفظ الإعدادات: ' + err.message });
    } finally {
      setIsSavingInfosoft(false);
    }
  };

  const loadQueueData = async () => {
    try {
      setIsLoadingQueue(true);
      const stats = await window.api.getEmailQueueStatus();
      setQueueStatus(stats || []);
      const recents = await window.api.getRecentEmails();
      setRecentEmails(recents || []);
      if (window.api?.emailQueue?.isPaused) {
        const paused = await window.api.emailQueue.isPaused();
        setIsQueuePaused(Boolean(paused));
      }
    } catch (err) {
      console.error('Failed to load queue data:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleTogglePauseQueue = async () => {
    try {
      setIsPausingQueue(true);
      if (isQueuePaused) {
        await window.api.emailQueue.resume();
        setIsQueuePaused(false);
      } else {
        await window.api.emailQueue.pause();
        setIsQueuePaused(true);
      }
      await loadQueueData();
    } catch (err) {
      alert('فشل تغيير حالة طابور البريد: ' + (err.message || err));
    } finally {
      setIsPausingQueue(false);
    }
  };

  const handleCancelAllPendingEmails = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء كافة الإيميلات المعلقة في طابور الانتظار؟')) {
      return;
    }
    try {
      const res = await window.api.emailQueue.cancelAllPending();
      alert(`تم إلغاء ${res?.canceledCount || 0} رسالة معلقة بنجاح.`);
      loadQueueData();
    } catch (err) {
      alert('فشل إلغاء الرسائل المعلقة: ' + (err.message || err));
    }
  };

  const handleCancelSingleEmail = async (id) => {
    try {
      await window.api.emailQueue.cancel(id);
      loadQueueData();
    } catch (err) {
      alert('فشل إلغاء الرسالة: ' + (err.message || err));
    }
  };

  const loadLogs = async () => {
    if (!window.api?.logs?.get) return;
    setIsLoadingLogs(true);
    try {
      const data = await window.api.logs.get({
        category: logFilterCategory === 'ALL' ? undefined : logFilterCategory,
        level: logFilterErrorsOnly ? 'ERROR' : undefined,
        limit: 200
      });
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في مسح سجل تشغيل وأخطاء النظام؟')) return;
    try {
      await window.api.logs.clear();
      setLogs([]);
    } catch (err) {
      alert('فشل مسح السجل: ' + (err.message || err));
    }
  };

  const handleOpenLogFolder = async () => {
    try {
      await window.api.logs.openFolder();
    } catch (err) {
      alert('فشل فتح مجلد السجلات: ' + (err.message || err));
    }
  };

  const handleCopyLogs = () => {
    if (!logs.length) return;
    const text = logs.map(l => {
      const detailStr = l.details ? ' ' + (typeof l.details === 'object' ? JSON.stringify(l.details) : l.details) : '';
      return `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}${detailStr}`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
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

          {/* InfoSoft ERP Database Connection Card */}
          <div className="bg-white p-6 rounded-2xl shadow-corporate border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-spruce-900 font-black text-sm">
                <Server className="w-5 h-5 text-gold-bronze" />
                الاتصال بقاعدة بيانات إنفوسوفت ERP
              </div>
              <span className="text-[10px] bg-teal-forest/10 text-teal-forest font-bold px-2 py-0.5 rounded-full font-mono">
                SQL Server
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-spruce-900 mb-1">
                  عنوان الخادم والمنفذ (Server & Port):
                </label>
                <input
                  type="text"
                  value={infosoftServer}
                  onChange={(e) => setInfosoftServer(e.target.value)}
                  placeholder="localhost,49916 أو (localdb)\MSSQLLocalDB"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:outline-none transition"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  الافتراضي: localhost,49916 (مع دعم ذاتي لـ (localdb)\MSSQLLocalDB عند الحاجة)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-spruce-900 mb-1">
                    قاعدة السنة الحالية:
                  </label>
                  <input
                    type="text"
                    value={infosoftCurrentYearDb}
                    onChange={(e) => setInfosoftCurrentYearDb(e.target.value)}
                    placeholder="dbc01y26"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">سنة 2026</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-spruce-900 mb-1">
                    قاعدة السنة السابقة:
                  </label>
                  <input
                    type="text"
                    value={infosoftPrevYearDb}
                    onChange={(e) => setInfosoftPrevYearDb(e.target.value)}
                    placeholder="dbc01y25"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-spruce-900 focus:bg-white focus:border-teal-forest focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">لمطابقة مرتجعات 2025</span>
                </div>
              </div>

              {infosoftTestResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                  infosoftTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {infosoftTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                  <span className="whitespace-pre-line leading-relaxed">{infosoftTestResult.message}</span>
                </div>
              )}

              {infosoftSaveMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                  infosoftSaveMessage.success ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}>
                  {infosoftSaveMessage.text}
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestInfosoft}
                  disabled={isTestingInfosoft}
                  className="flex-1 py-2.5 px-3 bg-spruce-900 hover:bg-spruce-800 text-sand-warm text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-gold-bronze ${isTestingInfosoft ? 'animate-spin' : ''}`} />
                  {isTestingInfosoft ? 'جاري الفحص...' : 'فحص الاتصال بقاعدة إنفوسوفت'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveInfosoftConfig}
                  disabled={isSavingInfosoft}
                  className="py-2.5 px-4 bg-teal-forest hover:bg-teal-forest-hover text-sand-warm text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1"
                >
                  <Save className="w-3.5 h-3.5 text-gold-bronze" />
                  حفظ
                </button>
              </div>
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
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-teal-forest" />
            <h3 className="text-sm font-bold text-spruce-900">
              سجل وطابور الإشعارات الصادرة (Email Dispatch Monitor)
            </h3>
            {isQueuePaused && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold flex items-center gap-1">
                <Pause className="w-3 h-3 fill-current" />
                الإرسال متوقف مؤقتاً
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                قيد الانتظار: <strong className="text-amber-700">{queueStatus.find(q => q.status === 'PENDING')?.count || 0}</strong>
              </span>
              <span className="text-slate-500">
                تم الإرسال: <strong className="text-emerald-700">{queueStatus.find(q => q.status === 'SENT')?.count || 0}</strong>
              </span>
              <span className="text-slate-500">
                فشلت: <strong className="text-rose-700">{queueStatus.find(q => q.status === 'FAILED')?.count || 0}</strong>
              </span>
              <span className="text-slate-500">
                ملغاة: <strong className="text-slate-600">{queueStatus.find(q => q.status === 'CANCELED')?.count || 0}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePauseQueue}
                disabled={isPausingQueue}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm text-white ${
                  isQueuePaused 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
                title={isQueuePaused ? 'استئناف إرسال الرسائل المعلقة' : 'إيقاف إرسال الرسائل في الطابور مؤقتاً'}
              >
                {isQueuePaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    استئناف الإرسال
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    إيقاف الإرسال مؤقتاً
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelAllPendingEmails}
                disabled={(queueStatus.find(q => q.status === 'PENDING')?.count || 0) === 0}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40"
                title="إلغاء كافة الرسائل المعلقة حالياً في طابور الانتظار"
              >
                <Trash2 className="w-3.5 h-3.5" />
                إلغاء المعلقة
              </button>

              <button
                type="button"
                onClick={loadQueueData}
                disabled={isLoadingQueue}
                className="p-1.5 text-slate-400 hover:text-spruce-900 hover:bg-slate-200 rounded-lg transition"
                title="تحديث السجل"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
                      ) : email.status === 'CANCELED' ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-bold">
                          ملغاة
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">{email.status}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {email.sent_at || email.created_at}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {email.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => handleResendEmail(email.id)}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold transition"
                        >
                          إعادة الإرسال
                        </button>
                      )}
                      {email.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleCancelSingleEmail(email.id)}
                          className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                          title="إلغاء هذا الإيميل من الطابور"
                        >
                          <Trash2 className="w-3 h-3" />
                          إلغاء
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

      {/* System & Diagnostics Log Viewer */}
      <div className="bg-white rounded-2xl shadow-corporate border border-slate-200/80 overflow-hidden">
        <div className="p-5 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                سجل تشغيل وأخطاء النظام (System & Diagnostics Log)
                <span className="text-[10px] bg-slate-800 text-slate-300 font-normal px-2 py-0.5 rounded-full font-mono">
                  {logs.length} حدث
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                تتبع استعلامات إنفوسوفت، حركة طابور البريد، والعمليات الحسابية
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter tabs */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl text-xs">
              {['ALL', 'INFOSOFT', 'EMAIL', 'DATABASE'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLogFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    logFilterCategory === cat ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'الكل' : cat === 'INFOSOFT' ? 'إنفوسوفت' : cat === 'EMAIL' ? 'البريد' : 'القاعدة'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setLogFilterErrorsOnly(!logFilterErrorsOnly)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                logFilterErrorsOnly 
                  ? 'bg-rose-900/80 border-rose-500 text-rose-200' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              الأخطاء فقط
            </button>

            <button
              type="button"
              onClick={loadLogs}
              disabled={isLoadingLogs}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
              title="تحديث السجلات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              تحديث
            </button>

            <button
              type="button"
              onClick={handleCopyLogs}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
              title="نسخ السجلات للحافظة"
            >
              {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copyFeedback ? 'تم النسخ' : 'نسخ'}
            </button>

            <button
              type="button"
              onClick={handleOpenLogFolder}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition"
              title="فتح مجلد السجلات على القرص"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              مجلد السجلات
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl text-[11px] font-bold flex items-center gap-1 transition border border-rose-800/50"
              title="مسح السجل"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح
            </button>
          </div>
        </div>

        {/* Terminal output box */}
        <div className="bg-slate-950 p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2 select-text dir-ltr text-left">
          {logs.length === 0 ? (
            <div className="text-slate-500 py-6 text-center font-sans text-xs">
              لا توجد أحداث مسجلة مطابقة للشروط الحالية.
            </div>
          ) : (
            logs.map((log, index) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';
              return (
                <div key={index} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5 leading-relaxed">
                  <span className="text-slate-500 shrink-0 text-[11px]">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    isError ? 'bg-rose-900 text-rose-200' : isWarn ? 'bg-amber-900 text-amber-200' : 'bg-slate-800 text-emerald-400'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-teal-400 shrink-0 text-[11px] font-semibold">[{log.category}]</span>
                  <div className="flex-1 break-words">
                    <span className={isError ? 'text-rose-300 font-semibold' : isWarn ? 'text-amber-200' : 'text-slate-200'}>
                      {log.message}
                    </span>
                    {log.details && (
                      <pre className="mt-1 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-40">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
