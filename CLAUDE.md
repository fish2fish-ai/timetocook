# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"时间料理"（Time Cuisine）— a minimalist web-based time-block scheduler. Users define time blocks on a calendar and organize tasks into typed "baskets"; the app auto-assigns pending tasks into matching time blocks.

The repo contains **two parallel front-end implementations sharing one backend**:

- **Legacy** (repo root): a single `index.html` with inline vanilla JS + `styles/main.css`, served directly by `server.js`. This is the original, fully-featured version — kept as the behavioral reference.
- **Vue rewrite** (`vue-app/`): Vue 3 + Vite + Pinia + Vue Router, built to replace the legacy front end 1:1 while reusing the same backend API. See `VUE_REFACTOR_REQUIREMENTS.md` and `VUE_PHASE_CHECKLIST.md` for the migration plan/history — as of the last recorded checklist entry, Phase 8 (visual/interaction parity pass) is complete, but pixel-level timeline layout and drag interactions are noted as possible remaining gaps versus the legacy version.

Both front ends talk to the same Node backend and the same `user_data.json` file, so they can be run interchangeably against live data.

**Current deployment state**: the Vue version is the one served for daily use. `server.js` serves the built `vue-app/dist/` output as its static root (see Commands/Architecture below) rather than the legacy root `index.html`, so normal usage only needs port 3000. The legacy `index.html` + `styles/main.css` + `scripts/*.js` files are kept on disk as the behavioral reference and for rollback, but are no longer reachable through `server.js` — running the legacy UI requires temporarily pointing `STATIC_ROOT` in `server.js` back at the repo root.

## Commands

There is no build tooling at the repo root — it's a plain Node `http` server with no dependencies.

```bash
# Daily use: single port, serves the built Vue app + /api/state
node server.js                      # open http://localhost:3000

# Double-click launcher (Windows): 启动时间料理.bat — runs the above and opens the browser

# Developing the Vue app (hot reload) — separate terminal, port 5173, proxies /api/* to :3000
cd vue-app
npm install                         # first time only
npm run dev                         # http://localhost:5173

# After editing vue-app/src, rebuild so server.js (port 3000) picks up the changes:
cd vue-app
npm run build                       # writes to vue-app/dist/, then restart `node server.js`
```

There are no automated tests or linters configured in this repo.

**Windows gotcha**: this repo's path contains a literal `&` (`internet(web&app)`). On Windows, `npm run dev`/`npm run build` invoke the `.cmd` wrapper for Vite via `cmd.exe`, which treats unquoted `&` as a command separator and truncates the path, failing with `Cannot find module '...\vite\bin\vite.js'`. Workaround: bypass the wrapper and invoke Vite directly with node, e.g. `node node_modules/vite/bin/vite.js` (dev) / `node node_modules/vite/bin/vite.js build` (build) from `vue-app/`.

## Architecture

### Backend (`server.js`)

A single-file, dependency-free Node `http` server. Responsibilities:

- Serves static files from `STATIC_ROOT` (`vue-app/dist/`, the built Vue app) — this is what makes port 3000 the single entry point for daily use. `DATA_FILE` (`user_data.json`) stays at the repo root regardless of `STATIC_ROOT`.
- `GET /api/state` — returns the full app state from `user_data.json`.
- `POST /api/state` — validates/sanitizes the incoming payload and overwrites `user_data.json`. All bucket-key and bucket-name sanitization logic is duplicated inline here (see "Data model" below) — this is the source of truth for what a valid payload looks like server-side.
- No database; `user_data.json` at the repo root is the single persisted state file.

`scripts/*.js` (`date-utils.js`, `state-storage.js`, `task-assignment.js`) hold the legacy front end's logic as global-scope functions/vars (not modules) — loaded via `<script>` tags into `index.html`, operating on global `blocks`/`tasks`/`bucketKeysByType`/`bucketNames`/`isThreeDayMode` variables. `vue-app/src/domain/*.js` are the ES-module, pure-function ports of this same logic (`buckets.js`, `date.js`, `task-assignment.js`, `block-scoring.js`) used by the Pinia stores — when fixing a domain-logic bug, check whether it needs the same fix in both places until the legacy version is retired.

