import React, { useState } from 'react';
import { Archive, AlertTriangle, CheckCircle, FolderCheck, X } from 'lucide-react';

export default function YearCloseModal({ isOpen, onClose, onSuccess }) {
  const currentYear = new Date().getFullYear();
  const [closingYear, setClosingYear] = useState(currentYear);
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleCloseYear = async (e) => {
    e.preventDefault();
    if (confirmText !== 'إغلاق') {
      setError('يرجى كتابة كلمة "إغلاق" للتأكيد.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await window.api.closeFiscalYear(closingYear);
      setResult(res);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'فشل في إغلاق السنة المالية.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <Archive className="w-5 h-5 text-amber-600" />
            إغلاق السنة المالية وأرشفة الحسابات
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                تم إغلاق سنة {closingYear} وأرشفة البيانات بنجاح!
              </div>
              <p>تم حفظ نسخة قاعدة البيانات المقفلة داخل:</p>
              <code className="block bg-white p-2 rounded border border-emerald-200 my-1 font-mono text-[11px] break-all">
                {result.archivedDbPath}
              </code>
              <p className="mt-2">تم تجهيز السنة الجديدة ({result.nextYear}) بقاعدة بيانات نشطة نظيفة مع الاحتفاظ بملفات العملاء.</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                تم والعودة للبرنامج
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCloseYear} className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">تنبيه هام حول عملية الإغلاق السنوي:</p>
                  <p>1. سيتم تجميد جميع فواتير وسدادات سنة {closingYear} ونقلها للأرشيف المحمي (للقراءة فقط).</p>
                  <p>2. سيتم إنشاء قاعدة بيانات نشطة فارغة لسنة {closingYear + 1} مع ترحيل بيانات العملاء.</p>
                  <p>3. يمكنك دائماً مراجعة كشوفات سنة {closingYear} من قائمة الأرشيف العلوية.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">السنة المالية المراد إغلاقها:</label>
              <input
                type="number"
                required
                value={closingYear}
                onChange={(e) => setClosingYear(parseInt(e.target.value, 10))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                اكتب كلمة <span className="text-red-600 font-black">"إغلاق"</span> في الحقل أدناه للمتابعة:
              </label>
              <input
                type="text"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="إغلاق"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isProcessing || confirmText !== 'إغلاق'}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
              >
                {isProcessing ? 'جاري الأرشفة والتجميد...' : 'تأكيد إغلاق السنة المالية'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
