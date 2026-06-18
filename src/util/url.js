const crypto = require('crypto');

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LENGTH = 8;
const VALID_BYTES = 248; // 62 * 4 = 248, discard bytes >= 248 to eliminate modulo bias

function generateId() {
  let id = '';
  while (id.length < LENGTH) {
    const bytes = crypto.randomBytes(LENGTH);
    for (let i = 0; i < bytes.length && id.length < LENGTH; i++) {
      if (bytes[i] < VALID_BYTES) {
        id += CHARS[bytes[i] % CHARS.length];
      }
    }
  }
  return id;
}

function isValidId(id) {
  return typeof id === 'string' && id.length === LENGTH && /^[a-zA-Z0-9]+$/.test(id);
}

module.exports = { generateId, isValidId };