### Data model (persisted in `user_data.json`, contract enforced server-side in `server.js`)

- `blocks`: calendar time blocks. Each has a time range, a `type` (`meat` | `fruit` | `veggie`, defaulting to `meat`), a `taskBucket` (one of `A`-`J`), and `taskIds` (auto-assigned, max 3 visible).
- `tasks`: todo items, each with a `type`, `bucket`, `completed`, and `blockIds` (which blocks it's assigned to).
- `bucketKeysByType`: per-type list of bucket labels (`A`-`J`, min 2 incl. `A`/`B`, max 10) — lets each of the three task types have its own set of buckets.
- `bucketNames`: display names for each `{type}-{bucket}` combination (e.g. `meat-A`), sanitized/truncated server-side.
- `uiPrefs.isThreeDayMode`: calendar view toggle (3-day vs. week view).

**The `meat`/`fruit`/`veggie` typing is a metaphor for time-block flexibility**, not task priority: `getBlockTypeByScore(durationHours, flexibility)` in `date-utils.js` / `block-scoring.js` derives it from `duration × flexibility` — long+flexible blocks are "meat" (score ≥ 2.0), down through "fruit", "veggie", and a zero-score "fish" block (a block type that exists in scoring but is not one of the three task-organizing `BASKET_TYPES`). `flexibility` itself comes from two yes/no inputs (can take notes? can isolate/focus?) via `getFlexibilityByAnswers`.

**Auto-assignment** (`autoAssignTasks` in `task-assignment.js`): groups pending (incomplete) tasks by `type|bucket`, takes the top 3 per group (array order = priority), and assigns them to all blocks sharing that same `type`+`taskBucket`. This runs as a full recompute, not an incremental diff.

### Legacy front end (root `index.html`)

Single file with all markup, inline `<script>` logic, and global mutable state (`blocks`, `tasks`, `bucketKeysByType`, `bucketNames`, `isThreeDayMode`). Persistence goes through `saveState`/`loadState` in `scripts/state-storage.js`, which write to both `localStorage` (key `time_manager_demo_state_v1`, used as an offline fallback) and `POST /api/state`, and prefer the server response on load.

### Vue front end (`vue-app/`)

- `domain/` — pure-function ports of the legacy logic (buckets, dates, scoring, task assignment). No DOM/store dependencies; safe to unit test in isolation if tests are ever added.
- `stores/` (Pinia) — `schedule`, `tasks`, `buckets`, `ui`, one store per concern, replacing the legacy globals.
- `services/state-api.js` — thin `fetch` wrapper around `/api/state` (GET/POST only, no client-side sanitization — mirrors what the legacy inline fetch calls did).
- `composables/usePlannerSync.js` — wires stores to `services/state-api.js` for load/save.
- `components/calendar/`, `components/tasks/`, `components/modals/` — the calendar grid, task-basket panel, and modal dialogs (block edit, task edit, bucket rename, delete-basket confirm), split out of what was one monolithic template in the legacy version.
- `styles/vue-alignment.css` layered on top of the shared `styles/main.css` (imported from the repo root) — the Vue app deliberately reuses the legacy stylesheet rather than maintaining a parallel design system, per the Phase 8 alignment work in `VUE_PHASE_CHECKLIST.md`.
- Only one route (`/`, `SchedulerView`) is currently registered in `router/index.js` — routing exists for future expansion (e.g. login), not current multi-page use.

When changing shared behavior (scoring rules, bucket validation, auto-assignment), check both the legacy `scripts/*.js` and the Vue `domain/*.js`/`stores/*.js` equivalents — they are independent ports, not a shared module, and reconciling behavior between the two is an explicit named phase in the migration docs.
