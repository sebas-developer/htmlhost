const crypto = require('crypto');

// BIP39 English wordlist (2048 words)
const WORDLIST = require('./wordlist');

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32;
const SALT_PREFIX = 'htmlhost-v1:';

function generateMnemonic(wordCount = 12) {
  const entropyBits = wordCount === 24 ? 256 : 128;
  const entropyBytes = entropyBits / 8;
  const entropy = crypto.randomBytes(entropyBytes);

  // SHA-256 checksum
  const hash = crypto.createHash('sha256').update(entropy).digest();
  const checksumBits = entropyBits === 256 ? 8 : 4;

  // Convert entropy + checksum to bit string
  let bits = '';
  for (const byte of entropy) {
    bits += byte.toString(2).padStart(8, '0');
  }
  for (let i = 0; i < checksumBits; i++) {
    bits += ((hash[0] >> (7 - i)) & 1).toString();
  }

  // Split into 11-bit chunks
  const words = [];
  for (let i = 0; i < bits.length; i += 11) {
    const index = parseInt(bits.slice(i, i + 11), 2);
    words.push(WORDLIST[index]);
  }

  return words.join(' ');
}

function decodeMnemonic(phrase) {
  const words = phrase.toLowerCase().trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    throw new Error('Mnemonic must be 12 or 24 words');
  }

  // Convert words to indices
  let bits = '';
  for (const word of words) {
    const index = WORDLIST.indexOf(word);
    if (index === -1) throw new Error(`Unknown word: "${word}"`);
    bits += index.toString(2).padStart(11, '0');
  }

  // Split entropy and checksum
  const entropyBits = words.length === 24 ? 256 : 128;
  const checksumBits = words.length === 24 ? 8 : 4;
  const entropyStr = bits.slice(0, entropyBits);
  const checksumStr = bits.slice(entropyBits, entropyBits + checksumBits);

  // Convert entropy string to buffer
  const entropy = Buffer.alloc(entropyBits / 8);
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(entropyStr.slice(i * 8, (i + 1) * 8), 2);
  }

  // Verify checksum
  const hash = crypto.createHash('sha256').update(entropy).digest();
  let expectedChecksum = '';
  for (let i = 0; i < checksumBits; i++) {
    expectedChecksum += ((hash[0] >> (7 - i)) & 1).toString();
  }
  if (checksumStr !== expectedChecksum) {
    throw new Error('Invalid mnemonic checksum');
  }

  return entropy;
}

function deriveKey(mnemonic, salt) {
  const normalized = mnemonic.toLowerCase().trim().split(/\s+/).join(' ');
  const keySalt = salt || Buffer.from(SALT_PREFIX + normalized, 'utf8');
  return crypto.pbkdf2Sync(normalized, keySalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function deriveApiKey(mnemonic) {
  const key = deriveKey(mnemonic);
  return 'ps_' + key.toString('hex').slice(0, 32);
}

function hashKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function verifyMnemonic(mnemonic, storedHash) {
  try {
    const apiKey = deriveApiKey(mnemonic);
    return crypto.timingSafeEqual(
      Buffer.from(hashKey(apiKey), 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// Browser-compatible derivation (for client-side login)
function getBrowserDerivationParams() {
  return {
    iterations: PBKDF2_ITERATIONS,
    keyLength: KEY_LENGTH,
    saltPrefix: SALT_PREFIX,
  };
}

module.exports = {
  generateMnemonic,
  decodeMnemonic,
  deriveKey,
  deriveApiKey,
  hashKey,
  verifyMnemonic,
  getBrowserDerivationParams,
};
