# Siftly - Codex Guide

Self-hosted Twitter/X bookmark manager with AI-powered categorization, search, and visualization.

## Quick Setup

```bash
# Install dependencies
npm install

# Generate Prisma client + create local SQLite database
npx prisma generate
npx prisma db push

# Start the dev server
npx next dev
```

App runs at **http://localhost:3000**

For a single command that does all of the above and opens the browser automatically:
```bash
./start.sh
```

## Windows Notes

- Use `DATABASE_URL="file:./dev.db"` in `.env` for local setup on this machine. With `prisma/schema.prisma` inside `prisma/`, this resolves to `prisma/dev.db`.
- The documented `file:./prisma/dev.db` value is misleading here and can break Prisma path resolution.
- If `npx prisma generate` fails trying to download engines, rerun it outside the sandbox.
- If `npx prisma db push` still fails with a generic schema engine error, do not assume the schema is invalid. Validate the schema, check whether `prisma/dev.db` exists, and be prepared to use a manual SQLite bootstrap as a fallback.
- `next dev` may fail under the sandbox with `spawn EPERM`; restarting outside the sandbox is the practical fix.
- The desktop launcher created during setup is `C:\Users\Satrio Faiz\OneDrive\Desktop\Start Siftly.cmd`.

## AI Authentication - No API Key Needed

If the user is signed into Codex CLI, **Siftly uses their Codex subscription automatically**. No API key configuration required.

How it works:
- `lib/Codex-cli-auth.ts` reads the OAuth token from the macOS keychain (`Codex-credentials`)
- Uses `authToken` + `anthropic-beta: oauth-2025-04-20` header in the Anthropic SDK
- Falls back to: DB-saved API key -> `ANTHROPIC_API_KEY` env var -> local proxy

To verify it's working, hit: `GET /api/settings/cli-status`

## Key Commands

```bash
npx next dev          # Start dev server (port 3000)
npx tsc --noEmit      # Type check
npx prisma studio     # Database GUI
npx prisma db push    # Apply schema changes to DB
npm run build         # Production build
```

## Project Structure

```
app/
  api/
    categorize/       # 4-stage AI pipeline (start/stop/status via SSE)
    import/           # Bookmark JSON import + dedup
    search/ai/        # FTS5 + Codex semantic search
    settings/
      cli-status/     # GET - returns Codex CLI auth status
      test/           # POST - validates API key or CLI auth
    analyze/images/   # Vision analysis progress + trigger
    bookmarks/        # CRUD + filtering
    categories/       # Category management
    mindmap/          # Graph data
    stats/            # Dashboard counts
  import/             # 3-step import UI
  mindmap/            # Interactive force graph
  settings/           # API keys, model selection
  ai-search/          # Natural language search UI
  bookmarks/          # Browse + filter UI
  categorize/         # Pipeline monitor

lib/
  Codex-cli-auth.ts  # Codex CLI OAuth session (macOS keychain)
  categorizer.ts      # AI categorization + default categories
  vision-analyzer.ts  # Image vision + semantic tagging
  fts.ts              # SQLite FTS5 full-text search
  rawjson-extractor.ts # Entity extraction from tweet JSON
  parser.ts           # Multi-format bookmark JSON parser
  exporter.ts         # CSV / JSON / ZIP export

prisma/schema.prisma  # SQLite schema (Bookmark, Category, MediaItem, Setting, ImportJob)
```

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma 7** + **SQLite** (local, zero setup, FTS5 built in)
- **Anthropic SDK** - vision, tagging, categorization, search
- **@xyflow/react** - mindmap graph
- **Tailwind CSS v4**

## Environment Variables

Only `DATABASE_URL` is required. Everything else is optional:

```env
DATABASE_URL="file:./dev.db"              # local Windows setup; resolves to prisma/dev.db
ANTHROPIC_API_KEY=sk-ant-...              # optional if Codex CLI is signed in
ANTHROPIC_BASE_URL=http://localhost:8080  # optional - for local proxies
```

## Known Issues

### Claude CLI on Windows

- This repo originally only supported macOS keychain lookup for Claude CLI auth.
- On Windows, Claude credentials live at `C:\Users\Satrio Faiz\.claude\.credentials.json`.
- If CLI auth is not detected, inspect `lib/claude-cli-auth.ts` and verify the session itself is not expired.

### Mind map / Turbopack

- If `/mindmap` throws a Turbopack runtime error, check the `next dev` server output first.
- A known failure mode is Turbopack/Tailwind reading `prisma/dev.db-shm` or `prisma/dev.db-wal` while SQLite has them locked.
- Keep this line in `app/globals.css`:

```css
@source not "../prisma";
```

- Keep SQLite sidecar files ignored in `.gitignore`:
  - `prisma/dev.db-shm`
  - `prisma/dev.db-wal`
  - `*.db-shm`
  - `*.db-wal`
- Restart the dev server after changing Tailwind source-scan behavior.

## Agent Lessons

- Read the actual `next dev` output before changing app code when the browser only shows a Turbopack wrapper error.
- Validate SQLite path resolution relative to `prisma/schema.prisma`; do not trust copied `.env` examples blindly.
- If Prisma tooling is the blocker but the runtime path is clear, switch to a practical fallback sooner instead of spending too long on generic engine errors.
- On this machine, Desktop paths may be redirected to OneDrive, so verify the real desktop location before creating user-facing launchers.

## Handoff Docs

- Store session handoff files in `docs/`.
- Use the filename pattern `YYYY-MM-DD-<short-topic>-handoff.md`.
- When creating a new handoff, prefer a new dated file instead of overwriting an older one.
- When referring another session to the latest handoff, sort by filename/date and use the newest matching file.

## Common Tasks

### Run the AI pipeline manually
POST to `/api/categorize` with `{}` body. Monitor progress via GET `/api/categorize` (returns SSE stream).

### Add a new bookmark category
Edit `DEFAULT_CATEGORIES` array in `lib/categorizer.ts`. Add name, slug, hex color, and description. The description text is passed verbatim to Codex - be specific.

### Add a known tool for entity extraction
Append a domain string to `KNOWN_TOOL_DOMAINS` in `lib/rawjson-extractor.ts`.

### Test API auth
```bash
curl -X POST http://localhost:3000/api/settings/test \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic"}'
# Returns: {"working": true}
```

### Check Codex CLI auth status
```bash
curl http://localhost:3000/api/settings/cli-status
# Returns: {"available": true, "subscriptionType": "max", "expired": false}
```

## Database

SQLite file at `prisma/dev.db`. Schema models:

- `Bookmark` - tweet text, author, raw JSON, semantic tags, enrichment metadata
- `MediaItem` - images/videos/GIFs with AI visual tags
- `BookmarkCategory` - bookmark<->category with confidence score (0-1)
- `Category` - name, slug, color, AI description
- `Setting` - key/value store (API keys, model choice)
- `ImportJob` - import file tracking

After schema changes: `npx prisma db push`
