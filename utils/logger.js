/**
 * Logger - Simple logging utility
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, `node-${Date.now()}.log`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const currentLevel = levels.INFO;

function formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ');
    return `[${timestamp}] [${level}] ${message}`;
}

function log(level, ...args) {
    if (levels[level] >= currentLevel) {
        const formatted = formatMessage(level, ...args);
        console.log(formatted);
        fs.appendFileSync(LOG_FILE, formatted + '\n');
    }
}

module.exports = {
    debug: (...args) => log('DEBUG', ...args),
    info: (...args) => log('INFO', ...args),
    warn: (...args) => log('WARN', ...args),
    error: (...args) => log('ERROR', ...args),
    levels
};