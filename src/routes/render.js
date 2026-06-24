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

const WATERMARK = `<style>.htmlhost-wm{position:fixed!important;right:14px!important;bottom:14px!important;z-index:2147483647!important;display:inline-flex!important;align-items:center!important;gap:6px!important;font:500 11px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif!important;letter-spacing:.01em!important;color:rgba(255,255,255,.92)!important;text-decoration:none!important;padding:5px 10px!important;border-radius:999px!important;background:rgba(20,20,20,.18)!important;-webkit-backdrop-filter:blur(12px) saturate(160%)!important;backdrop-filter:blur(12px) saturate(160%)!important;border:1px solid rgba(255,255,255,.22)!important;box-shadow:0 2px 8px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.12)!important;text-shadow:0 1px 2px rgba(0,0,0,.35)!important;transition:background .2s ease,color .2s ease,transform .2s ease!important}.htmlhost-wm:hover{background:rgba(20,20,20,.32)!important;color:#fff!important;transform:translateY(-1px)!important}.htmlhost-wm svg{width:10px!important;height:10px!important;opacity:.85!important;flex:none!important}</style><a class="htmlhost-wm" href="https://github.com/sebas-developer/htmlhost" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3.75 2h3.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1-.75-.75v-7.5A.75.75 0 0 1 3.75 2Zm.75 7.5V3.5h2V9.5h-2Zm5-7.5h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75H9.5a.75.75 0 0 1-.75-.75v-3.5A.75.75 0 0 1 9.5 2Zm.75 3.5V3.5h2V5.5h-2Zm-1 3.5a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1-.75-.75V9Zm1.75.75v2h2v-2h-2ZM3 9.75A.75.75 0 0 1 3.75 9h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75h-3.5A.75.75 0 0 1 3 13.25v-3.5ZM4.5 12v-1.5h2V12h-2Z"/></svg>uploaded to html-host</a>`;

function withWatermark(html) {
  const m = html.search(/<\/body\s*>/i);
  return m >= 0 ? html.slice(0, m) + WATERMARK + html.slice(m) : html + WATERMARK;
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
  res.send(withWatermark(paste.html));
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
