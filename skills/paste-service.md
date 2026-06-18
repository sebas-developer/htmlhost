---
name: paste-service
description: >
  Upload HTML to paste service, manage pastes via CLI.
  Disposable HTML hosting with random URLs and auto-deletion.
  Trigger: "upload html", "host html", "paste html", "paste service"
---

# htmlhost — Disposable HTML Hosting

Upload HTML files to get random URLs. Auto-deletes after configurable TTL.

## Setup

```bash
cd paste-service
npm install
node cli/paste.js create-user
```

This generates a mnemonic phrase and API key. **Save both.**

## Environment

```bash
export PASTE_API_KEY=ps_...  # Your API key
export PASTE_URL=https://htmlhost.fly.dev  # Optional, defaults to localhost:3000
```

## Commands

```bash
# Upload HTML
node cli/paste.js upload index.html
node cli/paste.js upload index.html --ttl 7d

# List pastes
node cli/paste.js list

# Delete paste
node cli/paste.js delete <id>

# Get paste info
node cli/paste.js info <id>

# Manage keys
node cli/paste.js create-key "my-label"
node cli/paste.js keys
node cli/paste.js delete-key <id>
```

## TTL Options

| Value | Duration |
|-------|----------|
| `1h` | 1 hour |
| `3h` | 3 hours |
| `1d` | 1 day |
| `3d` | 3 days (default) |
| `7d` | 7 days |
| `30d` | 30 days |
| `indefinite` | Never expires |

## API

```bash
# Upload
curl -X POST -H "Authorization: Bearer $PASTE_API_KEY" \
  -H "Content-Type: text/html" \
  -H "X-TTL: 3d" \
  --data-binary @index.html \
  https://htmlhost.fly.dev/api/pastes

# List
curl -H "Authorization: Bearer $PASTE_API_KEY" \
  https://htmlhost.fly.dev/api/pastes

# Delete
curl -X DELETE -H "Authorization: Bearer $PASTE_API_KEY" \
  https://htmlhost.fly.dev/api/pastes/<id>
```

## Auth

Mnemonic-based (crypto-style). CLI generates a 12-word mnemonic phrase.
The mnemonic derives your API key deterministically. Lose the mnemonic = lose access.
No auth providers. No recovery. Save your phrase securely.

## Dashboard

Visit the service URL in a browser. Enter your mnemonic to log in.
View all pastes in a grid with iframe previews. Manage keys.
