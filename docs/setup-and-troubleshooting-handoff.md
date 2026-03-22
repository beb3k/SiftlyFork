# Siftly Setup and Troubleshooting Handoff

## Scope

This document records how the local Siftly workspace was set up, what failures were encountered, how they were diagnosed and fixed, and what future agents should carry forward so they do not repeat the same mistakes.

Current workspace:
- Repo path: `C:\Users\Satrio Faiz\Downloads\github-repos\Siftly`
- OS: Windows
- Shell: PowerShell
- App URL: `http://localhost:3000`

## What Was Set Up

### 1. Local environment file

A local `.env` file was created with:

```env
DATABASE_URL="file:./dev.db"
```

Important:
- The repo docs claim `DATABASE_URL="file:./prisma/dev.db"` is the default in `.env`.
- For Prisma SQLite path resolution, that value is misleading here.
- With `schema.prisma` inside `prisma/`, `file:./dev.db` resolves to `prisma/dev.db`, which matches the runtime DB path used by the app.

### 2. Prisma client generation

`npx prisma generate` was run successfully after allowing Prisma to download its engine binaries outside the sandbox.

### 3. Local database initialization

`npx prisma db push` did not work in this environment even after fixing the datasource path. It continued to fail with a generic schema engine error.

As a workaround, the SQLite schema was created directly in `prisma/dev.db` using `better-sqlite3`, which is also the adapter the app uses at runtime.

Result:
- The local database file exists at `prisma/dev.db`
- Required tables were created:
  - `Bookmark`
  - `BookmarkCategory`
  - `Category`
  - `ImportJob`
  - `MediaItem`
  - `Setting`

### 4. Server startup

The Next dev server was started on `http://localhost:3000`.

On this machine, `next dev` sometimes fails under the sandbox with `spawn EPERM`, so starting or restarting the dev server may require an escalated process launch.

### 5. Desktop launcher

A clickable Windows launcher was created at:

`C:\Users\Satrio Faiz\OneDrive\Desktop\Start Siftly.cmd`

Behavior:
- If port 3000 is already in use, it opens `http://localhost:3000`
- Otherwise it starts the dev server from the repo and opens the browser after a short delay

## Issues Encountered and How They Were Solved

### Issue 1. Prisma engine download blocked by sandbox

Symptom:
- `npx prisma generate`
- `npx prisma db push`

failed because Prisma could not fetch its engine from `https://binaries.prisma.sh/...`.

Diagnosis:
- This was a network restriction, not a schema problem.

Resolution:
- Reran the Prisma commands with escalated permissions so Prisma could download its Windows engine.

Learning:
- If Prisma fails on engine download in this environment, retry outside the sandbox immediately instead of debugging the schema first.

### Issue 2. Wrong SQLite path in `.env`

Symptom:
- The repo guidance pointed to `DATABASE_URL="file:./prisma/dev.db"`
- Prisma still failed and the path was suspicious.

Diagnosis:
- SQLite URLs in Prisma are resolved relative to the schema location.
- Since `prisma/schema.prisma` lives inside `prisma/`, `file:./prisma/dev.db` effectively points one level too deep.

Resolution:
- Changed `.env` to:

```env
DATABASE_URL="file:./dev.db"
```

Learning:
- Do not trust the current README/CLAUDE/AGENTS value for `DATABASE_URL` in this repo.
- Use `file:./dev.db` for local Prisma setup here.

### Issue 3. `prisma db push` still failed with generic schema engine error

Symptom:
- Even after the datasource path fix, `npx prisma db push` still failed with only `Schema engine error:`.

Diagnosis:
- `npx prisma validate` passed.
- The engine binary downloaded successfully.
- File writes to `prisma/dev.db` worked.
- This pointed to a Prisma engine/runtime issue on this machine rather than a schema syntax issue.

Resolution:
- Created the SQLite schema manually using `better-sqlite3` so the app could run.

Learning:
- In this workspace, manual DB bootstrapping is a viable fallback if Prisma engine operations keep failing but the schema is straightforward.
- Do not block the whole setup waiting for `db push` if runtime can proceed with a manually initialized DB.

### Issue 4. Build failure due to Google Fonts fetch

Symptom:
- `npm run build` failed because Next.js tried to fetch the `Inter` font from Google.

Diagnosis:
- This was not an app code failure. It was a network dependency during the build.

Resolution:
- No code change was required for local dev.
- The app can still run in dev mode.

Learning:
- In restricted environments, production build failures may come from font fetches rather than project logic.
- For local development, do not conflate this with app breakage.

### Issue 5. Claude CLI was not detected on Windows

Symptom:
- Settings showed:
  - `No Claude CLI detected`
- even though Claude Code CLI was installed and signed in.

Diagnosis:
- `lib/claude-cli-auth.ts` only supported macOS keychain lookup.
- On Windows it returned `available: false` unconditionally.
- Local inspection showed valid Claude credentials at:
  - `C:\Users\Satrio Faiz\.claude\.credentials.json`

Resolution:
- Updated `lib/claude-cli-auth.ts` to:
  - keep the existing macOS keychain logic
  - add filesystem-based credential lookup from `~/.claude/.credentials.json` for Windows/Linux
- Verified with a direct runtime check that the app then reported CLI availability.

Learning:
- This repo originally assumed macOS-only Claude CLI auth.
- On Windows, the correct auth source is the local `.claude/.credentials.json` file.

