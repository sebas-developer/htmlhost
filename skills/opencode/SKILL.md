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

## Credential Management

All credentials are stored in `~/.htmlhost/config.json`. The agent MUST manage this file.

```json
{
  "mnemonic": "word1 word2 ... word12",
  "apiKey": "ps_...",
  "url": "https://html-host.fly.dev"
}
```

### First-Time Setup

Check if credentials exist:
```bash
cat ~/.htmlhost/config.json 2>/dev/null || echo "NEEDS_SETUP"
```

If file doesn't exist, run setup:
```bash
npm install -g https://github.com/sebas-developer/htmlhost
htmlhost setup
```

After setup, read the config file to get credentials:
```bash
cat ~/.htmlhost/config.json
```

**IMPORTANT:** After setup, tell the user their mnemonic for safekeeping. The agent has it in the config but the user should back it up separately.

### Retrieving Credentials

```bash
htmlhost show-credentials
# Or read directly:
cat ~/.htmlhost/config.json | jq -r .mnemonic
cat ~/.htmlhost/config.json | jq -r .apiKey
```

### If Config Exists

Skip setup. Just use the CLI — it reads `~/.htmlhost/config.json` automatically.

## Agent Workflow

When user asks to upload/host HTML:

1. **Check setup:** `cat ~/.htmlhost/config.json 2>/dev/null || echo "NEEDS_SETUP"`
2. **If needs setup:** run `npm install -g https://github.com/sebas-developer/htmlhost && htmlhost setup`
3. **Upload:** `htmlhost upload <file> --ttl <duration>`
4. **Report URL:** `https://html-host.fly.dev/p/<id>`

The agent should store the config path and read it when needed. No env vars required after setup.

## CLI Commands

```bash
htmlhost setup                    # Create account + save all credentials
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost list                     # List pastes
htmlhost delete <id>              # Delete paste
htmlhost info <id>                # Paste details
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
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

## API Reference

Base URL: `https://html-host.fly.dev`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pastes` | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | List your pastes |
| `GET` | `/api/pastes/:id` | Get paste + HTML |
| `DELETE` | `/api/pastes/:id` | Delete paste |
| `POST` | `/api/keys` | Create new key |
| `GET` | `/api/keys` | List keys |
| `DELETE` | `/api/keys/:id` | Delete key (cascades) |
| `GET` | `/health` | Health check |

All endpoints require `Authorization: Bearer <api-key>`.

## Auth

Mnemonic-based (crypto-style). 12-word BIP39 phrase derives API key via PBKDF2.
Server stores only SHA-256 hash. Lose mnemonic = lose access. No recovery.

## Dashboard

Visit `https://html-host.fly.dev`, enter mnemonic to log in.
Grid preview of all pastes, key management, API docs.
