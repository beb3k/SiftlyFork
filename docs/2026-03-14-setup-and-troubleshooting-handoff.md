# Siftly Update and Troubleshooting Handoff

## Scope

This document is the handoff for future sessions working on the local Siftly workspace on this laptop.

Workspace:
- Repo: `C:\Users\Satrio Faiz\Downloads\github-repos\Siftly`
- OS: Windows
- Shell: PowerShell
- Local app URL: `http://localhost:3000`
- Git remote: `https://github.com/viperrcrypto/Siftly.git`

Use this document when another session needs to understand:
- what was updated
- what local machine-specific fixes were required
- why bookmarks appeared to disappear
- why saving the OpenAI provider failed
- what to verify before making more changes

## Current Repo State

Local branch:
- `main`

Upstream update applied:
- Fast-forwarded from `0436e6d` to `6ab5df5`

Important upstream commits included in this update:
- `b557a7d` `feat: add OpenAI/Codex CLI support, improve import parser and article previews`
- `6ab5df5` `fix: add missing openai dependency to package.json`

This means the local repo now includes:
- OpenAI provider support in Settings
- Codex CLI auth support
- `lib/openai-auth.ts`
- `lib/codex-cli.ts`
- updated settings routes and UI for provider switching

## Key Local Findings

### 1. The bookmarks were not deleted

The user reported that all previous bookmarks were gone after the update.

Actual finding:
- the real data was still present in `prisma/dev.db`
- verified counts:
  - `Bookmark`: `2078`
  - `Category`: `13`
  - `BookmarkCategory`: `3023`
  - `MediaItem`: `1595`
  - `Setting`: `1`

Cause:
- the app runtime opened the wrong SQLite file
- a second empty database file was created at the repo root:
  - `C:\Users\Satrio Faiz\Downloads\github-repos\Siftly\dev.db`

So the UI looked empty because the app was pointed at the wrong DB, not because the real DB was lost.

### 2. The OpenAI provider save failure had the same root cause

The user also reported:
- selecting OpenAI GPT as provider in Settings failed with:
  - `failed to save provider preference`

Cause:
- the running app process was connected to the wrong empty database
- that empty DB did not have `Setting` or `Category` tables
- requests like `/api/settings` failed with Prisma `P2021` errors such as:
  - `The table main.Setting does not exist in the current database`

This was not primarily a settings-route bug.
It was a bad database-path bug at runtime.

## Root Cause: Prisma CLI and Runtime Resolved SQLite Paths Differently

The repo uses:

```env
DATABASE_URL="file:./dev.db"
```

Important behavior on this machine:
- Prisma CLI resolves that correctly against `prisma/schema.prisma`, which lands on:
  - `prisma/dev.db`
- the runtime adapter in `lib/db.ts` had been resolving that same value relative to `process.cwd()`
- that caused the runtime to open:
  - `./dev.db`
- which created an empty database in the repo root

That mismatch caused:
- bookmarks appearing missing
- category fetch failures
- stats fetch failures
- settings fetch failures
- provider preference save failures

## Fixes Applied in This Session

### 1. Updated the repo to upstream OpenAI/Codex changes

Actions completed:
- confirmed `origin` points to `https://github.com/viperrcrypto/Siftly.git`
- fetched upstream
- fast-forwarded `main` to `origin/main`
- preserved local uncommitted work by stashing and reapplying

Conflicts resolved:
- `.gitignore`
- `lib/claude-cli-auth.ts`

Resolution policy:
- keep upstream OpenAI/Codex work
- preserve local Windows-specific Claude credential support and laptop-specific ignore/setup changes

### 2. Installed updated dependencies

Ran:

```bash
npm install
```

Reason:
- upstream added the `openai` dependency

### 3. Regenerated Prisma client

Ran:

```bash
npx prisma generate
```

Note:
- this had to be rerun outside the sandbox because Prisma engine download failed inside the sandbox

### 4. Fixed stale Next type artifacts

Problem:
- `npx tsc --noEmit` initially failed because stale `.next/dev` metadata still referenced deleted route files

Fix:
- regenerated route types
- removed stale `.next/dev` cache

After that:

```bash
npx tsc --noEmit
```

passed successfully.

### 5. Safely aligned the local database schema

The updated code expected the `Bookmark.source` column, but the existing local DB did not have it.

Important:
- `npx prisma db push` wanted `--accept-data-loss` because of populated FTS tables
- that was not safe to run casually on the user's real bookmark DB

Instead:
- backed up the DB
- applied only the safe missing schema change manually

Backup created:
- `C:\Users\Satrio Faiz\Downloads\github-repos\Siftly\prisma\dev.db.backup-20260314-072809`

Manual schema fix applied:
- add `Bookmark.source`
- create index `Bookmark_source_idx`

### 6. Fixed runtime DB path resolution

File changed:
- `lib/db.ts`

What changed:
- runtime SQLite URL handling now normalizes:
  - `file:./dev.db`
  - `file:./prisma/dev.db`
- both are directed to the real local DB file:
  - `prisma/dev.db`

