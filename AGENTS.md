# Repository Guidelines

## Project Structure & Module Organization
Core code sits under `apps/`: `client` (Vue 3 dashboard), `server` (Bun/TypeScript API + WebSocket), and `matrix-client-react` (React visualizer). Hooks and agent configs live in `.claude/` with Python scripts executed via Astral uv. Shared installer logic is in `packages/setup-installer`, reference docs in `docs/`, and reusable scripts in `scripts/`. Persisted fixtures and regression snapshots stay in `test-results*/`, while end-to-end assets reside in `tests/playwright` and unit suites live beside code in `__tests__/` folders.

## Build, Test, and Development Commands
Install per-app dependencies with `bun install`. Launch the full stack via `./scripts/start-system.sh`; clean state with `./scripts/reset-system.sh`. During focused work, run `bun --watch src/index.ts` inside `apps/server` and `bun run dev` inside `apps/client` or `apps/matrix-client-react`. Validate modules using `bun test` (server), `bun run test` (Vitest dashboard suites), `npx playwright test` (UI regression), and `./scripts/test-system.sh` for an end-to-end smoke run.

## Coding Style & Naming Conventions
TypeScript is the baseline; keep strict types and prefer `const` plus interfaces over loose objects. Indentation is two spaces across Vue, TS, and Python files. Components use PascalCase filenames, composables/utilities stay camelCase, and Tailwind utility classes power most styling—add bespoke CSS under `apps/client/src/styles`. Run `bun run lint` inside the matrix client before pushing, and rely on editor format-on-save (Prettier/ESLint) to keep templates consistent.

## Testing Guidelines
Name specs after the subject under test (`EventTimeline.spec.ts`). Keep client/server unit tests co-located in `__tests__`, and execute coverage with `bun test --coverage` or `vitest --coverage`. Playwright scenarios in `tests/playwright` focus on matrix rendering; ensure they reset data so CI can run in parallel. Always finish with `./scripts/test-system.sh` to confirm hooks, database, and dashboard stay aligned.

## Commit & Pull Request Guidelines
Recent history mixes Conventional Commit releases (`chore(release): 1.0.23`) with imperative statements. Default to `type(scope): summary` so tagging jobs remain predictable, and only add `[skip ci]` when automation would be redundant. PRs should include a concise summary, linked issues, screenshots or GIFs for UI work, and a short checklist of commands executed. Call out schema or hook changes because downstream agents mirror this repo.

## Agent & Hook Notes
Run hook utilities via Astral uv—`uv run .claude/hooks/comms/send_message.py --help` is the quickest source of truth—and avoid committing virtual environments. When updating `.claude/settings.json`, mirror defaults in `.claude/settings.local.json` only when testing local overrides. Document new agents in `.claude/agents/` and expose their events through the Bun server registry so the dashboard reflects their status.
