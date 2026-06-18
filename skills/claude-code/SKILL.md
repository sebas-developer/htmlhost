---
name: paste-service
description: Upload HTML to paste service, manage pastes via CLI. Disposable HTML hosting with random URLs and auto-deletion.
---

# htmlhost — Disposable HTML Hosting

Upload HTML files to get random URLs. Auto-deletes after configurable TTL.

## Credential Management

All credentials are stored in `~/.htmlhost/config.json`.

### First-Time Setup

```bash
# Check if configured
cat ~/.htmlhost/config.json 2>/dev/null || echo "NEEDS_SETUP"
```

If not configured:
```bash
npm install -g https://github.com/sebas-developer/htmlhost
htmlhost setup
```

After setup, tell the user their mnemonic for backup.

### If Config Exists

Skip setup. CLI reads `~/.htmlhost/config.json` automatically.

## Agent Workflow

1. Check: `cat ~/.htmlhost/config.json 2>/dev/null || echo "NEEDS_SETUP"`
2. If needs setup: `npm install -g https://github.com/sebas-developer/htmlhost && htmlhost setup`
3. Upload: `htmlhost upload <file> --ttl <duration>`
4. Report URL: `https://html-host.fly.dev/p/<id>`

## CLI Commands

```bash
htmlhost setup                    # Create account + save credentials
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML (1h, 3h, 1d, 3d, 7d, 30d, indefinite)
htmlhost list                     # List pastes
htmlhost delete <id>              # Delete paste
htmlhost info <id>                # Paste details
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
```

## API

Base: `https://html-host.fly.dev` | Auth: `Authorization: Bearer <api-key>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pastes` | Upload HTML (header: `X-TTL`) |
| `GET` | `/api/pastes` | List pastes |
| `DELETE` | `/api/pastes/:id` | Delete paste |
| `GET` | `/health` | Health check |

## Dashboard

Visit `https://html-host.fly.dev`, enter mnemonic to log in.
