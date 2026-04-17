# Harness Model Configuration -- Implementation Plan

## Purpose

The workflow engine supports three AI harnesses (Claude, Codex, Gemini), each with multiple models. Currently, harness selection per job type lives in a local `config.json` file and only maps job types to harnesses -- not models. Fan-out logic for review jobs is hardcoded in CLI code (`AUTO_EXPAND_CONFIG`). Model selection within a harness is either hardcoded (Gemini hardcodes `auto-gemini-3` in `buildCommand`) or absent (Claude and Codex get provider defaults).

This plan delivers **namespace-scoped harness + model configuration stored in Convex**, editable from the UI, replacing both the local config mapping and the hardcoded fan-out logic. The user gets unified, flexible control over which harness and model runs for each job type -- including fan-out arrays for multi-perspective review.

## Overview

**What changes:**
1. Namespace records in Convex gain a `harnessDefaults` field
2. Jobs and chatJobs gain an optional `model` string field
3. CLI reads config from Convex instead of local `config.json` for harness/model resolution
4. `AUTO_EXPAND_CONFIG` is removed from CLI -- fan-out is driven by namespace config
5. `buildCommand` in `streams.ts` passes `--model` / `-m` to harness CLIs
6. Runner's `triggerPMGroup` reads namespace config for PM harness+model
7. UI settings modal for viewing/editing namespace harnessDefaults

---

## Research: Harness CLI Model Flags

### Claude (`claude` CLI)

| Attribute | Value |
|-----------|-------|
| **Flag** | `--model <model>` |
| **Short flag** | None |
| **Aliases** | `sonnet`, `opus`, `haiku` |
| **Help text** | "Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-6')." |

**Known model IDs** (as of April 2026):
- `sonnet` (alias -- resolves to latest Sonnet)
- `opus` (alias -- resolves to latest Opus)
- `haiku` (alias -- resolves to latest Haiku)
- `claude-sonnet-4-6` (Sonnet 4.6)
- `claude-opus-4-6` (Opus 4.6)
- `claude-opus-4-7` (Opus 4.7, if available)
- `claude-haiku-4-5-20251001` (Haiku 4.5)

**Notes:**
- Session resume (`--resume`) is Claude-only, orthogonal to model selection
- Model is positionally independent -- can appear anywhere in args
- Aliases resolve server-side to the latest version

### Codex (`codex` CLI)

| Attribute | Value |
|-----------|-------|
| **Flag** | `-m <model>` or `--model <model>` |
| **Location** | Available on both top-level `codex` and `exec` subcommand; we use it on `exec` since that's the subcommand we spawn |
| **Config override** | `-c model="<model>"` (works on top-level too) |

**Known model IDs:**
- `codex-mini-latest` (default Codex model)
- `o4-mini` (OpenAI o4-mini reasoning model)
- `o3` (OpenAI o3 reasoning model)
- `gpt-4.1` (GPT-4.1)
- `gpt-4.1-mini` (GPT-4.1 mini)
- `gpt-4.1-nano` (GPT-4.1 nano)

**Notes:**
- Current `buildCommand` uses `codex exec` (aliased as `codex e`) with `--yolo` and `--json`
- The `-m` flag goes on the `exec` subcommand, which is where we spawn
- Model passed via `-m` on exec overrides config.toml default

### Gemini (`gemini` CLI)

| Attribute | Value |
|-----------|-------|
| **Flag** | `-m <model>` or `--model <model>` |
| **Location** | Top-level option |
| **Aliases** | `auto`, `pro`, `flash`, `flash-lite` |

**Known model IDs:**
- `gemini-2.5-pro` (Gemini 2.5 Pro)
- `gemini-2.5-flash` (Gemini 2.5 Flash)
- `gemini-2.5-flash-lite` (Gemini 2.5 Flash Lite)
- `gemini-3-pro-preview` (Gemini 3 Pro preview)
- `gemini-3-flash-preview` (Gemini 3 Flash preview)
- `auto-gemini-3` (auto-routing for Gemini 3 family)

**Notes:**
- Currently hardcoded: `buildCommand` passes `-m auto-gemini-3` for all Gemini jobs
- This hardcoding is removed by this feature -- model comes from namespace config
- Aliases (`auto`, `pro`, `flash`) resolve based on current preview availability

