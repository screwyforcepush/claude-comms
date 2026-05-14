# CC2 Retirement — As-Shipped Record

**Commit:** `549077db` (on `main`, not yet pushed)
**Date:** 2026-05-14
**Author:** Alex Savage + Claude Opus 4.6
**Companion to:** `docs/project/spec/cc2-retirement-survey.md` (the decision receipt — untouched)

---

## What shipped

261 files changed: 250 deleted, 11 modified. Net delta: −78,080 / +133 lines.

The commit removes the entire CC2 surface (SQLite-backed Bun event hub, Vue 3 observability dashboard, Python hook scripts, and all supporting infrastructure) and repositions the project as a single-system Convex workflow engine. The `claude-comms` npm package is primed for a v2.0.0 publish via GitHub Actions `workflow_dispatch`.

---

## Acceptance Criteria Cross-Reference

### AC.A — Pre-clean `packages/setup-installer/`

| Item | Status | Evidence |
|---|---|---|
| Delete `.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md`, `CLI-README.md` | DONE | `D packages/setup-installer/.claude/settings.json`, `D packages/setup-installer/AGENTS.md`, `D packages/setup-installer/CLAUDE.md`, `D packages/setup-installer/CLI-README.md` (plus all files under `.claude/hooks/`) |
| `.gitignore` entries for `.claude/`, `.agents/`, `CLAUDE.md` | DONE | Lines 70–72 of `packages/setup-installer/.gitignore` |
| `package.json` description refresh | DONE | `"NPX installer for Claude Code workflow engine client setup"` |
| `package.json` keywords | DONE | `["claude-code","npx","installer","workflow-engine","convex"]` — dropped `observability`, `hooks`, `multi-agent` |
| `package.json` author | DONE | `"Alex Savage (https://github.com/screwyforcepush)"` |
| `package.json` version left at 1.0.46 | DONE | Workflow's `npm version major` bumps to 2.0.0 at publish time |
| `package.json` files array trimmed | DONE | `["bin/","src/","templates/","README.md","CHANGELOG.md"]` |
| CHANGELOG `[2.0.0]` entry | DONE | Prepended at line 8; frames the breaking change — CC2 hooks/server/dashboard no longer installed |

### AC.B — `.agents/` tweaks

| Item | Status | Evidence |
|---|---|---|
| Delete `consultant_template.txt` | DONE | `D .agents/tools/agent-job/consultant_template.txt` |
| Do NOT touch `.agents/tools/workflow/templates/document.md` | DONE | File not in commit diff |

### AC.C — Slash command refreshes

| Item | Status | Evidence |
|---|---|---|
| `cc3-server.md`: CC2 Step 1 deleted, renumbered, architecture diagram replaced | DONE | `M .claude/commands/cc3-server.md` — single-system diagram, "Install the agent tooling:" (CC2 "hooks and" wording removed) |
| `cc3-client.md`: CC2 references removed, steps renumbered 1/2/3/4 | DONE | `M .claude/commands/cc3-client.md` — Step 5 renumbered to Step 4 |
| `cc3-client-update.md`: Step 3 (settings.json restore) dropped, renumbered | DONE | `M .claude/commands/cc3-client-update.md` |
| File names kept as `cc3-*` | DONE | Per user directive |

### AC.D — README.md full refresh

| Item | Status | Evidence |
|---|---|---|
| Single-system architecture diagram | DONE | CC2/CC3 framing removed |
| CC2 Endpoints, Hook Commands, Quick Commands CC2 rows, Testing CC2 lines, Server Ports CC2 entries, broken links, 5 CC2 doc links, Bun prerequisite — all removed | DONE | `M README.md` |
| Link at line 150 points to `docs/project/spec/workflow-engine-spec.md` | DONE | Fixed in polish pass |

### AC.E — Incidental refreshes

| Item | Status | Evidence |
|---|---|---|
| `LICENSE` line 3: "Claude Comms" | DONE | `Copyright (c) 2025-2026 Claude Comms` |
| `.gitignore`: Server database files block deleted | DONE | `M .gitignore` |
| `browsertools-guide.md` lines 657–659: CC2 Related Docs bullets deleted | DONE | `M docs/project/guides/browsertools-guide.md` |
| `prompt-architecture.md` lines 10–11: pointers swapped to `system-diagram.md` + `workflow-engine-spec.md` | DONE | `M docs/project/guides/prompt-architecture.md` |

### AC.F — CC2 surface deletion

| Directory/File | Status |
|---|---|
| `.claude/hooks/` (9 Python scripts + `__pycache__`) | DONE — 9 `D` entries; disk `__pycache__/*.pyc` is gitignored |
| `.claude/settings.json` | DONE — `D .claude/settings.json` |
| `.claude/.gitignore` | DONE — `D .claude/.gitignore` |
| `apps/server/` (entire) | DONE — all files `D` |
| `apps/client/` (entire, including FeedbackWidget.vue) | DONE — all files `D` |
| `scripts/` (entire) | DONE — all files `D` |
| 6 CC2 guides: `architecture-guide.md`, `api-reference.md`, `development-guide.md`, `integration-guide.md`, `design-system-guide.md`, `ARCHIVE-README.md` | DONE — 6 `D` entries under `docs/project/guides/` |
| 2 sessions-tab specs: `sessions-tab-requirements.md`, `sessions-tab-traceability-matrix.md` | DONE — 2 `D` entries under `docs/project/spec/` |

