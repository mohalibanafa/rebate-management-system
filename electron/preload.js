const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Database & Archive
  getDatabaseStatus: () => ipcRenderer.invoke('db:status'),
  listAvailableDatabases: () => ipcRenderer.invoke('db:list'),
  switchDatabase: (dbPath, isReadOnly) => ipcRenderer.invoke('db:switch', { dbPath, isReadOnly }),
  closeFiscalYear: (year) => ipcRenderer.invoke('db:close-year', { year }),

  // Customers
  getAllCustomers: () => ipcRenderer.invoke('customer:all'),
  getCustomerById: (id) => ipcRenderer.invoke('customer:get', id),
  createCustomer: (data) => ipcRenderer.invoke('customer:create', data),
  updateCustomer: (id, data) => ipcRenderer.invoke('customer:update', { id, data }),
  deleteCustomer: (id) => ipcRenderer.invoke('customer:delete', id),
  getCustomerStatement: (customerId) => ipcRenderer.invoke('customer:statement', customerId),
  getInvoicesForCustomer: (customerId) => ipcRenderer.invoke('customer:invoices', customerId),

  // Transactions
  createInvoice: (data) => ipcRenderer.invoke('invoice:create', data),
  updateInvoice: (id, data) => ipcRenderer.invoke('invoice:update', { id, data }),
  updateInvoiceCategory: (invoiceId, categoryId, customRate) => ipcRenderer.invoke('invoice:category-update', { invoiceId, categoryId, customRate }),
  grantInvoiceException: (id, reason) => ipcRenderer.invoke('invoice:exception-grant', { id, reason }),
  revokeInvoiceException: (id) => ipcRenderer.invoke('invoice:exception-revoke', id),

  createPayment: (data) => ipcRenderer.invoke('payment:create', data),
  updatePayment: (id, data) => ipcRenderer.invoke('payment:update', { id, data }),

  createAdjustment: (data) => ipcRenderer.invoke('adjustment:create', data),
  updateAdjustment: (id, data) => ipcRenderer.invoke('adjustment:update', { id, data }),

  // InfoSoft SQL Server Integration
  infosoft: {
    getStatus: () => ipcRenderer.invoke('infosoft:status'),
    getCustomers: () => ipcRenderer.invoke('infosoft:customers'),
    getStatement: (customerId, config) => ipcRenderer.invoke('infosoft:statement', { customerId, config }),
    syncCustomer: (customerId, config) => ipcRenderer.invoke('infosoft:sync-customer', { customerId, config }),
    configure: (newConfig) => ipcRenderer.invoke('infosoft:config', newConfig)
  },

  // Settings & Email
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getEmailQueueStatus: () => ipcRenderer.invoke('email:queue-status'),
  getRecentEmails: () => ipcRenderer.invoke('email:recent'),
  testSmtpConnection: (config) => ipcRenderer.invoke('email:test-smtp', config),
  sendTestEmail: (targetEmail, config) => ipcRenderer.invoke('email:send-test', { targetEmail, config }),
  sendWelcomeEmail: (customerId) => ipcRenderer.invoke('email:send-welcome', customerId),
  resendEmail: (queueId) => ipcRenderer.invoke('email:resend', queueId),
  backupDatabase: () => ipcRenderer.invoke('db:backup'),

  // Email Queue Control
  emailQueue: {
    isPaused: () => ipcRenderer.invoke('email:is-paused'),
    pause: () => ipcRenderer.invoke('email:pause-queue'),
    resume: () => ipcRenderer.invoke('email:resume-queue'),
    cancelAllPending: () => ipcRenderer.invoke('email:cancel-all-pending'),
    cancel: (id) => ipcRenderer.invoke('email:cancel', id)
  },

  // System Logs & Diagnostics
  logs: {
    get: (params) => ipcRenderer.invoke('log:get', params),
    clear: () => ipcRenderer.invoke('log:clear'),
    openFolder: () => ipcRenderer.invoke('log:open-folder')
  },

  // Print & PDF
  printStatement: (customerId) => ipcRenderer.invoke('app:print-statement', customerId),
  exportStatementPDF: (customerId) => ipcRenderer.invoke('app:export-pdf', { customerId })
});