---

## Architecture Design

### Data Flow

```
UI Settings Modal
      |
      v
Convex namespace.harnessDefaults  <--- init.ts seeds defaults
      |
      v
CLI insert-job / Runner triggerPMGroup
  reads harnessDefaults from namespace
  resolves jobType -> {harness, model}
  stamps harness + model onto job record
      |
      v
Runner executeJob / executeChatJob
  reads job.harness + job.model from job record
      |
      v
buildCommand(harness, prompt, { model, sessionId })
  appends --model / -m to CLI args
      |
      v
Harness CLI process spawns with model flag
```

### Key Design Decisions

1. **Model string is exact CLI argument** -- passed verbatim to `--model` / `-m`. No aliases, no mapping layer in our code. The user types what the harness CLI expects.

2. **Fan-out is fully flexible** -- an array entry in harnessDefaults can contain any mix of harness+model, including multiple same-harness different-model entries.

3. **Resolution order:** job type key -> `default` key -> config error (throw, not silent fallback).

4. **Stamped at insert time** -- when a job is created, `harness` and `model` are resolved from namespace config and written onto the job record. The runner reads from the job, never from config.

5. **Review result anonymity** -- fan-out results stay unattributed to prevent PM bias.

6. **Namespace-scoped, not assignment-scoped** -- config applies to all assignments in the namespace.

7. **Convex-only** -- no file-based fallback. Local `config.json` retains only connection params and timeouts.

---

## Schema Changes

### `namespaces` table -- add `harnessDefaults`

```typescript
// In schema.ts, namespaces table gets:
harnessDefaults: v.optional(v.string()), // JSON-encoded harnessDefaults object
```

**Why `v.string()` (JSON) instead of nested Convex validators?**
- The shape is a dynamic map of job type keys to either a single entry or an array of entries
- Convex validators don't support `v.record()` with union values cleanly for this dynamic key structure
- JSON string with application-level validation is the pragmatic choice
- Parse/validate in a shared utility used by CLI, runner, and Convex mutations

**Parsed shape:**
```typescript
interface HarnessModelEntry {
  harness: "claude" | "codex" | "gemini";
  model?: string; // Optional -- omit to use harness default
}

interface HarnessDefaults {
  default: HarnessModelEntry;
  [jobType: string]: HarnessModelEntry | HarnessModelEntry[]; // Array = fan-out
}
```

### `jobs` table -- add `model`

```typescript
// Add to jobs table definition:
model: v.optional(v.string()), // Model string passed to harness CLI
```

### `chatJobs` table -- add `model`

```typescript
// Add to chatJobs table definition:
model: v.optional(v.string()), // Model string passed to harness CLI
```

### Why optional?

Existing jobs in the database have no model field. Making it optional means:
- No migration needed for existing records
- Jobs without model use harness default (backward compatible)
- New jobs get model stamped from namespace config

---

## Dependency Map

```
WP1: Schema + Shared Utilities (foundation)
 |
 +---> WP2: Convex Mutations & Queries (depends on WP1)
         |
         +---> WP3: CLI Changes (depends on WP2)
         |
         +---> WP4: Runner + Executor Changes (depends on WP2)
         |
         +---> WP5: UI Settings Modal (depends on WP2)

         After WP3 + WP4 both land:
         +---> Cleanup: Remove harnessDefaults from config.json + config.example.json

Parallelization opportunities:
  - WP3, WP4, WP5 can all run in parallel (each depends only on WP2)
  - WP3 and WP4 share config.json but neither modifies it -- they only stop reading from it
  - config.json field removal is deferred to a cleanup step after both WP3 and WP4 land
```

---

## Work Package Breakdown

### WP1: Schema + Shared Utilities

**Scope:** Convex schema additions and shared parsing/validation utilities.

**Changes:**
1. `workflow-engine/convex/schema.ts`
   - Add `harnessDefaults: v.optional(v.string())` to `namespaces` table
   - Add `model: v.optional(v.string())` to `jobs` table
   - Add `model: v.optional(v.string())` to `chatJobs` table

