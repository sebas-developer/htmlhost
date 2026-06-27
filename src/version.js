const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLI_VERSION = require('../package.json').version;

let _skillChecksum;
function getSkillChecksum() {
  if (_skillChecksum !== undefined) return _skillChecksum;
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', 'skills', 'paste-service.md'), 'utf8');
    _skillChecksum = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch { _skillChecksum = null; }
  return _skillChecksum;
}

module.exports = { CLI_VERSION, getSkillChecksum };
