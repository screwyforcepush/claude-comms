# Repository Guidelines

## Project Structure & Module Organization
- `apps/server` hosts the Bun observability API; routes stay in `src/index.ts`, persistence helpers in `src/db.ts`, and regression suites in `src/__tests__`.
- `apps/client` contains the Vue dashboard; UI modules live in `src/components` and `src/views` with Vitest and Playwright specs under `tests/`.
- `packages/setup-installer` ships the `claude-comms` NPX CLI; logic resides in `src/`, distributable templates in `templates/`, and Jest suites across `test/unit`, `test/integration`, and `test/e2e`.
- `.claude/hooks/*` stores Python-powered agents, while `scripts/` provides operational helpers such as `start-system.sh`, `reset-system.sh`, and telemetry generators.

## Build, Test, and Development Commands
- `./scripts/start-system.sh` boots the Bun API, Vue dashboard, and SQLite broker for an end-to-end stack from the repo root.
- `cd apps/server && bun install && bun run dev` starts the API with hot reload; use `bun run start` for production parity and `bun run typecheck` before merging.
- `cd apps/client && bun install && bun run dev` launches the dashboard; `bun run build` compiles the Vite bundle and `bun run preview` smoke-tests it.
- `cd packages/setup-installer && npm install && npm test` validates the installer; run `npm run lint` or `npm run test:coverage` when altering CLI behavior or templates.

## Coding Style & Naming Conventions
- Use 2-space indentation, `camelCase` utilities, `PascalCase` components and types, and co-locate shared shapes in `apps/*/src/types.ts`.
- Keep persistence isolated to `apps/server/src/db.ts`; expose new queries through typed helpers rather than inline SQL inside request handlers.
- In the dashboard prefer composables in `src/composables`, Tailwind utility classes, and structured logging or toast utilities instead of raw `console.log` calls.

## Testing Guidelines
- Backend suites live in `apps/server/src/__tests__` with `.test.ts` suffixes; run `bun run test` or `bun run test:coverage` whenever mutating server logic.
- Dashboard coverage pairs Vitest (`bun run test`) with Playwright smoke tests in `apps/client/tests/playwright`; refresh artifacts in `tests/visual` when UI states change.
- Installer validation relies on Jest; execute `npm run test:integration` after template edits and `npm run test:e2e` before publishing new packages.

## Commit & Pull Request Guidelines
- History favors short, imperative subjects (`remove matrix mode`) with selective conventional prefixes (`chore(release): 1.0.23`); follow that tone and omit trailing periods.
- Reference issues and describe agent-facing impact in PR descriptions; attach dashboard screenshots or installer logs whenever UX or setup flows shift.
- Before requesting review, ensure `./scripts/test-system.sh` plus relevant package checks pass and call out skipped suites or follow-up tasks in the PR notes.
