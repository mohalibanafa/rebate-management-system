const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dbModule = require('../src/db/database');
const { infosoftService } = require('../src/services/infosoftBridge');
const { logger } = require('../src/services/logger');
const { generateStatementHtml } = require('../src/reports/statementPdfTemplate');
const { 
  startEmailWorker, 
  stopEmailWorker, 
  processEmailQueue,
  testSmtpConnection, 
  sendTestEmail, 
  sendWelcomeEmail 
} = require('../src/mail/mailWorker');

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Resolve default data paths
const dataDir = path.join(app.getPath('userData'), 'rebate_data');
const defaultDbPath = path.join(dataDir, 'rebate_system_active.db');
const archivesDir = path.join(dataDir, 'archives');

function ensureDirectories() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(archivesDir)) {
    fs.mkdirSync(archivesDir, { recursive: true });
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  const windowOpts = {
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'نظام إدارة خصم تعجيل الدفع المجمع',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    autoHideMenuBar: true
  };

  if (fs.existsSync(iconPath)) {
    windowOpts.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOpts);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Registration
// -------------------------------------------------------------
function registerIpcHandlers() {
  // DB status & navigation
  ipcMain.handle('db:status', async () => {
    return dbModule.getDatabaseStatus();
  });

  ipcMain.handle('db:list', async () => {
    ensureDirectories();
    const list = [
      {
        id: 'active',
        name: 'قاعدة البيانات النشطة (السنة الحالية)',
        path: defaultDbPath,
        isReadOnly: false,
        isActive: dbModule.getDatabaseStatus().path === defaultDbPath
      }
    ];

    if (fs.existsSync(archivesDir)) {
      const yearDirs = fs.readdirSync(archivesDir, { withFileTypes: true });
      for (const d of yearDirs) {
        if (d.isDirectory()) {
          const year = d.name;
          const candidateDb = path.join(archivesDir, year, `database_${year}_closed.db`);
          if (fs.existsSync(candidateDb)) {
            list.push({
              id: year,
              name: `أرشيف سنة ${year} (للقراءة فقط)`,
              path: candidateDb,
              isReadOnly: true,
              isActive: dbModule.getDatabaseStatus().path === candidateDb
            });
          }
        }
      }
    }

    return list;
  });

  ipcMain.handle('db:switch', async (event, { dbPath, isReadOnly }) => {
    dbModule.openDatabase(dbPath, isReadOnly);
    return dbModule.getDatabaseStatus();
  });

  ipcMain.handle('db:close-year', async (event, { year }) => {
    if (dbModule.getDatabaseStatus().isReadOnly) {
      throw new Error('لا يمكن إغلاق السنة في وضع القراءة فقط.');
    }

    ensureDirectories();
    const yearStr = String(year || new Date().getFullYear());
    const yearArchiveDir = path.join(archivesDir, yearStr);
    const pdfDir = path.join(yearArchiveDir, 'PDF_Statements');

    fs.mkdirSync(pdfDir, { recursive: true });

    // 1. Snapshot database
    const closedDbPath = path.join(yearArchiveDir, `database_${yearStr}_closed.db`);
    fs.copyFileSync(defaultDbPath, closedDbPath);

    // 2. Fetch all customers to retain for the new year
    const existingCustomers = dbModule.getAllCustomers();

    // 3. Re-initialize active DB cleanly for the next year
    const nextYear = Number(yearStr) + 1;
    // Archive statement generation notice
    console.log(`[Archive] Year ${yearStr} frozen to ${closedDbPath}`);

    // Clean reset active database
    dbModule.openDatabase(defaultDbPath, false);
    const db = dbModule.getDb();
    
    // Clear transactions but keep customers
    db.prepare('DELETE FROM email_queue').run();
    db.prepare('DELETE FROM adjustments').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM invoices').run();

    return {
      success: true,
      archivedDbPath: closedDbPath,
      pdfDir: pdfDir,
      nextYear: nextYear
    };
  });

  // Customer handlers
  ipcMain.handle('customer:all', async () => dbModule.getAllCustomers());
  ipcMain.handle('customer:get', async (e, id) => dbModule.getCustomerById(id));
  ipcMain.handle('customer:create', async (e, data) => dbModule.createCustomer(data));
  ipcMain.handle('customer:update', async (e, { id, data }) => dbModule.updateCustomer(id, data));
  ipcMain.handle('customer:delete', async (e, id) => dbModule.deleteCustomer(id));
  ipcMain.handle('customer:statement', async (e, customerId) => dbModule.getCustomerStatement(customerId));
  ipcMain.handle('customer:invoices', async (e, customerId) => dbModule.getInvoicesForCustomer(customerId));

  // Transactions
  ipcMain.handle('invoice:create', async (e, data) => dbModule.createInvoice(data));
  ipcMain.handle('invoice:update', async (e, { id, data }) => dbModule.updateInvoice(id, data));
  ipcMain.handle('invoice:category-update', async (e, { invoiceId, categoryId, customRate }) => {
    return dbModule.updateInvoiceCategory(invoiceId, categoryId, customRate);
  });
  ipcMain.handle('invoice:category-batch-update', async (e, { invoiceIds, categoryId, customRate }) => {
    return dbModule.updateInvoicesBatchCategory(invoiceIds, categoryId, customRate);
  });
  ipcMain.handle('invoice:exception-grant', async (e, { id, reason }) => dbModule.grantInvoiceException(id, reason));
  ipcMain.handle('invoice:exception-revoke', async (e, id) => dbModule.revokeInvoiceException(id));

  ipcMain.handle('payment:create', async (e, data) => dbModule.createPayment(data));
  ipcMain.handle('payment:update', async (e, { id, data }) => dbModule.updatePayment(id, data));

  ipcMain.handle('adjustment:create', async (e, data) => dbModule.createAdjustment(data));
  ipcMain.handle('adjustment:update', async (e, { id, data }) => dbModule.updateAdjustment(id, data));

  // InfoSoft SQL Server ERP Handlers
  ipcMain.handle('infosoft:status', async () => infosoftService.testConnection());
  ipcMain.handle('infosoft:customers', async () => infosoftService.getAllCustomers());
  ipcMain.handle('infosoft:statement', async (e, { customerId, config }) => {
    return infosoftService.generateCustomerStatement(customerId, config);
  });
  ipcMain.handle('infosoft:sync-customer', async (e, { customerId, config }) => {
    return dbModule.syncCustomerFromInfoSoft(customerId, config);
  });
  ipcMain.handle('infosoft:sync-all-customers', async () => {
    return dbModule.syncAllCustomersFromInfoSoft();
  });
  ipcMain.handle('infosoft:config', async (e, newConfig) => {
    if (newConfig) {
      if (newConfig.server) infosoftService.server = newConfig.server;
      if (newConfig.currentYearDb) infosoftService.currentYearDb = newConfig.currentYearDb;
      if (newConfig.prevYearDb) infosoftService.prevYearDb = newConfig.prevYearDb;
      if (newConfig.company !== undefined) infosoftService.company = newConfig.company;
      dbModule.setSetting('infosoft_config', newConfig);
    }
    return {
      server: infosoftService.server,
      currentYearDb: infosoftService.currentYearDb,
      prevYearDb: infosoftService.prevYearDb,
      company: infosoftService.company
    };
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    const smtp = dbModule.getSetting('smtp_config', null);
    const company = dbModule.getSetting('company_name', 'مؤسسة الحلول التجارية');
    return {
      smtp_config: smtp ? JSON.parse(smtp) : null,
      company_name: company
    };
  });

  ipcMain.handle('settings:save', async (e, settings) => {
    if (settings.smtp_config) {
      dbModule.setSetting('smtp_config', settings.smtp_config);
    }
    if (settings.company_name) {
      dbModule.setSetting('company_name', settings.company_name);
    }
    return true;
  });

  ipcMain.handle('email:queue-status', async () => {
    const db = dbModule.getDb();
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM email_queue GROUP BY status
    `).all();
    return counts;
  });

  ipcMain.handle('email:recent', async () => {
    return dbModule.getRecentEmails(25);
  });

  ipcMain.handle('email:test-smtp', async (e, config) => {
    return testSmtpConnection(config);
  });

  ipcMain.handle('email:send-test', async (e, { targetEmail, config }) => {
    return sendTestEmail(targetEmail, config);
  });

  ipcMain.handle('email:send-welcome', async (e, customerId) => {
    return sendWelcomeEmail(customerId);
  });

  ipcMain.handle('email:resend', async (e, queueId) => {
    dbModule.resendEmail(queueId);
    processEmailQueue();
    return true;
  });

  // Email Queue Pause & Cancellation Handlers
  ipcMain.handle('email:is-paused', async () => dbModule.isEmailQueuePaused());
  ipcMain.handle('email:pause-queue', async () => {
    dbModule.pauseEmailQueue();
    logger.info('EMAIL', 'Email queue has been paused by user');
    return true;
  });
  ipcMain.handle('email:resume-queue', async () => {
    dbModule.resumeEmailQueue();
    logger.info('EMAIL', 'Email queue has been resumed by user');
    processEmailQueue();
    return true;
  });
  ipcMain.handle('email:cancel-all-pending', async () => {
    const cancelledCount = dbModule.cancelPendingEmails();
    logger.info('EMAIL', `Cancelled all pending emails (${cancelledCount} emails cancelled)`);
    return cancelledCount;
  });
  ipcMain.handle('email:cancel', async (e, id) => {
    const cancelled = dbModule.cancelEmail(id);
    logger.info('EMAIL', `Cancelled email #${id}`);
    return cancelled;
  });

  // System Logs Handlers
  ipcMain.handle('log:get', async (e, params) => {
    return logger.getLogs(params?.limit || 200, params?.category, params?.level);
  });
  ipcMain.handle('log:clear', async () => {
    return logger.clearLogs();
  });
  ipcMain.handle('log:open-folder', async () => {
    const dir = logger.getLogDir();
    if (dir && fs.existsSync(dir)) {
      shell.openPath(dir);
      return true;
    }
    return false;
  });

  ipcMain.handle('db:backup', async () => {
    if (!mainWindow) return null;
    const dateStr = new Date().toISOString().slice(0, 10);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ نسخة احتياطية من قاعدة البيانات',
      defaultPath: path.join(app.getPath('documents'), `rebate_database_backup_${dateStr}.db`),
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (filePath) {
      fs.copyFileSync(defaultDbPath, filePath);
      return filePath;
    }
    return null;
  });

  // Print & PDF using dedicated, standalone HTML template
  ipcMain.handle('app:print-statement', async (e, customerIdOrParams, maybeOptions) => {
    try {
      let customerId = typeof customerIdOrParams === 'object' ? customerIdOrParams.customerId : customerIdOrParams;
      let options = typeof customerIdOrParams === 'object' ? customerIdOrParams : (maybeOptions || {});
      const statement = dbModule.getCustomerStatement(customerId);
      const company = dbModule.getSetting('company_name', 'مؤسسة الحلول التجارية المتقدمة');
      const html = generateStatementHtml(statement, { ...options, company_name: company });

      const printWin = new BrowserWindow({
        show: false,
        width: 1024,
        height: 1448,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      printWin.webContents.print({
        silent: false,
        printBackground: true
      }, (success, failureReason) => {
        if (!printWin.isDestroyed()) printWin.destroy();
      });
      return true;
    } catch (err) {
      console.error('[Print Statement Error]:', err);
      throw err;
    }
  });

  ipcMain.handle('app:export-pdf', async (e, params) => {
    try {
      let customerId;
      let options = {};
      if (typeof params === 'number') {
        customerId = params;
      } else if (typeof params === 'object' && params?.customerId) {
        customerId = params.customerId;
        options = params;
      }

      if (!customerId) {
        throw new Error('رقم العميل مطلوب لتصدير كشف الحساب.');
      }

      const statement = dbModule.getCustomerStatement(customerId);
      const company = dbModule.getSetting('company_name', 'مؤسسة الحلول التجارية المتقدمة');
      const html = generateStatementHtml(statement, { ...options, company_name: company });

      const defaultName = `كشف_حساب_${statement.customer.accounting_system_id}_${statement.customer.name.replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'حفظ كشف الحساب المالي بصيغة PDF',
        defaultPath: path.join(app.getPath('documents'), defaultName),
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });

      if (!filePath) return null;

      const printWin = new BrowserWindow({
        show: false,
        width: 1024,
        height: 1448,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        margins: {
          marginType: 'custom',
          top: 0.35,
          bottom: 0.35,
          left: 0.35,
          right: 0.35
        }
      });

      fs.writeFileSync(filePath, pdfBuffer);
      if (!printWin.isDestroyed()) printWin.destroy();
      return filePath;
    } catch (err) {
      console.error('[Export PDF Error]:', err);
      throw err;
    }
  });
}

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(() => {
  ensureDirectories();
  logger.init(dataDir);
  dbModule.openDatabase(defaultDbPath, false);

  // Load saved InfoSoft configuration on startup
  const savedInfosoftConfig = dbModule.getSetting('infosoft_config', null);
  if (savedInfosoftConfig) {
    try {
      const conf = JSON.parse(savedInfosoftConfig);
      if (conf.server) infosoftService.server = conf.server;
      if (conf.currentYearDb) infosoftService.currentYearDb = conf.currentYearDb;
      if (conf.prevYearDb) infosoftService.prevYearDb = conf.prevYearDb;
      if (conf.company !== undefined) infosoftService.company = conf.company;
      if (conf.username) infosoftService.username = conf.username;
      if (conf.password) infosoftService.password = conf.password;
      logger.info('INFOSOFT', 'Loaded saved InfoSoft configuration on startup', conf);
    } catch (e) {
      logger.error('INFOSOFT', 'Failed parsing saved InfoSoft configuration', e);
    }
  }

  registerIpcHandlers();
  createWindow();
  startEmailWorker(15000);

  // Initial sync of all accounts on first-time startup if not yet performed
  setTimeout(async () => {
    try {
      const isSynced = dbModule.getSetting('initial_infosoft_sync_done', '0');
      const custCount = dbModule.getAllCustomers().length;
      if (isSynced !== '1' || custCount === 0) {
        logger.info('INFOSOFT', 'Checking initial InfoSoft sync for all accounts...');
        const res = await dbModule.syncAllCustomersFromInfoSoft();
        if (res && res.success) {
          logger.info('INFOSOFT', `Initial startup customer sync completed. Imported ${res.syncedCount} accounts.`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('customers:updated');
          }
        }
      }
    } catch (err) {
      logger.warn('INFOSOFT', 'First-time startup sync could not connect (InfoSoft may be offline or starting up)', { error: err.message });
    }
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopEmailWorker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
