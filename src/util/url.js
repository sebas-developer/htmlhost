const crypto = require('crypto');

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LENGTH = 6;

function generateId() {
  const bytes = crypto.randomBytes(LENGTH);
  let id = '';
  for (let i = 0; i < LENGTH; i++) {
    id += CHARS[bytes[i] % CHARS.length];
  }
  return id;
}

function isValidId(id) {
  return typeof id === 'string' && id.length === LENGTH && /^[a-zA-Z0-9]+$/.test(id);
}

module.exports = { generateId, isValidId };