2. `.agents/tools/workflow/lib/harness-defaults.ts` (new shared utility)
   - `HarnessModelEntry` type: `{ harness: Harness; model?: string }`
   - `HarnessDefaults` type: `{ default: HarnessModelEntry; [key: string]: HarnessModelEntry | HarnessModelEntry[] }`
   - `parseHarnessDefaults(json: string): HarnessDefaults` -- parse and validate
   - `resolveJobType(defaults: HarnessDefaults, jobType: string): HarnessModelEntry | HarnessModelEntry[]` -- resolution with `default` fallback
   - `validateHarnessDefaults(defaults: HarnessDefaults): string[]` -- returns validation errors (unknown harness values, missing default key, etc.)
   - `DEFAULT_HARNESS_DEFAULTS: HarnessDefaults` -- the seed config for new namespaces

**Success Criteria:**
- Schema deploys without errors
- Existing data is unaffected (all new fields are optional)
- Shared utility parses the mental model config example correctly
- Resolution order is: exact jobType key -> `default` key -> throws error
- Fan-out arrays are resolved as-is (no flattening)

---

### WP2: Convex Mutations & Queries

**Scope:** Backend API to read and update namespace harnessDefaults, plus job creation mutations that accept and store `model`.

**Changes:**
1. `workflow-engine/convex/namespaces.ts`
   - Add `getHarnessDefaults` query: takes namespaceId, returns parsed harnessDefaults (or default if not set)
   - Add `updateHarnessDefaults` mutation: takes namespaceId + JSON string, validates with shared utility, stores on namespace
   - Modify `create` mutation: accept optional `harnessDefaults` param to seed during init

2. `.agents/tools/workflow/init.ts`
   - Import `DEFAULT_HARNESS_DEFAULTS` from shared utility
   - Pass `harnessDefaults: JSON.stringify(DEFAULT_HARNESS_DEFAULTS)` to `namespaces.create` call
   - This ensures new namespaces are bootstrapped with default config on client setup

3. `workflow-engine/convex/jobs.ts`
   - Update `jobDefValidator` to include `model: v.optional(v.string())`
   - Update `createGroup` and `insertGroupAfter` handlers to pass `model` through to job record insert
   - Update `Job` type/interface if defined separately from schema (ensure `model` propagates through type surface)

