const express = require('express');
const router = express.Router();
const keys = require('../services/keys');
const pastes = require('../services/pastes');
const { requireSession } = require('../auth');
const { getBrowserDerivationParams } = require('../util/mnemonic');

router.get('/login', (req, res) => {
  const cryptoParams = getBrowserDerivationParams();
  res.render('login', { error: null, cryptoParams });
});

router.post('/login', express.json(), (req, res) => {
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

  req.session.keyId = key.id;
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

router.get('/', requireSession, (req, res) => {
  const allPastes = pastes.listPastes(req.keyId);
  const allKeys = keys.listKeys();
  const cryptoParams = getBrowserDerivationParams();
  res.render('dashboard', {
    pastes: allPastes,
    keys: allKeys,
    keyLabel: req.keyLabel,
    cryptoParams,
    baseUrl: req.protocol + '://' + req.get('host'),
  });
});

module.exports = router;
