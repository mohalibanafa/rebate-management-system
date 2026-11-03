import React, { useState, useEffect } from 'react';
import { Settings, Mail, Building, CheckCircle, Save, X, Server } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const [companyName, setCompanyName] = useState('مؤسسة الحلول التجارية');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  
  const [queueStatus, setQueueStatus] = useState([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await window.api.getSettings();
      if (res.company_name) setCompanyName(res.company_name);
      if (res.smtp_config) {
        setSmtpHost(res.smtp_config.host || '');
        setSmtpPort(String(res.smtp_config.port || 587));
        setSmtpUser(res.smtp_config.user || '');
        setSmtpPass(res.smtp_config.pass || '');
        setSmtpFrom(res.smtp_config.from || '');
      }

      const qStats = await window.api.getEmailQueueStatus();
      setQueueStatus(qStats);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await window.api.saveSettings({
        company_name: companyName.trim(),
        smtp_config: {
          host: smtpHost.trim(),
          port: parseInt(smtpPort, 10),
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
          from: smtpFrom.trim() || smtpUser.trim()
        }
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert('خطأ أثناء الحفظ: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <Settings className="w-5 h-5 text-blue-600" />
            إعدادات النظام وخادم البريد (SMTP)
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            تم حفظ الإعدادات بنجاح.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {/* Company Details */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-slate-400" />
              اسم المنشأة / الشركة (يظهر في الترويسة والتقارير):
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* SMTP Settings */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              إعدادات خادم البريد الإلكتروني (SMTP):
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-slate-600 mb-1 font-medium">خادم SMTP (Host):</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com أو mail.yourdomain.com"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">المنفذ (Port):</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587 أو 465"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-medium">اسم المستخدم / البريد:</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="notifications@domain.com"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">كلمة المرور / App Password:</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Email Queue Status Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="font-bold text-slate-700 mb-1">حالة طابور الإشعارات الحالي:</div>
            <div className="flex gap-4 text-[11px] text-slate-600">
              <span>قيد الانتظار: <strong>{queueStatus.find(q => q.status === 'PENDING')?.count || 0}</strong></span>
              <span className="text-emerald-700">تم الإرسال: <strong>{queueStatus.find(q => q.status === 'SENT')?.count || 0}</strong></span>
              <span className="text-rose-700">فشلت: <strong>{queueStatus.find(q => q.status === 'FAILED')?.count || 0}</strong></span>
              <span className="text-slate-400">ملغاة: <strong>{queueStatus.find(q => q.status === 'CANCELLED')?.count || 0}</strong></span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
            >
              إغلاق
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" />
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
