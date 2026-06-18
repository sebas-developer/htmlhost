const express = require('express');
const router = express.Router();
const pastes = require('../services/pastes');

router.get('/p/:id', (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Not Found</title>
      <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#888}</style>
      </head><body><h1>Paste not found or expired</h1></body></html>
    `);
  }

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox allow-forms; default-src 'none'; style-src 'unsafe-inline'; script-src 'none'");
  res.send(paste.html);
});

module.exports = router;
