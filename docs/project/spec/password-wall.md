# Password Wall: Secure Workflow Engine for Vercel Deployment

## Purpose

The Convex backend is currently public - anyone with the deployment URL can read data or trigger jobs that execute on the user's local machine using their API tokens. This is a critical security gap that must be closed before Vercel deployment.

This phase adds simple password protection as a gate to stop bots and casual snoops. Since this is a single-user system, complex auth (OAuth, sessions, JWTs) is unnecessary - a password wall is sufficient.

## Overview

Add password protection at three integration points:
1. **Convex Backend**: All public functions require a `password` argument validated against `ADMIN_PASSWORD` env var
2. **UI (React)**: Login form stores password in sessionStorage, passes with every Convex call
3. **Runner + CLI**: Read password from `config.json`, pass with every Convex call

## Architecture Design

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Convex Backend                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ADMIN_PASSWORD env var (set in Convex Dashboard)                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                     │
│                                   ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  requirePassword(args) helper                                    │  │
│  │  - Throws Error("Unauthorized") if password !== ADMIN_PASSWORD   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                     │
│          ┌────────────────────────┼────────────────────────────────┐   │
│          ▼                        ▼                        ▼       │   │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐ │   │
│  │  Queries     │        │  Mutations   │        │  Scheduler   │ │   │
│  │  (28 funcs)  │        │  (24 funcs)  │        │  (4 funcs)   │ │   │
│  └──────────────┘        └──────────────┘        └──────────────┘ │   │
└─────────────────────────────────────────────────────────────────────────┘
                    ▲                   ▲                   ▲
                    │                   │                   │
         ┌──────────┴───────┐   ┌──────┴──────┐   ┌───────┴────────┐
         │   UI (React)     │   │   Runner    │   │     CLI        │
         │   sessionStorage │   │  config.json│   │  config.json   │
         └──────────────────┘   └─────────────┘   └────────────────┘
```

### Key Components

#### 1. Convex Auth Helper (`convex/auth.ts`)

New file providing centralized password validation:

```typescript
// convex/auth.ts
export function requirePassword(args: { password?: string }): void {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("Server misconfigured: ADMIN_PASSWORD not set");
  }
  if (!args.password || args.password !== adminPassword) {
    throw new Error("Unauthorized");
  }
}
```

#### 2. Convex Function Changes

Every public query and mutation must:
1. Add `password: v.string()` to args validator
2. Call `requirePassword(args)` as first line in handler

Example transformation:
```typescript
// BEFORE
export const list = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    return await ctx.db.query("assignments")...
  },
});

// AFTER
export const list = query({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces")
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.query("assignments")...
  },
});
```

#### 3. UI Login Component

New `LoginGate` component that:
- Shows login form if no password in sessionStorage
- Validates password against Convex (call a simple query)
- Stores password in sessionStorage on success
- Wraps entire app (ConvexProvider receives password)

```typescript
// workflow-engine/ui/js/components/auth/LoginGate.js
function LoginGate({ children }) {
  const [password, setPassword] = useState(sessionStorage.getItem('adminPassword'));
  const [error, setError] = useState(null);

  if (!password) {
    return <LoginForm onSuccess={(pwd) => {
      sessionStorage.setItem('adminPassword', pwd);
      setPassword(pwd);
    }} />;
  }

  return <PasswordContext.Provider value={password}>
    {children}
  </PasswordContext.Provider>;
}
```

#### 4. UI Convex Hook Changes

Modify `useQuery` and `useMutation` to auto-inject password:

```typescript
// workflow-engine/ui/js/hooks/useConvex.js
export function useQuery(queryName, args = {}) {
  const password = useContext(PasswordContext);
  const argsWithPassword = { ...args, password };
  // ... existing subscription logic with argsWithPassword
}

