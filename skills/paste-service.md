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

Three things, and only three:

- **Paste** — the HTML page itself. Short ID, served at `https://<your-app>.fly.dev/p/<id>`. This is the URL you share.
- **Asset** — a file (image, audio, font, …) uploaded **under** a paste. Has a path (e.g. `images/photo.png`), served at `https://<your-app>.fly.dev/a/<paste-id>/<path>`. Referenced from the paste's HTML by **absolute** URL.
- **Account** — a group of keys sharing the same pastes. The initial `setup()` creates an account; `create-key` inherits the caller's account. All admin-scope keys in an account see all its pastes.

`<your-app>.fly.dev` is the user's own self-hosted instance (see [Service Setup](#service-setup)). The CLI stores it in `~/.htmlhost/config.json` as `url` after first setup.

An asset **must belong to a paste**. Upload the paste first, then drop assets
under it. The asset is only useful if the paste references it.

## Service Setup

Three things need to be in place before any upload works:

1. **htmlhost CLI** installed globally
2. **htmlhost server** reachable at a known URL
3. **Credentials** in `~/.htmlhost/config.json` (mnemonic + API key)

Walk the user through this tree on the first request. Each step has a fast
no-network local check.

### Step 1 — Is the CLI installed?

```bash
command -v htmlhost >/dev/null 2>&1 && echo "CLI: OK" || echo "CLI: MISSING"
```

If missing, install globally:

```bash
npm install -g https://github.com/sebas-developer/htmlhost
```

### Step 2 — Is the server reachable?

Read the configured URL (if any) and probe `/health`:

```bash
URL=$(node -e "try{console.log(require('fs').existsSync(require('path').join(require('os').homedir(),'.htmlhost','config.json'))?JSON.parse(require('fs').readFileSync(require('path').join(require('os').homedir(),'.htmlhost','config.json'),'utf8')).url||'':'')}catch{}")
if [ -n "$URL" ] && curl -fsS --max-time 3 "$URL/health" >/dev/null 2>&1; then
  echo "SERVER: OK ($URL)"
else
  echo "SERVER: NEEDS_BOOTSTRAP"
fi
```

If the server isn't reachable, **ask the user**:
> Do you have an htmlhost instance URL? (e.g. `https://htmlhost-jane.fly.dev`)
>   • **Yes** — paste the URL; it'll be saved to config and used going forward.
>   • **No**  — let's deploy one on Fly.io together (~5 min, free tier).

If "no", run the **Fly.io bootstrap** below.

#### Fly.io bootstrap (one-time, ~5 min)

This deploys htmlhost to the user's own fly.io app. Each user gets their own
private instance.

**a. Install the fly CLI if missing:**

```bash
command -v fly >/dev/null 2>&1 || {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install flyctl
  else
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
  fi
}
```

**b. Authenticate with fly.io:**

```bash
fly auth whoami >/dev/null 2>&1 || fly auth signup
# (use `fly auth login` if the user already has an account)
```

**c. Clone + launch the app:**

```bash
git clone https://github.com/sebas-developer/htmlhost /tmp/htmlhost
cd /tmp/htmlhost
fly launch --copy-config --no-deploy
# Pick a unique app name when prompted (e.g. `htmlhost-jane`).
# That's the URL: https://htmlhost-jane.fly.dev
```

`--copy-config` reuses the bundled `fly.toml`. `--no-deploy` skips the
auto-deploy so we can set the access key first.

**d. Persistent volume for the SQLite DB:**

```bash
fly volumes create data --size 1 --region <closest-region>
# Common regions: iad (Virginia), sjc (San Jose), fra (Frankfurt),
#                 sin (Singapore), syd (Sydney), nrt (Tokyo)
# Use the same region picked during `fly launch`.
```

**e. Set the registration access key** (a shared secret that gates account creation):

```bash
ACCESS_KEY=$(openssl rand -hex 32)
fly secrets set ACCESS_KEY="$ACCESS_KEY"
# Tell the user to save $ACCESS_KEY — they'll need it on every machine that registers.
```

**f. Deploy:**

```bash
fly deploy
# Verify it came up:
curl -fsS --max-time 10 https://<their-app>.fly.dev/health
# → {"ok":true}
```

### Step 3 — Are credentials saved?

```bash
htmlhost show-credentials >/dev/null 2>&1 && echo "CREDS: OK" || echo "CREDS: NEEDS_SETUP"
```

