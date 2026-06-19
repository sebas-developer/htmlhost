const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pastes = require('../services/pastes');
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

function escapeHtml(str) {
  return String(str).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]);
}

function passwordForm(pasteId, error) {
  return `<!DOCTYPE html>
<html><head><title>Password Required</title>
<style>
  body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#ccc}
  .box{text-align:center;padding:2rem;border:1px solid #333;border-radius:8px;background:#111}
  input{padding:.5rem 1rem;border:1px solid #444;border-radius:4px;background:#1a1a1a;color:#fff;font-size:1rem;width:200px}
  button{padding:.5rem 1.5rem;border:none;border-radius:4px;background:#2563eb;color:#fff;font-size:1rem;cursor:pointer;margin-top:.5rem}
  button:hover{background:#1d4ed8}
  .err{color:#ef4444;margin-bottom:.5rem}
</style>
</head><body>
<div class="box">
  <h2>This paste is password-protected</h2>
  ${error ? '<p class="err">' + escapeHtml(error) + '</p>' : ''}
  <form method="POST" action="/p/${escapeHtml(pasteId)}">
    <input type="password" name="password" placeholder="Enter password" autofocus>
    <br><br>
    <button type="submit">Unlock</button>
  </form>
</div>
</body></html>`;
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
      res.setHeader('Content-Type', 'text/html');
      return res.status(403).send(passwordForm(paste.id));
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
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(passwordForm(paste.id, 'Password required'));
  }

  const valid = pastes.verifyPastePassword(paste.id, password);
  if (!valid) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(401).send(passwordForm(paste.id, 'Invalid password'));
  }

  const sig = signPasteCookie(paste.id, paste.password_hash);
  const cookieName = `paste_${paste.id}`;
  res.setHeader('Set-Cookie', `${cookieName}=${sig}; HttpOnly; SameSite=Lax; Path=/p/${paste.id}; Max-Age=86400`);
  res.redirect(`/p/${paste.id}`);
});

module.exports = router;