export function useMutation(mutationName) {
  const password = useContext(PasswordContext);
  return async (args = {}) => {
    return await client.mutation(mutationName, { ...args, password });
  };
}
```

#### 5. Config.json Schema Change

Add password field to both config files:

```json
// .agents/tools/workflow/config.json
{
  "convexUrl": "https://...",
  "namespace": "...",
  "password": "your-admin-password-here",
  "timeoutMs": 3600000,
  ...
}

// workflow-engine/ui/config.json
{
  "convexUrl": "https://..."
}
// Note: UI does NOT store password in config.json (uses sessionStorage)
```

#### 6. Runner + CLI Changes

Both already read `config.json`. Add password to all Convex calls:

```typescript
// Runner: Update all client.query/mutation calls
const password = config.password;
await client.mutation(api.jobs.start, { id: jobId, prompt, password });

// CLI: Same pattern
await client.query(api.assignments.list, { namespaceId, status, password });
```

## Dependency Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  WP-1: Convex Auth Helper + Environment Setup                       │
│  - Create convex/auth.ts with requirePassword()                     │
│  - Set ADMIN_PASSWORD in Convex Dashboard                           │
│  - No dependencies                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WP-2: Convex Function Protection (PARALLEL AFTER WP-1)            │
│  - Add password arg to all queries/mutations                        │
│  - Call requirePassword() in each handler                           │
│  - Depends on: WP-1                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  WP-3: UI Login  │     │  WP-4: Runner    │     │  WP-5: CLI       │
│  Gate Component  │     │  Password Pass   │     │  Password Pass   │
│  (PARALLEL)      │     │  (PARALLEL)      │     │  (PARALLEL)      │
│  Depends: WP-2   │     │  Depends: WP-2   │     │  Depends: WP-2   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WP-6: Integration Testing + Vercel Deployment Validation           │
│  - End-to-end test of all protected paths                           │
│  - Vercel build verification                                        │
│  - Depends on: WP-3, WP-4, WP-5                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Work Package Breakdown

### WP-1: Convex Auth Helper + Environment Setup

**Scope**: Create centralized auth helper and configure environment

**Files to Create/Modify**:
- `workflow-engine/convex/auth.ts` (NEW)

**Implementation**:
1. Create `convex/auth.ts` with `requirePassword()` function
2. Function reads `process.env.ADMIN_PASSWORD`
3. Throws `Error("Unauthorized")` on mismatch
4. Document: User must set `ADMIN_PASSWORD` in Convex Dashboard

**Success Criteria**:
- [ ] `requirePassword()` function exists and is importable
- [ ] Function throws on missing/wrong password
- [ ] Function passes silently on correct password
- [ ] ADMIN_PASSWORD env var documented in README/ONBOARD.md

---

### WP-2: Convex Function Protection

**Scope**: Add password validation to all public Convex functions

**Files to Modify**:
- `workflow-engine/convex/assignments.ts` (9 functions)
- `workflow-engine/convex/chatJobs.ts` (8 functions)
- `workflow-engine/convex/chatMessages.ts` (2 functions)
- `workflow-engine/convex/chatThreads.ts` (12 functions)
- `workflow-engine/convex/jobs.ts` (13 functions)
- `workflow-engine/convex/namespaces.ts` (6 functions)
- `workflow-engine/convex/scheduler.ts` (6 functions)

**Function Inventory** (57 total - verified by grep):

| File | Function | Type | Line |
|------|----------|------|------|
| **assignments.ts** (9 functions) |
| assignments.ts | list | query | :6 |
| assignments.ts | get | query | :34 |
| assignments.ts | getWithGroups | query | :42 |
| assignments.ts | create | mutation | :71 |
| assignments.ts | update | mutation | :94 |
| assignments.ts | complete | mutation | :129 |
| assignments.ts | block | mutation | :139 |
| assignments.ts | unblock | mutation | :153 |
| assignments.ts | remove | mutation | :164 |
| **chatJobs.ts** (8 functions) |
| chatJobs.ts | trigger | mutation | :14 |
| chatJobs.ts | start | mutation | :104 |
| chatJobs.ts | complete | mutation | :121 |
| chatJobs.ts | fail | mutation | :147 |
| chatJobs.ts | updateMetrics | mutation | :170 |
| chatJobs.ts | getPending | query | :192 |
| chatJobs.ts | get | query | :207 |
| chatJobs.ts | getActiveForThread | query | :218 |
| **chatMessages.ts** (2 functions) |
| chatMessages.ts | list | query | :6 |
| chatMessages.ts | add | mutation | :19 |
| **chatThreads.ts** (12 functions) |
| chatThreads.ts | listAll | query | :8 |
| chatThreads.ts | list | query | :15 |
| chatThreads.ts | get | query | :26 |
| chatThreads.ts | create | mutation | :35 |
| chatThreads.ts | updateMode | mutation | :53 |
| chatThreads.ts | linkAssignment | mutation | :66 |
| chatThreads.ts | getGuardianThread | query | :80 |
| chatThreads.ts | enableGuardianMode | mutation | :95 |
| chatThreads.ts | updateTitle | mutation | :120 |
| chatThreads.ts | updateSessionId | mutation | :133 |
| chatThreads.ts | updateLastPromptMode | mutation | :147 |
| chatThreads.ts | linkAssignmentRaw | mutation | :161 |
| chatThreads.ts | remove | mutation | :174 |
| **jobs.ts** (13 functions) |
| jobs.ts | list | query | :9 |
| jobs.ts | get | query | :46 |
| jobs.ts | getWithGroup | query | :53 |
| jobs.ts | getGroup | query | :71 |
| jobs.ts | getGroupWithJobs | query | :78 |
| jobs.ts | listGroups | query | :94 |
| jobs.ts | createGroup | mutation | :145 |
| jobs.ts | insertGroupAfter | mutation | :195 |
| jobs.ts | start | mutation | :246 |
| jobs.ts | complete | mutation | :278 |
| jobs.ts | fail | mutation | :308 |
| jobs.ts | updateMetrics | mutation | :338 |
| jobs.ts | getWithAssignment | query | :429 |
| **namespaces.ts** (6 functions) |
| namespaces.ts | list | query | :6 |
| namespaces.ts | get | query | :16 |
| namespaces.ts | getByName | query | :23 |
| namespaces.ts | create | mutation | :35 |
| namespaces.ts | update | mutation | :61 |
| namespaces.ts | remove | mutation | :79 |
| **scheduler.ts** (6 functions) |
| scheduler.ts | getReadyJobs | query | :161 |
| scheduler.ts | getQueueStatus | query | :213 |
| scheduler.ts | getAllNamespaces | query | :254 |
| scheduler.ts | watchQueue | query | :293 |
| scheduler.ts | getAllAssignments | query | :341 |
| scheduler.ts | getReadyChatJobs | query | :387 |

**Summary by Type:**
- Queries: 30
- Mutations: 27
- **Total: 57 functions**

**Implementation Pattern** (for each function):
```typescript
import { requirePassword } from "./auth";