This was done specifically so the runtime matches the local Windows setup guidance already documented in `AGENTS.md`.

## Files Changed or Relevant

Important source files for this session:
- `lib/db.ts`
- `lib/claude-cli-auth.ts`
- `.gitignore`
- `docs/2026-03-14-setup-and-troubleshooting-handoff.md`

Important local data files:
- real database: `prisma/dev.db`
- safety backup: `prisma/dev.db.backup-20260314-072809`
- wrong empty DB created by the old bug: `dev.db`

Important auth files on this machine:
- Codex auth: `C:\Users\Satrio Faiz\.codex\auth.json`
- Claude auth: `C:\Users\Satrio Faiz\.claude\.credentials.json`

## Verification Performed

Verified in this session:
- `origin` matches the expected GitHub repo
- upstream OpenAI/Codex commits were fetched and applied
- `npm install` succeeded
- `npx prisma generate` succeeded
- `npx tsc --noEmit` succeeded
- `prisma/dev.db` contains the expected app tables
- `prisma/dev.db` still contains the bookmark data
- fixed runtime DB path can see:
  - `2078` bookmarks
  - `13` categories
  - `1` setting row
- Codex/OpenAI auth status probe returned:
  - `available: true`
  - `authMode: "chatgpt"`
  - `planType: "go"`

## Why the Running App Still Showed Errors After the Code Fix

Important behavior:
- the user already had `next dev` running
- that server process had already opened the wrong empty root `dev.db`
- Prisma client was cached in-process

So even after fixing `lib/db.ts`, the live server could continue showing:
- missing table errors
- empty bookmarks
- failed provider save

This does not mean the code fix failed.
It means the old process still had the bad DB handle open.

## Required Recovery Steps After This Session

If the app is still showing missing bookmarks or settings errors:

1. Stop the current `next dev` process.
2. Start it again:

```bash
npx next dev
```

3. Reload the app.

Expected result after restart:
- bookmarks reappear
- `/api/stats` works
- `/api/categories` works
- `/api/settings` works
- changing provider to OpenAI saves correctly

4. If the root-level `dev.db` still exists after the server is stopped, delete it.

Safe rule:
- keep `prisma/dev.db`
- remove only the repo-root `dev.db`

## Known Failure Modes and How to Handle Them

### A. Prisma engine download fails

Symptom:
- `npx prisma generate` fails trying to fetch binaries

Action:
- rerun outside the sandbox

### B. `next dev` fails with `spawn EPERM`

Symptom:
- Windows sandbox/process restriction during Next/Turbopack startup

Action:
- restart `next dev` outside the sandbox

### C. `prisma db push` warns about data loss on FTS tables

Symptom:
- Prisma wants to drop `bookmark_fts*` tables and requests `--accept-data-loss`

Action:
- do not run that blindly against the real bookmark DB
- inspect whether the needed schema change is small and targeted first
- back up the DB before manual surgery

### D. Settings or stats say tables do not exist

Likely cause on this machine:
- the app is pointed at the wrong SQLite file

Check:
- whether root `dev.db` exists
- whether the running process predates the `lib/db.ts` fix
- whether `prisma/dev.db` still contains the real data

### E. Bookmarks look gone after future changes

First assumption should be:
- wrong DB path

Do not assume:
- bookmarks were deleted

Verify counts in `prisma/dev.db` first.

## Recommended Diagnostic Commands

Check current git state:

```bash
git status --short --branch
```

Check DB files:

```bash
Get-ChildItem -Recurse -Force -Filter *.db
```

Check app tables in the real DB:

```bash
@'
const Database = require('better-sqlite3')
const db = new Database('prisma/dev.db', { readonly: true })
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
console.log(tables)
'@ | node -
```

Check bookmark/category/setting counts:

```bash
@'
const Database = require('better-sqlite3')
const db = new Database('prisma/dev.db', { readonly: true })
for (const table of ['Bookmark', 'Category', 'Setting']) {
  console.log(table, db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count)
}
'@ | node -
```

Type-check:

```bash
npx tsc --noEmit
```

Regenerate Prisma client:

```bash
npx prisma generate
```

## Carry-Forward Notes for Another Session

- The most important local rule is: `DATABASE_URL="file:./dev.db"` should still end up using `prisma/dev.db` at runtime.
- The real user data is in `prisma/dev.db`.
- If bookmarks disappear, check for a stray repo-root `dev.db` immediately.
- Do not run destructive Prisma schema commands casually against the local bookmark DB.
- A restart of `next dev` is required after the runtime DB-path fix if the old process is still running.
- The repo now includes OpenAI/Codex auth support, and Codex auth is present on this machine.
- Local uncommitted workspace changes existed before and during this work. Do not revert unrelated changes without user approval.

## Suggested Next Actions for a Future Session

If another session picks this up, the highest-value next steps are:
- restart the dev server and confirm the UI now shows the real bookmark library
- verify that switching provider to OpenAI persists in Settings
- consider adding a small automated test for SQLite URL normalization in `lib/db.ts`
- consider documenting the runtime/Prisma path-resolution difference in the main repo docs