### Issue 6. Restarting `next dev` failed with `spawn EPERM`

Symptom:
- Starting the server from inside the sandbox could fail with:
  - `Error: spawn EPERM`

Diagnosis:
- Next/Turbopack needed to spawn child processes and the sandbox interfered.

Resolution:
- Start/restart the server outside the sandbox.
- When port 3000 was occupied by a stale process, stop that process first, then relaunch.

Learning:
- Treat `spawn EPERM` during `next dev` as an environment/process restriction first.
- Restarting via an external Windows process is more reliable than trying to keep everything inside the sandbox.

### Issue 7. Mind map page crashed with a Turbopack runtime error

Symptom:
- Navigating to `/mindmap` caused a runtime error in the browser.
- The real server-side message showed:
  - Turbopack was reading `prisma/dev.db-shm`
  - The file was locked
  - The crash happened while processing the CSS pipeline for `@xyflow/react`

Diagnosis:
- Tailwind v4 source scanning and Turbopack were walking into the Prisma directory.
- The SQLite shared-memory sidecar file was not ignored and was locked by the running DB.

Resolution:
- Added this near the top of `app/globals.css`:

```css
@import "tailwindcss";
@source not "../prisma";
```

- Updated `.gitignore` to also ignore:
  - `prisma/dev.db-shm`
  - `prisma/dev.db-wal`
  - `*.db-shm`
  - `*.db-wal`

- Restarted the dev server so Turbopack rebuilt with the new ignore rules.
- Verified `/mindmap` returned `200` after restart.

Learning:
- In Tailwind v4, source scanning can touch non-code files if they are not excluded.
- For local SQLite apps, sidecar files like `*.db-shm` and `*.db-wal` must be treated as database artifacts, not as source files.
- A restart may be required after changing ignore/source-scan behavior.

## Current Important Local Changes

The following local changes exist from this session work:
- `.env`
- `.gitignore`
- `app/globals.css`
- `lib/claude-cli-auth.ts`

Other pre-existing workspace state that was intentionally left alone:
- `package-lock.json` was already modified before this work completed
- `AGENTS.md` is untracked in the repo root

## Recommended Command Checklist for Future Agents

If a future agent needs to get the project running again, use this order:

1. Verify `.env` contains:

```env
DATABASE_URL="file:./dev.db"
```

2. Run:

```bash
npx prisma generate
```

3. If Prisma engine download fails, rerun outside the sandbox.

4. If `npx prisma db push` still fails with a generic schema engine error:
- Do not spend too long on it.
- Check whether `prisma/dev.db` already exists and whether the required tables are present.
- If necessary, initialize the schema manually as was done in this session.

5. Start the app with the desktop launcher or restart `npm run dev` outside the sandbox.

6. If `/mindmap` fails again, verify:
- `app/globals.css` still contains `@source not "../prisma";`
- `.gitignore` still ignores `*.db-shm` and `*.db-wal`
- the server was restarted after those changes

7. If Claude CLI auth is missing on Windows, inspect:
- `C:\Users\Satrio Faiz\.claude\.credentials.json`
- `lib/claude-cli-auth.ts`

## Mistakes Made in This Session

### Mistake 1. Trusting the repo docs for `DATABASE_URL`

The documented SQLite path was taken at face value initially. That cost time because it is not the right practical value for this workspace.

Correction:
- Always validate SQLite relative path resolution against the location of `schema.prisma`.

### Mistake 2. Spending time on Prisma `db push` before switching to a workaround

The schema itself was valid, and file writes worked, but the engine still failed.

Correction:
- When the toolchain is clearly the blocker and the schema is simple, switch to a runtime-compatible workaround sooner.

### Mistake 3. Underestimating Tailwind/Turbopack file scanning

The mind map error looked like a React Flow issue at first glance, but the actual root cause was a locked SQLite sidecar file being scanned as part of the frontend pipeline.

Correction:
- Read the actual `next dev` server output first.
- For Turbopack runtime wrappers, the browser error is usually not the real cause.

### Mistake 4. Assuming the standard desktop path

The actual desktop for this machine was under OneDrive:
- `C:\Users\Satrio Faiz\OneDrive\Desktop`

Correction:
- On Windows, verify whether Desktop is redirected to OneDrive before writing user-facing shortcuts.

## Carry-Forward Notes for the Next Session

- The server can run successfully on Windows in this workspace.
- Claude CLI detection is now filesystem-aware and should work on Windows, but the Claude session itself may still expire and require the user to run `claude` again.
- The mind map route is sensitive to source-scanning of SQLite artifacts; do not remove the Prisma exclusion casually.
- If the app reports a Turbopack runtime error, inspect the server log immediately before editing application code.
- If a future agent needs to produce a cleaner long-term fix, the best candidates are:
  - fix the repo docs for `DATABASE_URL`
  - determine why `prisma db push` fails generically on this machine
  - consider excluding database artifacts more globally if Tailwind/Turbopack behavior changes again

## Suggested Follow-Up Improvements

These were not completed in this session but are worth considering:
- Update `README.md`, `CLAUDE.md`, and `AGENTS.md` so they no longer recommend the misleading Prisma SQLite URL.
- Add `*.db-shm` and `*.db-wal` to the repo defaults permanently.
- Consider documenting Windows Claude CLI credential lookup in the main docs.
- If desired, replace the desktop `.cmd` launcher with a proper `.lnk` shortcut plus custom icon.
