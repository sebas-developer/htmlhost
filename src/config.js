const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Persist session secret across restarts
function getSecret() {
  const secretFile = path.join(DATA_DIR, '.session-secret');
  try {
    return fs.readFileSync(secretFile, 'utf8');
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATA_DIR,
  SESSION_SECRET: getSecret(),
  MAX_PASTE_SIZE: 1024 * 1024, // 1MB
  MAX_ASSET_SIZE: 10 * 1024 * 1024, // 10MB
  ASSETS_DIR: path.join(DATA_DIR, 'assets'),
  MAX_ASSETS_PER_PASTE: 50,
  MAX_ASSET_STORAGE_PER_PASTE: 50 * 1024 * 1024, // 50MB total per paste
};
