---
name: paste-service
description: >
  Upload HTML, images, audio, fonts, and any other file to a disposable hosting
  service. HTML pastes get random URLs with auto-deletion; assets (images,
  audio, video, fonts, CSS, JS, PDFs, anything) live under a paste and are
  referenced from it by absolute URL. Triggers: "upload html", "host html",
  "paste html", "paste service", "deploy html", "share html", "host page",
  "disposable page", "upload image", "upload asset", "host image", "host asset",
  "embed image", "image url", "cdn", "static asset"
---

# htmlhost — Disposable HTML + Asset Hosting

Upload HTML to get a random, self-deleting URL. Upload images, audio, fonts,
or any other file as an **asset** under a paste, then reference it by absolute
URL from the paste's HTML. Built for AI agents: one CLI, mnemonic auth, zero
config after first setup.

## Mental Model

Two things, and only two:

- **Paste** — the HTML page itself. Short ID, served at `https://html-host.fly.dev/p/<id>`. This is the URL you share.
- **Asset** — a file (image, audio, font, …) uploaded **under** a paste. Has a path (e.g. `images/photo.png`), served at `https://html-host.fly.dev/a/<paste-id>/<path>`. Referenced from the paste's HTML by **absolute** URL.

An asset **must belong to a paste**. Upload the paste first, then drop assets
under it. The asset is only useful if the paste references it.

## Credential Management

Credentials live in `~/.htmlhost/config.json`. **NEVER read this file directly** — the CLI handles all auth internally. Never pass credentials as arguments.

### First-Time Setup

Check if the CLI is installed and configured (no network call — just reads local config):

```bash
which htmlhost 2>/dev/null && htmlhost show-credentials >/dev/null 2>&1 && echo "READY" || echo "NEEDS_SETUP"
```

If `NEEDS_SETUP`, install + register. **An access key is required** — it's the
`ACCESS_KEY` set on the server, gating account creation (fail-closed if unset).
Pass it once via env, or it can be pre-stored as `accessKey` in the config:

```bash
npm install -g https://github.com/sebas-developer/htmlhost
PASTE_ACCESS_KEY=<key> htmlhost setup
```

After setup, tell the user to back up their 12-word mnemonic (shown on screen).
Lose it = lose access. No recovery.

### If Config Exists

Skip setup. Use CLI commands directly — they read `~/.htmlhost/config.json`
automatically.

## Agent Workflow

When the user asks to upload/host HTML, images, or other files:

