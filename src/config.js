const path = require('path');

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  SESSION_SECRET: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  MAX_PASTE_SIZE: 1024 * 1024, // 1MB
};