If `NEEDS_SETUP`, register an account. The CLI needs both the server URL
(`PASTE_URL`) and the registration access key (`PASTE_ACCESS_KEY`) on first
run; both are saved to config so future commands work with no env vars:

```bash
PASTE_URL=https://<their-app>.fly.dev \
PASTE_ACCESS_KEY="$ACCESS_KEY" \
  htmlhost setup
```

Setup generates a 12-word mnemonic + API key and saves them to
`~/.htmlhost/config.json` (mode `0600`). **Tell the user to back up the
mnemonic** — it's the only way to recover the account. Lose it = lose access.

## Key Scopes & Permissions

Every key has a **scope** that controls what it can see and do:

| Scope | List | Edit | Delete | Create Keys | Visibility Toggle |
|-------|------|------|--------|-------------|-------------------|
| `admin` | All public + own account | Own account + any public | Own account + any public | Yes | Own account pastes |
| `user` | Own pastes only | Own pastes only | Own pastes only | No | Own pastes only |
| `team` | All public + own account | Own account only | Own account only | No | Own account pastes |

- `setup()` creates an **admin** key (first key, full access).
- `create-key` defaults to **user** scope. Pass `--scope team` for team members.
- Only **admin** keys can create or delete other keys.

```bash
htmlhost create-key temp-dev --scope user     # sees only own pastes
htmlhost create-key collaborator --scope team  # sees public pastes only
htmlhost create-key backup-admin --scope admin # full access
```

## Public vs Private Pastes

Pastes are **private by default** — only keys in the same account can see them (via API).

Make a paste **public** to let any authenticated key (including team-scope) fetch and edit it:

```bash
htmlhost public <id>     # visible + editable by all keys
htmlhost private <id>    # back to account-only (default)
```

The rendered page at `/p/<id>` is always accessible via URL (like a secret link). "Public" means it appears in all scope lists and admin/team keys can see it via API. Admin can edit or delete any public paste (even from other accounts); team can only edit/delete pastes within their own account. Only the owner or account admin can change visibility.

## Credential Management

Credentials live in `~/.htmlhost/config.json`. **NEVER read this file directly** — the CLI handles all auth internally. Never pass credentials as arguments.

### Reading local config (no network)

Use `htmlhost show-credentials` to read saved credentials (CLI may prompt for
the local config password if the user set one). Use `htmlhost list` /
`htmlhost info <id>` for paste state. Do not `cat` or `jq` the config file.

### Re-setup on a new machine

If `~/.htmlhost/config.json` is missing or the server's DB was reset:

```bash
PASTE_URL=https://<their-app>.fly.dev \
PASTE_ACCESS_KEY=<the-shared-secret-from-step-2e> \
  htmlhost setup
```

To avoid passing `PASTE_ACCESS_KEY` every time, save it once in the config
as `accessKey`:

```bash
node -e "
const f=require('path').join(require('os').homedir(),'.htmlhost','config.json');
const c=JSON.parse(require('fs').readFileSync(f,'utf8'));
c.accessKey='<the-key>';
require('fs').writeFileSync(f, JSON.stringify(c,null,2), {mode:0o600});
"
```

## Agent Workflow

When the user asks to upload/host HTML, images, or other files:

