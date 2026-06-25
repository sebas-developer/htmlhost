const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const keys = require('../services/keys');
const pastes = require('../services/pastes');
const { getBrowserDerivationParams } = require('../util/mnemonic');

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', (req, res) => {
  const cryptoParams = getBrowserDerivationParams();
  res.render('login', { error: null, cryptoParams });
});

router.post('/login', loginLimiter, express.json(), (req, res) => {
  const { mnemonic } = req.body;
  if (!mnemonic || typeof mnemonic !== 'string') {
    return res.status(400).json({ error: 'Mnemonic required' });
  }

  const words = mnemonic.toLowerCase().trim().split(/\s+/);
  if (words.length !== 12) {
    return res.status(400).json({ error: 'Mnemonic must be 12 words' });
  }

  const apiKey = require('../util/mnemonic').deriveApiKey(mnemonic);
  const hash = require('../util/mnemonic').hashKey(apiKey);
  const key = keys.findByHash(hash);

  if (!key) {
    return res.status(401).json({ error: 'Invalid mnemonic' });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session error' });
    }
    req.session.keyId = key.id;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session error' });
      }
      res.json({ success: true });
    });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/', (req, res) => {
  // Logged-in users go straight to the dashboard.
  // Everyone else gets the landing page that pitches htmlhost to AI agents.
  if (req.session && req.session.keyId) {
    const key = keys.findById(req.session.keyId);
    if (key) {
      const allPastes = pastes.listPastes(key.id, key.account_id, key.scope);
      const allKeys = keys.listKeys(key.account_id);
      const cryptoParams = getBrowserDerivationParams();
      return res.render('dashboard', {
        pastes: allPastes,
        keys: allKeys,
        keyLabel: key.label,
        cryptoParams,
        baseUrl: req.protocol + '://' + req.get('host'),
      });
    }
  }
  res.render('landing', {
    baseUrl: req.protocol + '://' + req.get('host'),
  });
});

module.exports = router;
