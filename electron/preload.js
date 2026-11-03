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
  grantInvoiceException: (id, reason) => ipcRenderer.invoke('invoice:exception-grant', { id, reason }),
  revokeInvoiceException: (id) => ipcRenderer.invoke('invoice:exception-revoke', id),

  createPayment: (data) => ipcRenderer.invoke('payment:create', data),
  updatePayment: (id, data) => ipcRenderer.invoke('payment:update', { id, data }),

  createAdjustment: (data) => ipcRenderer.invoke('adjustment:create', data),
  updateAdjustment: (id, data) => ipcRenderer.invoke('adjustment:update', { id, data }),

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

  // Print & PDF
  printStatement: () => ipcRenderer.invoke('app:print-statement'),
  exportStatementPDF: (customerName, accountingId) => ipcRenderer.invoke('app:export-pdf', { customerName, accountingId })
});
