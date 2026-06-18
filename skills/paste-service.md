---
name: paste-service
description: >
  Upload HTML to paste service, manage pastes via CLI.
  Disposable HTML hosting with random URLs and auto-deletion.
  Triggers: "upload html", "host html", "paste html", "paste service",
  "deploy html", "share html", "host page", "disposable page"
---

# htmlhost — Disposable HTML Hosting

Upload HTML files to get random URLs. Auto-deletes after configurable TTL.

## Agent Auto-Setup (Run This First)

When user asks to upload/host HTML, run these steps IN ORDER:

```bash
# Step 1: Install CLI globally from GitHub
npm install -g https://github.com/sebas-developer/htmlhost

# Step 2: Run setup (creates account + saves credentials)
htmlhost setup

# Step 3: Upload the file
htmlhost upload index.html
# Or with custom TTL:
htmlhost upload index.html --ttl 7d
```

The `setup` command:
- Generates a 12-word mnemonic (crypto-style auth)
- Registers with the server
- Saves API key to `~/.htmlhost/config.json`
- Shows mnemonic ONCE — tell user to save it

## If Already Setup

Check if configured:
```bash
cat ~/.htmlhost/config.json 2>/dev/null && echo "Configured" || echo "Needs setup"
```

If exists, skip straight to upload.

## CLI Commands

```bash
# Upload HTML
htmlhost upload index.html
htmlhost upload index.html --ttl 7d

# List pastes
htmlhost list

# Delete paste
htmlhost delete <id>

# Get paste info
htmlhost info <id>

# Manage keys
htmlhost create-key "label"
htmlhost keys
htmlhost delete-key <id>
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

## API (for direct use)

Base URL: `https://htmlhost.fly.dev`

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
No auth providers. No recovery. Credentials saved to `~/.htmlhost/config.json`.

## Dashboard

Visit `https://htmlhost.fly.dev` in a browser. Enter mnemonic to log in.
View all pastes in a grid with iframe previews. Manage keys.

## Agent Workflow Summary

1. `npm install -g https://github.com/sebas-developer/htmlhost`
2. `htmlhost setup` (first time only)
3. `htmlhost upload <file> [--ttl <duration>]`
4. Report URL to user: `https://htmlhost.fly.dev/p/<id>`
