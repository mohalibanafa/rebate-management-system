const nodemailer = require('nodemailer');
const dbModule = require('../db/database');

let isWorkerRunning = false;
let workerInterval = null;

/**
 * Creates Nodemailer transporter based on DB settings
 */
function getTransporter() {
  const smtpConfigStr = dbModule.getSetting('smtp_config', null);
  if (!smtpConfigStr) {
    return null;
  }

  try {
    const config = JSON.parse(smtpConfigStr);
    if (!config.host || !config.user || !config.pass) {
      return null;
    }

    return nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
      secure: Number(config.port) === 465,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (err) {
    console.error('Failed to parse SMTP configuration:', err.message);
    return null;
  }
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
        const fromAddress = smtpConfig.from || smtpConfig.user;

        await transporter.sendMail({
          from: `"نظام إدارة الخصم" <${fromAddress}>`,
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
  processEmailQueue
};