### AC.G — Survey doc preserved

`docs/project/spec/cc2-retirement-survey.md` is not in the commit diff. Preserved as historical receipt.

### AC.H — CI/CD publish workflow OIDC fix

| Item | Status | Evidence |
|---|---|---|
| `id-token: write` permission | DONE | Already present at line 36 |
| `NODE_AUTH_TOKEN` env var removed from Publish step | DONE | Publish step (line 174) is bare `npm publish --access public` with no `env:` block |
| `contents: read` permission | NOTE | Workflow has `contents: write` (needed for git tag push step at line 201–204). Not changed — correct for this workflow. |

### AC.I — Pre-commit verification

| Check | Result |
|---|---|
| Root `pnpm ts:check` / `pnpm build` | N/A — root package.json has no scripts (CC2 apps that owned those scripts are now deleted). Degenerately green. |
| `packages/setup-installer` `npm run build` | PASS |
| Grep for CC2 markers | Historical-only hits in `docs/project/archive/`, `docs/project/phases/`, `docs/project/research/`, `_research/`, and the surviving survey doc. No in-scope leaks. |

### AC.J — Commit and stop

| Item | Status |
|---|---|
| Single atomic commit | DONE — `549077db`, 261 files |
| `[skip ci]` in body | DONE |
| NOT pushed | DONE — local `main` only |

---

## Post-Commit Operator Runbook

### 1. Push from local

```bash
git push origin main
```

The `[skip ci]` in the commit body prevents the publish workflow from auto-triggering on push.

### 2. Trigger v2.0.0 publish

Go to **GitHub Actions → "Publish Claude Comms Setup Installer"** and click **Run workflow**:

- **Branch:** `main`
- **Version bump type:** `major`
- **Dry run:** `false` (or `true` to verify first)

This will:
1. `npm version major --no-git-tag-version` → bumps `1.0.46` → `2.0.0`
2. `npm run build` → produces the package
3. `npm publish --access public` → authenticates via OIDC trusted publisher (no secret needed)
4. Commits the version bump, tags `v2.0.0`, pushes tag to `main`

### 3. Manual fallback if OIDC fails

If the OIDC trusted-publisher flow does not authenticate:

```bash
cd packages/setup-installer
npm version major                        # 1.0.46 → 2.0.0
npm run build
NPM_TOKEN=$(grep NPM_TOKEN /workspaces/claude-comms/.env | cut -d= -f2)
npm publish --access public              # set NODE_AUTH_TOKEN=$NPM_TOKEN in env
```

**Token details:**
- Location: `/workspaces/claude-comms/.env` (gitignored — confirmed via `git check-ignore`)
- Expiry: ~2 days from 2026-05-14 (act promptly)
- NEVER commit `.env`

After manual publish, tag and push:
```bash
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin main --follow-tags
```

---

## Out-of-Scope Ledger

Items explicitly deferred by the North Star assignment. Future PMs should not rediscover these as gaps.

### Installer source code CC2 references (D3/D4)

`packages/setup-installer/src/` and `bin/` were explicitly excluded from this retirement ("implementation code stays; only doc/config files and the auto-generated subdirs are touched"). Several files still reference CC2 artifacts that no longer exist in the repo:

- `src/fetcher/github.js` — references `.claude/hooks/comms/*.py` paths
- `src/utils/constants.js` — CC2 path constants
- `src/cli/runner.js` — CC2 setup messaging
- `bin/claude-setup.js` — CC2 startup instructions
- `test/` — test fixtures referencing CC2 hooks

**Impact:** The installer warns but does not hard-fail. Clients receive CC2-free content because the installer fetches from the repo (where CC2 files are now deleted), so the fetcher gracefully skips missing paths. The v2.0.0 `npx claude-comms` install delivers a CC2-free client. A separate installer-modernization assignment should clean these string references to eliminate dead-code noise.

### `docs/spec/multi-agent-orchestration.md`

Flagged in the survey as potentially-stale doctrine. User explicitly deferred: "not in retirement scope."

### `.agents/tools/workflow/templates/`

Explicitly excluded. `document.md` contains two pointers to deleted CC2 guides — these remain as null pointers per the user's fallback rule. No edits, no replacements.

### Other excluded directories

| Path | Reason |
|---|---|
| `docs/project/research/` | Historical |
| `docs/project/phases/` | Historical |
| `docs/project/archive/` | Historical |
| `docs/options/eng-prompt.md` | Not in retirement scope |
| `docs/tech-docs/` | Not in retirement scope |
| `docs/project/features/` | Not in retirement scope |
| `_research/claude-code-harness/` | False-positive grep hits, not CC2 |
| `workflow-engine/`, `convex/` | New system, untouched |

### Slash command file names

The `cc3-*` prefix on `.claude/commands/cc3-{server,client,client-update}.md` was explicitly retained by user directive. A future rename to drop the `cc3-` prefix may be considered but is not part of this retirement.
