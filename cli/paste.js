#!/usr/bin/env node
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.PASTE_URL || 'http://localhost:3000';
const API_KEY = process.env.PASTE_API_KEY;

const args = process.argv.slice(2);
const command = args[0];

function request(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const mod = url.protocol === 'https:' ? https : http;

    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...headers,
        ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
      },
    };

    if (body !== undefined) {
      if (typeof body === 'string') {
        opts.headers['Content-Type'] = 'text/html';
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      } else {
        opts.headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }
    }

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function printHelp() {
  console.log(`
htmlhost CLI

Usage:
  node cli/paste.js <command> [args]

Commands:
  create-user              Create new user (generates mnemonic + API key)
  upload <file> [opts]     Upload HTML file
    --ttl <duration>       TTL: 1h, 3h, 1d, 3d, 7d, 30d, indefinite (default: 3d)
  list                     List your pastes
  delete <id>              Delete a paste
  info <id>                Get paste info
  keys                     List API keys
  create-key [label]       Create new API key
  delete-key <id>          Delete an API key

Environment:
  PASTE_API_KEY            Your API key (required for most commands)
  PASTE_URL                Service URL (default: http://localhost:3000)
`);
}

async function createKey(label) {
  // Generate mnemonic locally (no server needed)
  const { generateMnemonic, deriveApiKey, hashKey } = require('../src/util/mnemonic');
  const crypto = require('crypto');

  const mnemonic = generateMnemonic();
  const apiKey = deriveApiKey(mnemonic);
  const id = crypto.randomBytes(8).toString('hex');
  const hash = hashKey(apiKey);

  return { id, mnemonic, apiKey, hash };
}

async function main() {
  try {
    switch (command) {
      case 'create-user': {
        const creds = await createKey(args[1]);
        const label = args[1] || 'default';

        // Register with server
        const res = await request('POST', '/api/auth/register', {
          body: { id: creds.id, hash: creds.hash, label }
        });

        if (res.status === 201) {
          console.log('\n  Your mnemonic phrase (WRITE THIS DOWN — NO RECOVERY):\n');
          console.log(`  ${creds.mnemonic}\n`);
          console.log(`  Your API Key: ${creds.apiKey}`);
          console.log(`  Key ID: ${creds.id}\n`);
          console.log('  Save these securely. The mnemonic is shown only once.\n');
        } else {
          console.error('Error registering key:', res.data.error || res.data);
        }
        break;
      }

      case 'create-key': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        const res = await request('POST', '/api/keys', {
          body: { label: args[1] || 'default' }
        });
        if (res.status === 201) {
          console.log('\nKey created!\n');
          console.log(`  Mnemonic: ${res.data.mnemonic}`);
          console.log(`  API Key:  ${res.data.apiKey}`);
          console.log('\n  SAVE THESE NOW. They won\'t be shown again.\n');
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }

      case 'upload': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        if (!args[1]) { console.error('Error: file path required'); process.exit(1); }
        const filePath = path.resolve(args[1]);
        if (!fs.existsSync(filePath)) { console.error('Error: file not found:', filePath); process.exit(1); }
        const html = fs.readFileSync(filePath, 'utf8');
        const ttlIdx = args.indexOf('--ttl');
        const ttl = ttlIdx !== -1 ? args[ttlIdx + 1] : '3d';
        const res = await request('POST', '/api/pastes', {
          body: html,
          headers: { 'X-TTL': ttl }
        });
        if (res.status === 201) {
          console.log(`\n  Uploaded: ${BASE_URL}${res.data.url}`);
          console.log(`  ID: ${res.data.id}`);
          console.log(`  Expires: ${res.data.expiresAt || 'never'}\n`);
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }

      case 'list': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        const res = await request('GET', '/api/pastes');
        if (res.status !== 200) { console.error('Error:', res.data.error); break; }
        if (res.data.length === 0) {
          console.log('\n  No pastes yet.\n');
        } else {
          console.log(`\n  ${res.data.length} paste(s):\n`);
          res.data.forEach(p => {
            const exp = p.expired ? ' (EXPIRED)' : p.ttl === 'never' ? '' : ` (${p.ttl})`;
            console.log(`    ${p.id}${exp}  ${BASE_URL}${p.url}`);
          });
          console.log('');
        }
        break;
      }

      case 'delete': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        if (!args[1]) { console.error('Error: paste ID required'); process.exit(1); }
        const res = await request('DELETE', `/api/pastes/${args[1]}`);
        if (res.status === 200) {
          console.log('  Deleted.');
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }

      case 'info': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        if (!args[1]) { console.error('Error: paste ID required'); process.exit(1); }
        const res = await request('GET', `/api/pastes/${args[1]}`);
        if (res.status === 200) {
          console.log(`\n  ID:       ${res.data.id}`);
          console.log(`  Created:  ${res.data.createdAt}`);
          console.log(`  Expires:  ${res.data.expiresAt || 'never'}`);
          console.log(`  URL:      ${BASE_URL}/p/${res.data.id}\n`);
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }

      case 'keys': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        const res = await request('GET', '/api/keys');
        if (res.status !== 200) { console.error('Error:', res.data.error); break; }
        if (res.data.length === 0) {
          console.log('\n  No keys.\n');
        } else {
          console.log(`\n  ${res.data.length} key(s):\n`);
          res.data.forEach(k => {
            console.log(`    ${k.id}  ${k.label || '(unnamed)'}  ${k.createdAt}`);
          });
          console.log('');
        }
        break;
      }

      case 'delete-key': {
        if (!API_KEY) { console.error('Error: PASTE_API_KEY required'); process.exit(1); }
        if (!args[1]) { console.error('Error: key ID required'); process.exit(1); }
        const res = await request('DELETE', `/api/keys/${args[1]}`);
        if (res.status === 200) {
          console.log(`  Deleted. ${res.data.deletedPastes} paste(s) removed.`);
        } else {
          console.error('Error:', res.data.error);
        }
        break;
      }

      default:
        printHelp();
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