4. `workflow-engine/convex/chatJobs.ts`
   - Update `trigger` mutation to accept optional `model: v.optional(v.string())`
   - Store `model` on chatJob record
   - **Server-side resolution:** When `harness` or `model` are not explicitly provided by the caller, `trigger` should resolve them from namespace harnessDefaults (via the thread's namespace). This ensures ALL chat job insertion paths (CLI `sendChatMessage`, UI `ChatPanel`, runner `triggerGuardianEvaluation`) get namespace-scoped config without each caller needing to resolve independently. The mutation already receives `threadId` -- look up thread → namespace → harnessDefaults → resolve `chat` type.
   - Current default `args.harness ?? "claude"` (line 28) is replaced by namespace config resolution

**Notes on shared utility in Convex:**
- Convex functions can't import from outside the `convex/` directory
- The parse/validate logic must be duplicated or placed in `convex/lib/harnessDefaults.ts`
- The CLI/runner can import from `.agents/tools/workflow/lib/harness-defaults.ts`
- Keep both copies in sync -- same logic, different import paths

**Success Criteria:**
- `getHarnessDefaults` returns parsed config for a namespace (falls back to built-in default)
- `updateHarnessDefaults` validates input and rejects invalid configs (bad harness, missing default)
- Job creation accepts and stores `model` field
- ChatJob trigger accepts and stores `model` field
- Existing mutations continue to work (model is optional)

---

### WP3: CLI Changes

**Scope:** Remove `AUTO_EXPAND_CONFIG`, read harnessDefaults from Convex, resolve harness+model at job insert time, stamp model on job records.

**Changes:**
1. `.agents/tools/workflow/cli.ts`
   - **Remove** `AUTO_EXPAND_CONFIG` constant (line 81-85)
   - **Remove** `expandJobs()` function (line 369-395) and its `JobDefInput`/`JobDef` types
   - **Remove** `getHarnessForJobType()` function (line 91-93) -- replaced by Convex-backed resolution
   - **Add** namespace harnessDefaults fetch: query `namespaces.getHarnessDefaults` once per CLI invocation
   - **Update** `insertJobs()`: resolve each job's harness+model from namespace defaults, expand fan-out arrays inline
   - **Update** `sendChatMessage()`: resolve chat harness+model from namespace defaults (note: with server-side resolution in WP2, CLI can pass explicit harness+model or omit and let the mutation resolve)
   - **Add** `--model` flag to `insert-job` command for one-off model overrides (alongside existing `--harness` flag)
   - **Stop reading** `harnessDefaults` from `Config` interface (no longer used from config.json). Do NOT remove the field from config.json yet -- deferred to cleanup step after WP4 also stops reading it.

2. `.agents/tools/workflow/config.json`
   - **No changes in WP3.** The `harnessDefaults` field remains in config.json until both WP3 and WP4 have stopped reading it. Removal is a cleanup step (see Dependency Map).

**Resolution logic in CLI (replaces expandJobs + AUTO_EXPAND_CONFIG):**
```typescript
async function resolveJobs(
  harnessDefaults: HarnessDefaults,
  jobs: { jobType: string; harness?: string; model?: string; context?: string }[]
): { jobType: string; harness: string; model?: string; context?: string }[] {
  const resolved = [];
  for (const job of jobs) {
    if (job.harness) {
      // Explicit harness override -- use as-is
      resolved.push(job);
    } else {
      const config = resolveJobType(harnessDefaults, job.jobType);
      if (Array.isArray(config)) {
        // Fan-out: create one job per entry
        for (const entry of config) {
          resolved.push({
            jobType: job.jobType,
            harness: entry.harness,
            model: entry.model,
            context: job.context,
          });
        }
      } else {
        resolved.push({
          jobType: job.jobType,
          harness: config.harness,
          model: config.model,
          context: job.context,
        });
      }
    }
  }
  return resolved;
}
```

**Success Criteria:**
- `insert-job --type review` fans out based on namespace config, not hardcoded `AUTO_EXPAND_CONFIG`
- `insert-job --type implement` resolves harness+model from namespace config
- `--harness` flag still works as explicit override (bypasses config lookup)
- `chat-send` resolves chat harness+model from namespace config
- Jobs in Convex have correct `model` field after insert
- CLI no longer reads `harnessDefaults` from config.json (reads from Convex instead)

---

### WP4: Runner + Executor Changes

**Scope:** Pass `model` from job record to harness CLI via `buildCommand`, update runner's PM group triggering to read from Convex.

**Changes:**
1. `.agents/tools/workflow/lib/streams.ts`
   - **Update** `CommandOptions` interface: add `model?: string`
   - **Update** `buildCommand()`: for each harness, insert `--model <model>` (Claude) or `-m <model>` (Codex, Gemini) when model is provided
   - **Remove** Gemini hardcoded `-m auto-gemini-3` -- model comes from job record or defaults if not set

   Updated `buildCommand`:
   ```typescript
   export function buildCommand(
     harness: string,
     prompt: string,
     options: CommandOptions = {}
   ): CommandResult {
     switch (harness) {
       case "claude": {
         const args = [
           "--dangerously-skip-permissions",
           "--verbose",
           "--output-format", "stream-json",
           "--disable-slash-commands",
         ];
         if (options.model) {
           args.push("--model", options.model);
         }
         if (options.sessionId) {
           args.push("--resume", options.sessionId);
           if (options.forkSession) {
             args.push("--fork-session");
           }
         }
         args.push("-p", prompt);
         return { cmd: "claude", args };
       }
       case "codex": {
         const args = ["--yolo", "e"];
         if (options.model) {
           args.push("-m", options.model);
         }
         args.push(prompt, "--json");
         return { cmd: "codex", args };
       }
       case "gemini": {
         const args = ["--yolo"];
         if (options.model) {
           args.push("-m", options.model);
         }
         args.push("--output-format", "stream-json", "-p", prompt);
         return { cmd: "gemini", args };
       }
       default:
         throw new Error(`Unknown harness: ${harness}`);
     }
   }
   ```

2. `.agents/tools/workflow/lib/harness-executor.ts`
   - **Update** `ExecuteOptions` interface: add `model?: string`
   - **Update** `execute()`: pass `options.model` to `buildCommand` via `commandOptions`
   - Same for `adoptOrphan` if it calls buildCommand (it doesn't -- it replays, so no change)

3. `.agents/tools/workflow/runner.ts`
   - **Update** `executeJob()`: read `job.model` (new schema field) and pass to executor
   - **Update** `executeChatJob()`: read `chatJob.model` and pass to executor
   - **Update** `triggerPMGroup()`: fetch namespace harnessDefaults from Convex (via `assignment.namespaceId`), resolve PM harness+model, pass both to `insertGroupAfter`
   - **Update** `triggerGuardianEvaluation()`: pass `model` alongside `harness` when calling `chatJobs.trigger` (runner.ts:430-434). With server-side resolution in WP2, the runner can either resolve and pass explicitly, or omit and let the mutation resolve from namespace config. Recommended: let the mutation resolve (simpler, single resolution authority).
   - **Remove** `getHarnessForJobType()` function -- called at TWO sites: `triggerPMGroup` (runner.ts:~760) and `triggerGuardianEvaluation` (runner.ts:434). Both must be updated before the function is removed.
   - **Stop reading** `harnessDefaults` from `Config` interface. Do NOT remove from config.json yet -- deferred to cleanup step.
   - **Fetch** namespace harnessDefaults fresh from Convex each time `triggerPMGroup` or `triggerGuardianEvaluation` needs to resolve harness+model (no long-lived cache — UI edits must take effect for subsequent inserts)

4. `.agents/tools/workflow/lib/prompts.ts` (if applicable)
   - Update `Job` / `ChatJob` type interfaces to include optional `model` field if types are maintained separately from schema

**Success Criteria:**
- Claude jobs with model field spawn with `claude --model <model> ...`
- Codex jobs with model field spawn with `codex --yolo e -m <model> ...`
- Gemini jobs with model field spawn with `gemini --yolo -m <model> ...`
- Jobs without model field spawn without `--model` / `-m` flag (harness uses its default)
- Gemini no longer hardcodes `auto-gemini-3`
- PM groups triggered by runner resolve harness+model from Convex namespace config
- Guardian evaluations triggered by runner use namespace config for harness+model (not hardcoded `getHarnessForJobType("chat")`)
- Runner no longer reads harnessDefaults from config.json
- `getHarnessForJobType()` is fully removed (no remaining call sites)

---

### WP5: UI Settings Modal

**Scope:** Settings UI for viewing and editing namespace harnessDefaults.

**UX Context:** The UI is a cross-namespace operations center (mental model line 126). The primary surface is the thread list with namespace filtering via an accordion in the sidebar. The settings modal must be discoverable from the active workspace area -- not buried in a namespace-specific header that may not be visible when viewing all-namespace threads. Recommended entry point: gear icon near the namespace filter accordion in `ChatSidebar`, opening a modal that requires namespace selection (dropdown) if no single namespace is filtered. Alternative: settings gear per-namespace in the `NamespaceList` accordion items.

**Changes:**
1. `workflow-engine/ui/js/components/namespace/NamespaceSettings.js` (new)
   - Modal triggered from namespace filter area in sidebar (gear icon near namespace accordion)
   - Requires namespace selection -- if multiple namespaces are active, prompt user to choose which namespace to configure
   - Displays current harnessDefaults in an editable form
   - Job type rows: each row has jobType label, harness dropdown, model text input
   - Fan-out support: rows that are arrays show multiple entries with add/remove
   - "Add job type" button for custom job types
   - Save calls `namespaces.updateHarnessDefaults` mutation
   - Validation: highlights invalid harness values, warns on missing `default` key
   - Styled with Q palette (zero rounded corners, void background, copper accents)
   - All components use `React.createElement()` (no JSX per project convention)

2. `workflow-engine/ui/js/components/namespace/NamespaceList.js` or `ChatSidebar` (modify)
   - Add settings gear icon (QIcon) near namespace filter that opens the settings modal

3. `workflow-engine/ui/js/hooks/useNamespaceSettings.js` (new)
   - Custom hook wrapping `useQuery(api.namespaces.getHarnessDefaults)` and `useMutation(api.namespaces.updateHarnessDefaults)`
   - Handles optimistic updates, error states, loading states

4. `workflow-engine/ui/js/api.js` (modify if needed)
   - Ensure API bindings exist for new namespace queries/mutations

**UI Layout:**
```
+--------------------------------------------------+
| Namespace Settings                          [X]  |
+--------------------------------------------------+
| Harness Defaults                                 |
|                                                  |
| default    [claude  v]  [claude-sonnet-4-6    ]  |
| implement  [claude  v]  [claude-sonnet-4-6    ]  |
| pm         [claude  v]  [claude-haiku-4-5-... ]  |
| chat       [claude  v]  [claude-sonnet-4-6    ]  |
|                                                  |
| review (fan-out)                                 |
|   1. [claude  v]  [claude-opus-4-6        ] [-]  |
|   2. [codex   v]  [o4-mini                ] [-]  |
|   3. [gemini  v]  [gemini-2.5-pro         ] [-]  |
|   [+ Add entry]                                  |
|                                                  |
| [+ Add job type]                                 |
|                                                  |
|                        [Cancel]  [Save Changes]  |
+--------------------------------------------------+
```

**Success Criteria:**
- Modal is discoverable from the active workspace area (sidebar namespace filter region)
- Displays current harnessDefaults (or sensible defaults if none set)
- User can edit harness and model for each job type
- Fan-out arrays are editable (add/remove entries)
- Save persists to Convex and takes effect for next job inserts
- Invalid inputs show validation errors before save
- Follows Q palette aesthetic (no rounded corners, correct colors)

---

## Migration / Bootstrap Plan

### New Namespaces

When `init.ts` creates a new namespace, it seeds `harnessDefaults` with:
```json
{
  "default": { "harness": "claude", "model": "claude-sonnet-4-6" },
  "implement": { "harness": "claude", "model": "claude-sonnet-4-6" },
  "review": [
    { "harness": "claude", "model": "claude-opus-4-6" },
    { "harness": "codex", "model": "o4-mini" },
    { "harness": "gemini", "model": "gemini-2.5-pro" }
  ],
  "pm": { "harness": "claude", "model": "claude-haiku-4-5-20251001" },
  "chat": { "harness": "claude", "model": "claude-sonnet-4-6" }
}
```

Changes to `init.ts`:
- Import `DEFAULT_HARNESS_DEFAULTS` from shared utility
- Pass `harnessDefaults: JSON.stringify(DEFAULT_HARNESS_DEFAULTS)` to `namespaces.create`

### Existing Namespaces

Existing namespaces have no `harnessDefaults` field. Two options:

**Option A (recommended): Lazy bootstrap with fallback**
- `getHarnessDefaults` query returns `DEFAULT_HARNESS_DEFAULTS` when namespace has no `harnessDefaults` field
- UI settings modal shows defaults and allows saving (which writes the field)
- No migration mutation needed
- First save from UI "adopts" the namespace into the new system

**Option B: Eager migration script**
- One-time script queries all namespaces, writes `DEFAULT_HARNESS_DEFAULTS` to each
- Unnecessary given the lazy approach works cleanly

### Config.json Deprecation (Staged)

The `harnessDefaults` field in config.json is deprecated in stages to avoid a parallel-execution hazard between WP3 (CLI) and WP4 (runner), which both read from it independently:

1. **WP3:** CLI stops reading `harnessDefaults` from config.json (reads from Convex instead). Field remains in config.json.
2. **WP4:** Runner stops reading `harnessDefaults` from config.json (reads from Convex instead). Field remains in config.json.
3. **Cleanup step (after WP3 + WP4 both land):** Remove `harnessDefaults` from `config.json`, `config.example.json`, and the shared `Config` TypeScript interface.
4. Leave `convexUrl`, `namespace`, `password`, `timeoutMs`, `idleTimeoutMs` in config.json (connection params stay local)

### Existing Jobs

Existing job records have no `model` field. This is handled by:
- `model` is `v.optional(v.string())` in schema -- existing records are valid
- `buildCommand` only passes `--model` / `-m` when model is defined
- Old jobs without model continue to use harness defaults (current behavior)

---

## Assignment-Level Success Criteria

1. **Config stored in Convex:** `harnessDefaults` is on namespace records, not in local files
2. **Model passed to harness:** `--model` / `-m` appears in spawned CLI args when model is set
3. **Fan-out from config:** `insert-job --type review` creates multiple jobs per namespace config, not hardcoded
4. **AUTO_EXPAND_CONFIG removed:** no hardcoded fan-out arrays in CLI code
5. **Gemini not hardcoded:** `auto-gemini-3` no longer appears in `buildCommand`
6. **UI editable:** settings modal allows viewing and editing harnessDefaults, discoverable from sidebar
7. **Backward compatible:** existing namespaces, jobs, and chatJobs continue to work
8. **Model on job records:** new jobs have `model` field in Convex
9. **Runner reads job, not config:** runner uses `job.model`, not `config.harnessDefaults`
10. **Review anonymity preserved:** fan-out results don't expose which harness/model produced them (existing behavior, verify it's maintained)
11. **All insertion paths covered:** CLI insert-job, CLI chat-send, UI ChatPanel, runner triggerPMGroup, and runner triggerGuardianEvaluation all resolve harness+model from namespace config
12. **config.json cleanly deprecated:** staged removal with no race between WP3/WP4

---

## Resolved Questions

1. **Convex `v.record()` vs JSON string for harnessDefaults:** **Decision: JSON string (`v.string()`).** The dynamic key structure (arbitrary job type names mapping to either a single entry or array of entries) doesn't map cleanly to Convex's static validators. While `v.record(v.string(), v.union(...))` is technically possible, it adds schema complexity for a field that changes infrequently and benefits from application-level validation with descriptive error messages. JSON string with `parseHarnessDefaults()` validation is the pragmatic choice.

2. **Shared utility duplication:** **Decision: Manual sync.** The parsing/validation logic exists in two locations (`convex/lib/harnessDefaults.ts` and `.agents/tools/workflow/lib/harness-defaults.ts`) due to Convex's import boundary. Each file should reference the other in a comment. A build-step copy adds deployment complexity disproportionate to the maintenance cost of syncing a small utility.

3. **Model field on chat jobs:** **Resolved: Top-level field.** `model` is a top-level field on `chatJobs` (matching the existing top-level `harness` field). It's an execution parameter, not session/threading metadata -- it doesn't belong in the `context` JSON blob. Confirmed: `chatJobs` schema already has `harness` at top level (chatJobs.ts:20-22).

4. **Runner namespace ID availability:** **Resolved: Available.** `triggerPMGroup` receives `assignment: Assignment`, and `Assignment` has `namespaceId` (schema.ts:20). Call chain: `executeJob` → `handleGroupCompletion` → `triggerPMGroup(completedGroup, assignment, ...)`. Use `assignment.namespaceId` to query `getHarnessDefaults`.

## Remaining Implementation Note

- **Server-side vs client-side resolution authority:** The `chatJobs.trigger` mutation is the single resolution authority for chat job harness+model. It resolves from namespace config when callers don't provide explicit values. This ensures consistency across all insertion paths (CLI, UI, runner guardian) without requiring each caller to independently fetch and resolve namespace config. For assignment jobs, the CLI and runner's `triggerPMGroup` resolve at insert time -- this is acceptable because those paths have a single caller each.

---

## Recommended Job Sequence

```
1. WP1: Schema + Shared Utilities          (implement)
2. WP2: Convex Mutations & Queries         (implement)
3. WP3: CLI Changes                        (implement) \
4. WP4: Runner + Executor Changes          (implement)  } parallel
5. WP5: UI Settings Modal                  (implement) /
6. Integration review                      (review)
7. UAT                                     (uat)
```

- WP1 first: schema must deploy before mutations can use new fields
- WP2 second: backend API must exist before consumers (CLI, runner, UI) can use it
- WP3/WP4/WP5 in parallel: independent consumers of the WP2 API
- Review after all implementation: verify cross-cutting concerns (anonymity, resolution order, backward compat)
- UAT: manual test of full flow -- edit config in UI, insert job via CLI, verify correct model flag in spawned process
