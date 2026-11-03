const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbModule = require('../src/db/database');
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
  ipcMain.handle('invoice:exception-grant', async (e, { id, reason }) => dbModule.grantInvoiceException(id, reason));
  ipcMain.handle('invoice:exception-revoke', async (e, id) => dbModule.revokeInvoiceException(id));

  ipcMain.handle('payment:create', async (e, data) => dbModule.createPayment(data));
  ipcMain.handle('payment:update', async (e, { id, data }) => dbModule.updatePayment(id, data));

  ipcMain.handle('adjustment:create', async (e, data) => dbModule.createAdjustment(data));
  ipcMain.handle('adjustment:update', async (e, { id, data }) => dbModule.updateAdjustment(id, data));

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

  // Print & PDF
  ipcMain.handle('app:print-statement', async () => {
    if (!mainWindow) return false;
    mainWindow.webContents.print({
      silent: false,
      printBackground: true
    });
    return true;
  });

  ipcMain.handle('app:export-pdf', async (e, { customerName, accountingId }) => {
    if (!mainWindow) return null;
    const defaultName = `كشف_حساب_${accountingId}_${customerName.replace(/[\/\\:*?"<>|]/g, '_')}.pdf`;
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ كشف الحساب بصيغة PDF',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (filePath) {
      const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false
      });
      fs.writeFileSync(filePath, data);
      return filePath;
    }
    return null;
  });
}

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(() => {
  ensureDirectories();
  dbModule.openDatabase(defaultDbPath, false);
  registerIpcHandlers();
  createWindow();
  startEmailWorker(15000);

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
