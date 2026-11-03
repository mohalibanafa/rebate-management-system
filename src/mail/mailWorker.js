const nodemailer = require('nodemailer');
const dbModule = require('../db/database');

let isWorkerRunning = false;
let workerInterval = null;

/**
 * Creates Nodemailer transporter based on DB settings or passed config
 */
function getTransporter(customConfig = null) {
  let config = customConfig;
  if (!config) {
    const smtpConfigStr = dbModule.getSetting('smtp_config', null);
    if (!smtpConfigStr) return null;
    try {
      config = JSON.parse(smtpConfigStr);
    } catch (e) {
      return null;
    }
  }

  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host.trim(),
    port: Number(config.port) || 587,
    secure: Number(config.port) === 465,
    auth: {
      user: config.user.trim(),
      pass: config.pass.trim()
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Verifies SMTP connection
 */
async function testSmtpConnection(customConfig = null) {
  const transporter = getTransporter(customConfig);
  if (!transporter) {
    throw new Error('بيانات خادم SMTP غير مكتملة (المضيف، المستخدم، وكلمة المرور مطلوبة).');
  }
  return new Promise((resolve, reject) => {
    transporter.verify((error, success) => {
      if (error) {
        reject(new Error(`فشل الاتصال بخادم البريد: ${error.message}`));
      } else {
        resolve({ success: true, message: 'تم الاتصال بخادم البريد بنجاح واجتياز المصادقة!' });
      }
    });
  });
}

/**
 * Sends an immediate test email
 */
async function sendTestEmail(targetEmail, customConfig = null) {
  const transporter = getTransporter(customConfig);
  if (!transporter) {
    throw new Error('يرجى حفظ إعدادات خادم البريد أولاً.');
  }

  let config = customConfig;
  if (!config) {
    config = JSON.parse(dbModule.getSetting('smtp_config', '{}'));
  }

  const fromAddress = config.from || config.user;
  const companyName = dbModule.getSetting('company_name', 'نظام إدارة الخصم التراكمي');

  const info = await transporter.sendMail({
    from: `"${companyName}" <${fromAddress}>`,
    to: targetEmail,
    subject: `رسالة اختبارية من ${companyName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #0E2F33; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #7FA3A0; border-radius: 12px; background: #ffffff;">
        <div style="background: #0E2F33; padding: 15px; border-radius: 8px; text-align: center; color: #E6D6B8;">
          <h2 style="margin: 0; font-size: 20px;">${companyName}</h2>
          <span style="font-size: 13px; color: #B08B4F;">فحص جاهزية خادم الإشعارات البريدية</span>
        </div>
        <p style="margin-top: 20px; font-size: 15px;">السلام عليكم ورحمة الله وبركاته،،</p>
        <p>هذه رسالة اختبارية لتأكيد صحة إعدادات خادم البريد الإلكتروني (SMTP). تم ربط الخادم بنجاح والنظام جاهز الآن لإرسال إشعارات الفواتير ورصيد الخصم التراكمي لعملائكم الكرام.</p>
        <div style="background: #f7f3ec; border-right: 4px solid #B08B4F; padding: 12px; margin: 15px 0; font-size: 13px;">
          <strong>تاريخ الاختبار:</strong> ${new Date().toLocaleString('ar-SA')}
        </div>
        <p style="color: #7FA3A0; font-size: 12px; text-align: center; margin-top: 25px;">تم الإرسال آلياً عبر نظام إدارة خصم تعجيل الدفع المجمع.</p>
      </div>
    `
  });

  return { success: true, messageId: info.messageId };
}

/**
 * Generates and queues/sends a welcome email to a new or existing customer
 */
async function sendWelcomeEmail(customerId) {
  const customer = dbModule.getCustomerById(customerId);
  if (!customer) {
    throw new Error('العميل غير موجود.');
  }
  if (!customer.email || !customer.email.includes('@')) {
    throw new Error('العميل ليس لديه بريد إلكتروني صالح مسجل.');
  }

  const companyName = dbModule.getSetting('company_name', 'مؤسسة الحلول التجارية');
  const discountRatePercent = (Number(customer.default_discount_rate || 0.07) * 100).toFixed(1);
  const graceDays = customer.default_grace_days || 30;

  const subject = `مرحباً بكم في برنامج خصم تعجيل الدفع الذكي - ${companyName}`;
  const bodyHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.7; color: #0E2F33; max-width: 620px; margin: auto; padding: 25px; border: 1px solid #7FA3A0; border-radius: 12px; background: #ffffff;">
      <div style="background: #0E2F33; padding: 20px; border-radius: 8px; text-align: center; color: #E6D6B8;">
        <h2 style="margin: 0; font-size: 22px; font-weight: bold;">${companyName}</h2>
        <div style="color: #B08B4F; font-size: 14px; margin-top: 4px; font-weight: bold;">برنامج خصم تعجيل الدفع المجمع الذكي (Rebate Program)</div>
      </div>

      <div style="padding: 20px 0;">
        <h3 style="color: #1D5459; margin-bottom: 8px;">السادة / ${customer.name} المحترمين،</h3>
        <p style="font-size: 14px; color: #333;">
          يسرنا إشعاركم بانضمام حسابكم برقم <strong>(${customer.accounting_system_id})</strong> إلى <strong>برنامج خصم تعجيل الدفع الذكي</strong>، والذي صُمم تقديراً لشركائنا المتميزين ومكافأة السداد المبكر.
        </p>

        <div style="background: #f7f3ec; border: 1px solid #E6D6B8; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #0E2F33; font-size: 15px; border-bottom: 1px dashed #B08B4F; padding-bottom: 6px;">
            💎 شروط الخصم المعتمدة لحسابكم:
          </h4>
          <ul style="margin: 0; padding-right: 20px; font-size: 13.5px; color: #1D5459;">
            <li style="margin-bottom: 8px;">
              <strong>نسبة الخصم المكتسبة:</strong> <span style="color: #B08B4F; font-weight: bold; font-size: 15px;">${discountRatePercent}%</span> على المبيعات الصافية.
            </li>
            <li style="margin-bottom: 8px;">
              <strong>مهلة السداد:</strong> خلال <strong>${graceDays} يوماً</strong> من تاريخ صدور الفاتورة.
            </li>
            <li style="margin-bottom: 8px;">
              <strong>الخصم النسبي:</strong> في حال السداد الجزئي، يُحسب الخصم على الجزء المسدد في المهلة دون حرمانكم.
            </li>
            <li>
              <strong>التسوية التراكمية:</strong> يُجمع رصيد الخصم طوال العام المالي ويُسوى لصالحكم بانتظام.
            </li>
          </ul>
        </div>

        <p style="font-size: 13px; color: #555;">
          ستصلكم إشعارات دورية مع كل فاتورة أو دفعة توضح رصيد خصمكم المجمع حتى تاريخه لتسهيل المطابقة المحاسبية.
        </p>

        <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; color: #7FA3A0; font-size: 12px;">
          سعداء دائماً بالتعاون معكم • ${companyName}
        </div>
      </div>
    </div>
  `;

  // Queue email
  dbModule.queueEmail(customer.email, subject, bodyHtml, 'WELCOME', customerId);

  // Trigger queue check immediately
  processEmailQueue();

  return { success: true, email: customer.email };
}

/**
 * Processes a single batch of pending emails
 */
async function processEmailQueue() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const transporter = getTransporter();
    if (!transporter) {
      isWorkerRunning = false;
      return;
    }

    const pending = dbModule.getPendingEmails(3);
    for (const email of pending) {
      try {
        const smtpConfig = JSON.parse(dbModule.getSetting('smtp_config', '{}'));
        const companyName = dbModule.getSetting('company_name', 'نظام إدارة الخصم');
        const fromAddress = smtpConfig.from || smtpConfig.user;

        await transporter.sendMail({
          from: `"${companyName}" <${fromAddress}>`,
          to: email.recipient_email,
          subject: email.subject,
          html: email.body_html
        });

        dbModule.markEmailSent(email.id);
        console.log(`[Email Worker] Sent email #${email.id} to ${email.recipient_email}`);
      } catch (err) {
        console.error(`[Email Worker] Error sending email #${email.id}:`, err.message);
        dbModule.markEmailFailed(email.id, err.message);
      }
    }
  } catch (err) {
    console.error('[Email Worker] Unexpected error in queue loop:', err.message);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Starts the throttled background email worker
 */
function startEmailWorker(intervalMs = 15000) {
  if (workerInterval) {
    clearInterval(workerInterval);
  }
  workerInterval = setInterval(processEmailQueue, intervalMs);
  console.log(`[Email Worker] Started with interval: ${intervalMs}ms`);
}

function stopEmailWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[Email Worker] Stopped.');
  }
}

module.exports = {
  startEmailWorker,
  stopEmailWorker,
  processEmailQueue,
  testSmtpConnection,
  sendTestEmail,
  sendWelcomeEmail
};