export const functionName = query({
  args: {
    password: v.string(),  // ADD THIS
    ...existingArgs
  },
  handler: async (ctx, args) => {
    requirePassword(args);  // ADD THIS AS FIRST LINE
    // ... existing handler code unchanged
  },
});
```

**Success Criteria**:
- [ ] All 57 functions have `password: v.string()` in args
- [ ] All 57 functions call `requirePassword(args)` first
- [ ] Convex deploys successfully with `npx convex deploy`
- [ ] Calling any function without password returns "Unauthorized" error
- [ ] Calling any function with wrong password returns "Unauthorized" error
- [ ] Calling any function with correct password works as before

---

### WP-3: UI Login Gate Component

**Scope**: Add login screen and password context to UI

**Files to Create/Modify**:
- `workflow-engine/ui/js/components/auth/LoginGate.js` (NEW)
- `workflow-engine/ui/js/components/auth/LoginForm.js` (NEW)
- `workflow-engine/ui/js/components/auth/PasswordContext.js` (NEW)
- `workflow-engine/ui/js/components/auth/index.js` (NEW)
- `workflow-engine/ui/js/hooks/useConvex.js` (MODIFY)
- `workflow-engine/ui/js/main.js` (MODIFY)
- `workflow-engine/ui/js/api.js` (MODIFY - add validatePassword query reference)

**Implementation**:

1. **PasswordContext**: React context to hold password
2. **LoginForm**: Q-palette styled login form
   - Password input field
   - Submit button
   - Error message display
   - Calls `namespaces.list` with password to validate
3. **LoginGate**: Wrapper that shows LoginForm or children
   - Reads password from sessionStorage on mount
   - If no password, show LoginForm
   - On successful login, store in sessionStorage
4. **useConvex hooks**: Auto-inject password from context
   - `useQuery`: Add password to all args
   - `useMutation`: Add password to all args
5. **main.js**: Wrap App with LoginGate

**Q-Palette Styling for LoginForm**:
- Background: `var(--q-void1)`
- Form panel: `var(--q-stone1)` with `var(--q-stone3)` border
- Input: `var(--q-stone0)` background, `var(--q-bone2)` text
- Button: `var(--q-copper1)` background, `var(--q-bone3)` text
- Error: `var(--q-lava1)` text
- Title: `var(--font-display)`, `var(--q-bone3)`

**Success Criteria**:
- [ ] Login form appears when no password in sessionStorage
- [ ] Wrong password shows error message
- [ ] Correct password stores in sessionStorage and shows app
- [ ] All Convex calls include password automatically
- [ ] Page refresh maintains login (sessionStorage persists)
- [ ] Login form matches Q-palette aesthetic

---

### WP-4: Runner Password Integration

**Scope**: Update runner to read password from config and pass to all Convex calls

**Files to Modify**:
- `.agents/tools/workflow/config.json` (add password field)
- `.agents/tools/workflow/config.example.json` (add password field)
- `.agents/tools/workflow/runner.ts` (pass password to all calls)

**Changes to runner.ts**:

1. Update Config interface:
```typescript
interface Config {
  convexUrl: string;
  namespace: string;
  password: string;  // ADD
  timeoutMs: number;
  ...
}
```

2. Add password to all `client.query()` and `client.mutation()` calls:
```typescript
// ~20 call sites need updating
await client.mutation(api.jobs.start, { id: jobId, prompt, password: config.password });
await client.mutation(api.jobs.complete, { id: jobId, result, password: config.password, ... });
// etc.
```

**Success Criteria**:
- [ ] config.json has `password` field
- [ ] config.example.json has `password` field (with placeholder)
- [ ] Runner reads password from config
- [ ] All Convex calls include password
- [ ] Runner connects and processes jobs successfully with correct password
- [ ] Runner fails gracefully with wrong/missing password

---

### WP-5: CLI Password Integration

**Scope**: Update CLI to read password from config and pass to all Convex calls

**Files to Modify**:
- `.agents/tools/workflow/cli.ts` (pass password to all calls)

**Changes to cli.ts**:

1. Update Config interface (same as runner):
```typescript
interface Config {
  convexUrl: string;
  namespace: string;
  password: string;  // ADD
  timeoutMs: number;
  ...
}
```

2. Add password to all `client.query()` and `client.mutation()` calls:
```typescript
// ~30 call sites need updating
const result = await client.query(api.assignments.list, {
  namespaceId: nsId,
  status: status,
  password: config.password,  // ADD
});
```

**Success Criteria**:
- [ ] CLI reads password from config.json
- [ ] All Convex calls include password
- [ ] All CLI commands work with correct password
- [ ] CLI shows clear error message with wrong/missing password

---

### WP-6: Integration Testing + Vercel Deployment Validation

**Scope**: End-to-end validation of password protection

**Test Scenarios**:

1. **Unauthorized Access Tests** (should all fail):
   - Call Convex function without password
   - Call Convex function with wrong password
   - Access UI without logging in (should redirect to login)
   - Runner with wrong password in config

2. **Authorized Access Tests** (should all pass):
   - UI login with correct password
   - UI making queries after login
   - UI making mutations after login
   - Runner processing jobs with correct password
   - CLI commands with correct password

3. **Vercel Build Validation**:
   - `vercel build --yes` must pass
   - Deployed UI shows login screen
   - Deployed UI works after login

**Success Criteria**:
- [ ] All unauthorized access attempts return "Unauthorized"
- [ ] All authorized access works correctly
- [ ] `vercel build --yes` passes
- [ ] Deployed Vercel app functions correctly with password protection

---

## Assignment-Level Success Criteria

- [ ] **ADMIN_PASSWORD env var** set in Convex Dashboard
- [ ] **All Convex public functions** require password argument (57 functions)
- [ ] **Unauthorized calls** return "Unauthorized" error (not data)
- [ ] **UI shows login screen**, validates password before rendering
- [ ] **Runner** reads password from config.json, includes in all calls
- [ ] **CLI** reads password from config.json, includes in all calls
- [ ] **config.json** has password field (not committed - already in .gitignore)
- [ ] **Deployed UI on Vercel** works with password protection

## Ambiguities / Questions

1. **Password validation query**: Should we create a dedicated lightweight `auth.validatePassword` query, or reuse `namespaces.list` for validation?
   - **Recommendation**: Create a dedicated `auth.validate` query that just checks password and returns `{ valid: true }`. This is cleaner and faster.

2. **Logout functionality**: Should the UI have a logout button that clears sessionStorage?
   - **Recommendation**: Yes, add a simple logout icon in the header that calls `sessionStorage.removeItem('adminPassword')` and refreshes.

3. **Error message specificity**: Should "Unauthorized" errors distinguish between missing password vs wrong password?
   - **Recommendation**: No - always return generic "Unauthorized" to avoid information leakage.

## Recommended Job Sequence

1. **WP-1** (Convex auth helper) - Foundation, no dependencies
2. **WP-2** (Convex function protection) - Depends on WP-1
3. **WP-3, WP-4, WP-5** (UI, Runner, CLI) - Can run in PARALLEL after WP-2
4. **WP-6** (Integration testing) - Final validation after all others

**Parallelization Opportunity**: WP-3, WP-4, and WP-5 are completely independent and can be assigned to different agents simultaneously after WP-2 completes.

---

## Step-by-Step Implementation Order (Manual Execution)

**CRITICAL**: This implementation must be done when NO agents are running. The password wall will break all existing connections immediately.

### Phase A: Pre-Flight (Before Starting)

1. **Stop the runner**
   ```bash
   # Find and kill any running runner processes
   pkill -f "runner.ts"
   ```

2. **Set ADMIN_PASSWORD in Convex Dashboard**
   - Go to: https://dashboard.convex.dev
   - Navigate to your deployment → Settings → Environment Variables
   - Add: `ADMIN_PASSWORD` = `<your-secure-password>`
   - Generate a secure password (min 16 chars, mix of letters/numbers/symbols)

3. **Update local config.json with password**
   ```bash
   # Edit .agents/tools/workflow/config.json
   # Add "password": "<same-password-as-above>"
   ```

### Phase B: Convex Backend (Deploy Once, Breaks Everything)

4. **Create auth.ts helper**
   ```bash
   # Create workflow-engine/convex/auth.ts
   ```

5. **Update ALL Convex functions** (57 functions across 7 files)
   - Add `password: v.string()` to args
   - Call `requirePassword(args)` as first line

6. **Deploy to Convex**
   ```bash
   cd workflow-engine
   npx convex deploy
   ```

   **⚠️ AT THIS POINT**: All existing UI sessions, Runner, and CLI will fail with "Unauthorized"

### Phase C: Client Updates (Can Do In Any Order)

7. **Update Runner** (`.agents/tools/workflow/runner.ts`)
   - Add password to Config interface
   - Pass `password: config.password` to all ~20 Convex calls

8. **Update CLI** (`.agents/tools/workflow/cli.ts`)
   - Add password to Config interface
   - Pass `password: config.password` to all ~30 Convex calls

9. **Update UI** (`workflow-engine/ui/`)
   - Create auth components
   - Modify useConvex hooks to inject password
   - Add LoginGate wrapper to main.js

### Phase D: Verification

10. **Test CLI commands**
    ```bash
    npx tsx .agents/tools/workflow/cli.ts queue
    # Should return queue status, not "Unauthorized"
    ```

11. **Start Runner**
    ```bash
    npx tsx .agents/tools/workflow/runner.ts
    # Should connect successfully
    ```

12. **Test UI**
    ```bash
    cd workflow-engine/ui
    npx vite --port 5173
    # Open browser, should see login form
    # Login with password, should see namespace list
    ```

---

## Verification Checklist

### Backend Verification

- [ ] `ADMIN_PASSWORD` environment variable is set in Convex Dashboard
- [ ] `requirePassword()` helper exists in `convex/auth.ts`
- [ ] All 57 Convex functions have `password: v.string()` in args
- [ ] All 57 Convex functions call `requirePassword(args)` first
- [ ] `npx convex deploy` succeeds without errors

### CLI/Runner Verification

- [ ] `config.json` has `"password"` field with correct value
- [ ] `config.example.json` has `"password"` field with placeholder
- [ ] CLI command `npx tsx cli.ts queue` works (returns data, not error)
- [ ] CLI command without password in config fails with "Unauthorized"
- [ ] Runner starts and connects successfully
- [ ] Runner processes jobs correctly

### UI Verification

- [ ] Opening UI without sessionStorage password shows login form
- [ ] Entering wrong password shows error message
- [ ] Entering correct password stores in sessionStorage and shows app
- [ ] All Convex queries work after login
- [ ] All Convex mutations work after login
- [ ] Page refresh maintains logged-in state
- [ ] Logout button (if implemented) clears sessionStorage

### Security Verification

- [ ] Direct Convex query without password returns "Unauthorized"
- [ ] Direct Convex query with wrong password returns "Unauthorized"
- [ ] Error messages don't reveal whether password is missing vs wrong
- [ ] Password not visible in browser network tab (obfuscated in args)
- [ ] Password not logged to console

### Deployment Verification

- [ ] `vercel build --yes` passes
- [ ] Deployed UI shows login form
- [ ] Deployed UI works after login
- [ ] Deployed UI maintains session across page refreshes

---

## Runner Call Sites Requiring Password (19 calls)

Line numbers in `.agents/tools/workflow/runner.ts`:

| Line | Function | API Call |
|------|----------|----------|
| 290 | saveChatResponse | `api.chatMessages.add` |
| 304 | saveSessionId | `api.chatThreads.updateSessionId` |
| 320 | saveLastPromptMode | `api.chatThreads.updateLastPromptMode` |
| 344 | triggerGuardianEvaluation | `api.chatThreads.getGuardianThread` |
| 357 | triggerGuardianEvaluation | `api.chatMessages.add` |
| 369 | triggerGuardianEvaluation | `api.chatJobs.trigger` |
| 429 | executeJob | `api.jobs.start` |
| 464 | executeJob (flushMetrics) | `api.jobs.updateMetrics` |
| 510 | executeJob (onComplete) | `api.jobs.complete` |
| 536 | executeJob (onFail) | `api.jobs.fail` |
| 555 | executeJob (onTimeout) | `api.jobs.fail` |
| 585 | handleGroupCompletion | `api.jobs.getGroupWithJobs` |
| 630 | checkAndCompleteAssignment | `api.jobs.listGroups` |
| 642 | checkAndCompleteAssignment | `api.assignments.complete` |
| 660 | triggerPMGroup | `api.jobs.insertGroupAfter` |
| 703 | processQueue | `api.assignments.get` |
| 746 | executeChatJob | `api.chatJobs.start` |
| 781 | executeChatJob (flushMetrics) | `api.chatJobs.updateMetrics` |
| 819 | executeChatJob (onComplete) | `api.chatJobs.complete` |
| 849 | executeChatJob (onFail) | `api.chatJobs.fail` |
| 869 | executeChatJob (onTimeout) | `api.chatJobs.fail` |
| 907 | startRunner | `api.namespaces.getByName` |
| 929 | startRunner (subscription) | `api.scheduler.getReadyJobs` |
| 946 | startRunner (subscription) | `api.scheduler.getReadyChatJobs` |

## CLI Call Sites Requiring Password (32 calls)

Line numbers in `.agents/tools/workflow/cli.ts`:

| Line | Function | API Call |
|------|----------|----------|
| 107 | getNamespaceId | `api.namespaces.getByName` |
| 157 | listAssignments | `api.assignments.list` |
| 165 | getAssignment | `api.assignments.getWithGroups` |
| 178 | listGroups | `api.jobs.listGroups` |
| 186 | getGroup | `api.jobs.getGroupWithJobs` |
| 199 | listJobs | `api.jobs.list` |
| 207 | getJob | `api.jobs.getWithGroup` |
| 216 | getQueueStatus | `api.scheduler.getQueueStatus` |
| 229 | createAssignment | `api.assignments.create` |
| 239 | createAssignment | `api.chatThreads.linkAssignment` |
| 252 | findTailGroup | `api.assignments.get` |
| 262 | findTailGroup | `api.jobs.getGroup` |
| 351 | insertJobs | `api.jobs.insertGroupAfter` |
| 357 | insertJobs | `api.jobs.createGroup` |
| 393 | updateAssignment | `api.assignments.update` |
| 403 | completeAssignment | `api.assignments.complete` |
| 410 | blockAssignment | `api.assignments.block` |
| 418 | unblockAssignment | `api.assignments.unblock` |
| 425 | deleteAssignment | `api.assignments.remove` |
| 432 | startJob | `api.jobs.start` |
| 439 | completeJob | `api.jobs.complete` |
| 447 | failJob | `api.jobs.fail` |
| 458 | listChatThreads | `api.chatThreads.list` |
| 465 | getChatThread | `api.chatThreads.get` |
| 470 | getChatThread | `api.chatMessages.list` |
| 479 | createChatThread | `api.chatThreads.create` |
| 498 | changeChatMode | `api.chatThreads.enableGuardianMode` |
| 506 | changeChatMode | `api.chatThreads.updateMode` |
| 514 | updateChatTitle | `api.chatThreads.updateTitle` |
| 523 | sendChatMessage | `api.chatThreads.get` |
| 529 | sendChatMessage | `api.chatMessages.add` |
| 537 | sendChatMessage | `api.chatJobs.trigger` |

---

## Risk Mitigation

### If Something Goes Wrong

**Scenario 1: Deployed Convex but forgot to update clients**
- All clients will show "Unauthorized" errors
- **Fix**: Update clients with password immediately
- **Alternative**: Temporarily remove `requirePassword()` calls and redeploy (insecure)

**Scenario 2: Wrong password in config vs Convex Dashboard**
- All API calls will fail
- **Fix**: Verify password matches exactly (case-sensitive, no trailing whitespace)

**Scenario 3: Runner crashes mid-job after password update**
- Jobs may be stuck in "running" state
- **Fix**: Use CLI to manually fail/complete stuck jobs after runner is fixed

### Rollback Plan

If the password wall causes unfixable issues:

1. Remove `requirePassword(args)` calls from all Convex functions
2. Remove `password: v.string()` from args validators
3. Redeploy: `npx convex deploy`
4. This returns system to unprotected state

**Note**: This is a security regression and should only be temporary while debugging.
