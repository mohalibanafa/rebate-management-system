const fs = require('fs');
const path = require('path');

class AppLogger {
  constructor() {
    this.memoryLogs = [];
    this.maxMemoryLogs = 500;
    this.logFilePath = null;
    this.logDir = null;
  }

  /**
   * Initializes logger with a specific directory (typically userData/rebate_data/logs)
   */
  init(baseDir) {
    try {
      this.logDir = path.join(baseDir, 'logs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.logFilePath = path.join(this.logDir, 'app.log');
      this.info('SYSTEM', 'Logger initialized successfully', { logFilePath: this.logFilePath });
    } catch (err) {
      console.error('[Logger Init Error]:', err);
    }
  }

  _formatDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  log(level, category, message, details = null) {
    const now = new Date();
    const entry = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp: this._formatDate(now),
      isoTime: now.toISOString(),
      level: level.toUpperCase(),
      category: category ? category.toUpperCase() : 'APP',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null
    };

    // Print to stdout/stderr
    const consoleMsg = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
    if (entry.level === 'ERROR') {
      console.error(consoleMsg, details || '');
    } else if (entry.level === 'WARN') {
      console.warn(consoleMsg, details || '');
    } else {
      console.log(consoleMsg);
    }

    // Save in memory
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }

    // Write to file if configured
    if (this.logFilePath) {
      try {
        let fileLine = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
        if (entry.details) {
          fileLine += `\nDETAILS: ${entry.details}`;
        }
        fileLine += '\n';

        fs.appendFileSync(this.logFilePath, fileLine, 'utf8');

        // Simple size check (rotate if > 5MB)
        if (fs.existsSync(this.logFilePath) && fs.statSync(this.logFilePath).size > 5 * 1024 * 1024) {
          const oldPath = path.join(this.logDir, `app_${Date.now()}.old.log`);
          fs.renameSync(this.logFilePath, oldPath);
        }
      } catch (err) {
        // Suppress file write errors to avoid crashing app
      }
    }

    return entry;
  }

  info(category, message, details = null) {
    return this.log('INFO', category, message, details);
  }

  warn(category, message, details = null) {
    return this.log('WARN', category, message, details);
  }

  error(category, message, err = null) {
    let details = null;
    if (err) {
      if (err instanceof Error) {
        details = `${err.message}\n${err.stack || ''}`;
      } else {
        details = typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err);
      }
    }
    return this.log('ERROR', category, message, details);
  }

  getLogs(limit = 200, category = null, level = null) {
    let list = [...this.memoryLogs];
    if (category) {
      const catUpper = category.toUpperCase();
      list = list.filter(l => l.category === catUpper);
    }
    if (level) {
      const lvlUpper = level.toUpperCase();
      list = list.filter(l => l.level === lvlUpper);
    }
    return list.slice(-limit).reverse();
  }

  clearLogs() {
    this.memoryLogs = [];
    if (this.logFilePath && fs.existsSync(this.logFilePath)) {
      try {
        fs.writeFileSync(this.logFilePath, `[${this._formatDate()}] [INFO] [SYSTEM] Logs cleared by user\n`, 'utf8');
      } catch (err) {
        // ignore
      }
    }
    this.info('SYSTEM', 'Logs cleared successfully');
    return true;
  }

  getLogFilePath() {
    return this.logFilePath;
  }

  getLogDir() {
    return this.logDir;
  }
}

const logger = new AppLogger();
module.exports = { logger, AppLogger };