1. **Run the Service Setup tree** above. If anything fails, fix it before continuing.
2. **Check for existing paste** — if the user references a paste ID, use `htmlhost pull <id>` to download it into `.htmlhost/<slug>/` for editing
3. **Use the standard project layout** under `.htmlhost/<slug>/` (see below) — write `index.html`, drop assets in `assets/`, let the workflow manage `.paste`
4. **Upload the HTML paste first** (assets need a parent paste)
5. **Upload each asset** under the paste ID, `--path` matching its location inside `assets/`
6. **Reference assets in the HTML by absolute URL** (see "The Relative Path Trap" — this is the #1 footgun)
7. **Report the paste URL** to the user (asset URLs are intermediate, not shared)
8. **If sharing with collaborators** — use `htmlhost public <id>` to make it visible to team-scope keys

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

**`.paste`** — single line, the paste ID. Read it to know which paste to update or delete. URL is deterministic: `https://<your-app>.fly.dev/p/<id>`.

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
# → URL: https://<your-app>.fly.dev/p/<id>
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
Uploaded: https://<your-app>.fly.dev/a/aB3xY/images/photo.png
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
https://<your-app>.fly.dev/a/<paste-id>/<path>
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
<img src="https://<your-app>.fly.dev/a/aB3xY/images/photo.png">
```

Use the full absolute URL the upload command printed. Same rule for CSS
`url(...)`, audio/video `src`, fonts, etc.

### Complete Example: HTML + Image

```bash
# 1. Upload the page
htmlhost upload page.html --ttl 7d          # → Replaced: aB3xY
# 2. Upload the image under it
htmlhost asset aB3xY ./signature.png --path signature.png
# → Uploaded: https://<your-app>.fly.dev/a/aB3xY/signature.png
# 3. Reference it in page.html by absolute URL, then re-upload
htmlhost replace aB3xY page.html
```

### Pulling Source Code

Download a paste's HTML + assets back into the standard `.htmlhost/<slug>/` layout for local editing:

```bash
htmlhost pull aB3xY --slug portfolio
# → Created .htmlhost/portfolio/
# → Downloaded index.html (12.4KB)
# → Downloaded 3 asset(s)
# → Paste ID saved to .htmlhost/portfolio/.paste
```

Then edit locally and re-upload:

```bash
$EDITOR .htmlhost/portfolio/index.html
htmlhost replace aB3xY .htmlhost/portfolio/index.html
```

The slug defaults to the paste ID if `--slug` is omitted. Assets are downloaded from the public `/a/<id>/<path>` route and placed in `assets/` mirroring their `--path` structure.

## CLI Commands

```bash
htmlhost setup                    # Create account + save credentials (needs PASTE_ACCESS_KEY)
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost replace <id> <file>      # Replace paste HTML with new file
htmlhost pull <id> [--slug <name>] # Download paste HTML + assets into .htmlhost/<slug>/
htmlhost list                     # List pastes (admin/team=all public + own account, user=own)
htmlhost info <id>                # Paste details (size, password, public status)
htmlhost expire <id> --ttl <dur>  # Change paste duration
htmlhost public <id>              # Make paste public (visible to all keys)
htmlhost private <id>             # Make paste private (account-only, default)
htmlhost password <id> --set      # Set password on a paste
htmlhost password <id> --remove   # Remove password from a paste
htmlhost delete <id>              # Delete paste
htmlhost asset <id> <file> [--path]  # Upload asset (image, audio, …) under a paste
htmlhost assets <id>              # List assets for a paste
htmlhost delete-asset <id> <path> # Delete an asset from a paste
htmlhost keys                     # List API keys in your account (shows scope)
htmlhost create-key [label] [--scope admin|user|team]  # New key (inherits your account)
htmlhost delete-key <id>          # Delete key + its pastes
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

Base URL: `https://<your-app>.fly.dev` (your self-hosted instance). All authed endpoints require `Authorization: Bearer <api-key>`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Access key | Register an account (`X-Access-Key` header, bootstrap-only) |
| `POST` | `/api/pastes` | Yes | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | Yes | List your pastes (size, hasPassword) |
| `GET` | `/api/pastes/:id` | Yes | Get paste + HTML + metadata |
| `PATCH` | `/api/pastes/:id` | Yes | Update TTL, HTML, or visibility (`{ "ttl": "7d" }`, `{ "html": "..." }`, or `{ "isPublic": true }`) |
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

Password-protected pastes show a password form at `/p/:id`. Cookie-based access after verification (24h). Assets are publicly served at `/a/:id/<path>` (no auth — they're meant to be embedded). The paste list response includes `isPublic: boolean` for each paste. The keys response includes `scope: "admin" | "user" | "team"`.

## Auth — Two Layers

**Access key** — shared secret set on the server (`ACCESS_KEY` env). Gates `POST /api/auth/register` via the `X-Access-Key` header. Fail-closed: registration refuses if the server has no `ACCESS_KEY`. Bootstrap-only — not needed after setup. Stored locally as `accessKey` so re-setup after a DB reset is zero-touch.

**Mnemonic** — 12-word BIP39 phrase → API key via PBKDF2 (600k iterations):
```
12-word mnemonic → PBKDF2 (600k) → API key (ps_...)
```
Server stores only `SHA-256(api_key)`. The mnemonic never leaves your machine. Lose it = lose access. Back it up.

## Dashboard

Visit `https://<your-app>.fly.dev`, log in with your mnemonic. Grid preview of all pastes, key management, API docs.