1. **Check setup:** `which htmlhost 2>/dev/null && htmlhost show-credentials >/dev/null 2>&1 && echo "READY" || echo "NEEDS_SETUP"`
2. **If needs setup:** install + `PASTE_ACCESS_KEY=<key> htmlhost setup`
3. **Use the standard project layout** under `.htmlhost/<slug>/` (see below) — write `index.html`, drop assets in `assets/`, let the workflow manage `.paste`
4. **Upload the HTML paste first** (assets need a parent paste)
5. **Upload each asset** under the paste ID, `--path` matching its location inside `assets/`
6. **Reference assets in the HTML by absolute URL** (see "The Relative Path Trap" — this is the #1 footgun)
7. **Report the paste URL** to the user (asset URLs are intermediate, not shared)

## Project Layout

All paste projects live under a hidden `.htmlhost/` folder at the project root
(CWD). One folder per paste. It travels with your project — add `.htmlhost/`
to `.gitignore` unless you want to commit the source.

```
.htmlhost/
  <project-slug>/
    index.html         # source HTML (always `index.html`, not <slug>.html)
    assets/            # files to upload as assets; tree mirrors the --path
      <any-subdirs>/
        <file>
    .paste             # single line: the paste ID (e.g. `vcc6Q2Fb`)
```

**`<project-slug>`** — lowercase, hyphenated, descriptive (`portfolio`, `luma-pitch`, `landing-v1`). One slug = one paste. Need a v2? New slug.

**`index.html`** — always named `index.html`. Uniform commands, nothing to remember.

**`assets/`** — directory tree mirrors the `--path` passed to `htmlhost asset`. `assets/images/photo.png` → `--path images/photo.png`. Drop the file in the right subfolder, done.

**`.paste`** — single line, the paste ID. Read it to know which paste to update or delete. URL is deterministic: `https://html-host.fly.dev/p/<id>`.

### Full Lifecycle

```bash
# 1. Create the project
mkdir -p .htmlhost/portfolio/assets

# 2. Write the source + drop assets
$EDITOR .htmlhost/portfolio/index.html
cp ~/Downloads/signature.png .htmlhost/portfolio/assets/signature.png

# 3. Upload the paste (capture the ID)
htmlhost upload .htmlhost/portfolio/index.html --ttl 7d \
  | tee /tmp/htmlhost-upload.log
PASTE_ID=$(awk '/^(Replaced|Uploaded):/ {print $2; exit}' /tmp/htmlhost-upload.log)
printf '%s' "$PASTE_ID" > .htmlhost/portfolio/.paste

# 4. Upload assets (--path mirrors the file's location inside assets/)
PASTE_ID=$(cat .htmlhost/portfolio/.paste)
find .htmlhost/portfolio/assets -type f | while read -r f; do
  rel="${f#.htmlhost/portfolio/assets/}"
  htmlhost asset "$PASTE_ID" "$f" --path "$rel"
done

# 5. Edit + update (later, same URL)
$EDITOR .htmlhost/portfolio/index.html
htmlhost replace "$(cat .htmlhost/portfolio/.paste)" .htmlhost/portfolio/index.html

# 6. Delete
htmlhost delete "$(cat .htmlhost/portfolio/.paste)"
rm -rf .htmlhost/portfolio
```

### `.gitignore`

Source + paste IDs are working state, not source code:
```
.htmlhost/
```
Commit only if you intentionally want to version the HTML source (rare).

### Global Workspace Override

Keep all pastes in one place regardless of project:
```bash
export HTMLHOST_DIR=~/.htmlhost-workspace   # all paths become $HTMLHOST_DIR/<slug>/...
```
Default (no env var) is project-local `.htmlhost/`.

## Hosting HTML

```bash
htmlhost upload index.html --ttl 7d
# → Uploaded: <id>
# → URL: https://html-host.fly.dev/p/<id>
```

Update in place (same URL, new content):
```bash
htmlhost replace <id> index.html
```

**Watermark:** the server injects a small `uploaded to html-host` badge (frosted-glass pill, GitHub link) at the bottom of every served paste. Fixed injection — not in your source, not removable. If the live version is ~1-2KB larger than local, that's the watermark, not a sync issue.

## Hosting Assets (Images, Audio, Fonts, Files)

### Upload

```bash
htmlhost asset <paste-id> <file> --path <relative-path>
```

`--path` is the path string used in the asset URL. Omit it to use the file's basename.

```bash
# root of paste
htmlhost asset aB3xY photo.png --path photo.png
# nested path — subdirectories are fine, they're part of the path string
htmlhost asset aB3xY photo.png --path images/photo.png
htmlhost asset aB3xY hero.jpg --path assets/hero/hero.jpg
# omit --path → basename
htmlhost asset aB3xY photo.png   # stored as "photo.png"
```

The command prints the full URL — use that exact URL in the HTML:
```
Uploaded: https://html-host.fly.dev/a/aB3xY/images/photo.png
Size: 290.4KB
Type: image/png
```

### List, Delete

```bash
htmlhost assets <paste-id>                  # list all assets
htmlhost delete-asset <paste-id> <path>     # delete one (path = what you passed to --path, not the full URL)
```

Example: `htmlhost delete-asset aB3xY images/photo.png`.

### Asset URL Pattern

```
https://html-host.fly.dev/a/<paste-id>/<path>
```

### Supported File Types

Anything. The CLI doesn't filter — it stores and serves whatever you give it.
Common: PNG/JPG/WebP/GIF/SVG, MP3/WAV/OGG, MP4/WebM, WOFF2, CSS, JS, PDF, JSON.

### The Relative Path Trap (CRITICAL)

**Relative paths in the HTML will not work.** Browsers resolve `images/photo.png`
against the paste's URL (`/p/<id>/images/photo.png`) — wrong. Assets live under
`/a/<id>/...`, not `/p/<id>/...`.

Wrong:
```html
<img src="images/photo.png">          <!-- /p/aB3xY/images/photo.png → 404 -->
```

Right:
```html
<img src="https://html-host.fly.dev/a/aB3xY/images/photo.png">
```

Use the full absolute URL the upload command printed. Same rule for CSS
`url(...)`, audio/video `src`, fonts, etc.

### Complete Example: HTML + Image

```bash
# 1. Upload the page
htmlhost upload page.html --ttl 7d          # → Replaced: aB3xY
# 2. Upload the image under it
htmlhost asset aB3xY ./signature.png --path signature.png
# → Uploaded: https://html-host.fly.dev/a/aB3xY/signature.png
# 3. Reference it in page.html by absolute URL, then re-upload
htmlhost replace aB3xY page.html
```

## CLI Commands

```bash
htmlhost setup                    # Create account + save credentials (needs PASTE_ACCESS_KEY)
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost replace <id> <file>      # Replace paste HTML with new file
htmlhost list                     # List pastes (size, status, 🔒 if protected)
htmlhost info <id>                # Paste details (size, password status)
htmlhost expire <id> --ttl <dur>  # Change paste duration
htmlhost password <id> --set      # Set password on a paste
htmlhost password <id> --remove   # Remove password from a paste
htmlhost delete <id>              # Delete paste
htmlhost asset <id> <file> [--path]  # Upload asset (image, audio, …) under a paste
htmlhost assets <id>              # List assets for a paste
htmlhost delete-asset <id> <path> # Delete an asset from a paste
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
htmlhost update                   # Pull latest version and reinstall
```

## TTL Options

| Value | Duration |
|-------|----------|
| `1h` | 1 hour |
| `3h` | 3 hours |
| `1d` | 1 day |
| `3d` | 3 days *(default)* |
| `7d` | 7 days |
| `30d` | 30 days |
| `indefinite` | Never expires |

## API Reference

Base URL: `https://html-host.fly.dev`. All authed endpoints require `Authorization: Bearer <api-key>`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Access key | Register an account (`X-Access-Key` header, bootstrap-only) |
| `POST` | `/api/pastes` | Yes | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | Yes | List your pastes (size, hasPassword) |
| `GET` | `/api/pastes/:id` | Yes | Get paste + HTML + metadata |
| `PATCH` | `/api/pastes/:id` | Yes | Update TTL or HTML (`{ "ttl": "7d" }` or `{ "html": "..." }`) |
| `DELETE` | `/api/pastes/:id` | Yes | Delete paste |
| `POST` | `/api/pastes/:id/password` | Yes | Set password (`{ "password": "..." }`) |
| `DELETE` | `/api/pastes/:id/password` | Yes | Remove password |
| `POST` | `/api/pastes/:id/verify` | No | Verify password (rate-limited) |
| `POST` | `/api/pastes/:id/assets` | Yes | Upload asset (multipart, field: `file`, optional: `path`) |
| `GET` | `/api/pastes/:id/assets` | Yes | List assets for a paste |
| `DELETE` | `/api/pastes/:id/assets/*` | Yes | Delete asset at path (path in URL) |
| `POST` | `/api/keys` | Yes | Create new key |
| `GET` | `/api/keys` | Yes | List keys |
| `DELETE` | `/api/keys/:id` | Yes | Delete key (cascades) |
| `GET` | `/health` | No | Health check |

Password-protected pastes show a password form at `/p/:id`. Cookie-based access after verification (24h). Assets are publicly served at `/a/:id/<path>` (no auth — they're meant to be embedded).

## Auth — Two Layers

**Access key** — shared secret set on the server (`ACCESS_KEY` env). Gates `POST /api/auth/register` via the `X-Access-Key` header. Fail-closed: registration refuses if the server has no `ACCESS_KEY`. Bootstrap-only — not needed after setup. Stored locally as `accessKey` so re-setup after a DB reset is zero-touch.

**Mnemonic** — 12-word BIP39 phrase → API key via PBKDF2 (600k iterations):
```
12-word mnemonic → PBKDF2 (600k) → API key (ps_...)
```
Server stores only `SHA-256(api_key)`. The mnemonic never leaves your machine. Lose it = lose access. Back it up.

## Dashboard

Visit `https://html-host.fly.dev`, log in with your mnemonic. Grid preview of all pastes, key management, API docs.
