const express = require('express');
const crypto = require('crypto');
const path = require('path');
const mime = require('mime-types');
const router = express.Router();
const pastes = require('../services/pastes');
const assets = require('../services/assets');
const config = require('../config');

router.use(express.urlencoded({ extended: false }));

function deriveCookieKey() {
  return crypto.createHmac('sha256', config.SESSION_SECRET).update('paste-cookie-v1').digest();
}

function signPasteCookie(pasteId, passwordHash) {
  const key = deriveCookieKey();
  const payload = `${pasteId}:${passwordHash || 'none'}`;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const pair of header.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  }
  return cookies;
}

function renderPassword(res, status, pasteId, error) {
  return res.status(status).render('password', { pasteId, error });
}

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

  if (paste.password_hash) {
    const cookies = parseCookies(req);
    const cookieName = `paste_${paste.id}`;
    const cookieVal = cookies[cookieName];
    const expected = signPasteCookie(paste.id, paste.password_hash);
    if (!cookieVal || cookieVal !== expected) {
      return renderPassword(res, 403, paste.id);
    }
  }

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'unsafe-inline' https:",
    "img-src * data: blob:",
    "font-src * data:",
    "media-src * data: blob:",
    "connect-src *",
    "frame-src *",
    "object-src 'none'",
  ].join('; '));
  res.send(paste.html);
});

router.post('/p/:id', (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Not Found</title>
      <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#888}</style>
      </head><body><h1>Paste not found or expired</h1></body></html>
    `);
  }

  if (!paste.password_hash) {
    return res.redirect(`/p/${paste.id}`);
  }

  const { password } = req.body || {};
  if (!password) {
    return renderPassword(res, 400, paste.id, 'Password required');
  }

  const valid = pastes.verifyPastePassword(paste.id, password);
  if (!valid) {
    return renderPassword(res, 401, paste.id, 'Invalid password');
  }

  const sig = signPasteCookie(paste.id, paste.password_hash);
  const cookieName = `paste_${paste.id}`;
  res.setHeader('Set-Cookie', `${cookieName}=${sig}; HttpOnly; SameSite=Lax; Path=/p/${paste.id}; Max-Age=86400`);
  res.redirect(`/p/${paste.id}`);
});

router.get('/a/:pasteId/*', (req, res) => {
  const paste = pastes.getPaste(req.params.id || req.params.pasteId);
  if (!paste) {
    return res.status(404).send('Not found');
  }

  if (paste.password_hash) {
    const cookies = parseCookies(req);
    const cookieName = `paste_${paste.id}`;
    const cookieVal = cookies[cookieName];
    const expected = signPasteCookie(paste.id, paste.password_hash);
    if (!cookieVal || cookieVal !== expected) {
      return res.status(403).send('Forbidden');
    }
  }

  const relPath = req.params[0];
  const assetPath = assets.getAssetPath(paste.id, relPath);
  if (!assetPath) {
    return res.status(403).send('Forbidden');
  }

  const fs = require('fs');
  try {
    const stat = fs.statSync(assetPath);
    if (!stat.isFile()) {
      return res.status(404).send('Not found');
    }
  } catch {
    return res.status(404).send('Not found');
  }

  const mimeType = mime.lookup(assetPath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(assetPath);
});

module.exports = router;
