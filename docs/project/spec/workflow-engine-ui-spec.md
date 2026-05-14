# Workflow Engine UI Specification

> Browser-based CC3 operations terminal for workflow management, chat, assignment monitoring, and reflection introspection.

**Version:** 2.0
**Last Updated:** 2026-05-14
**Status:** Active

**Why-layer authority:** The UI exists to serve the operating model in [`mental-model.md`](mental-model.md). That file is authoritative for intent, vocabulary, and product philosophy. This spec documents the live UI implementation and should not override the mental model.

---

## Overview

The Workflow Engine UI is the single-page control terminal for Claude Comms III. It renders a cross-namespace chat and assignment operations center, protects access with the password wall, subscribes to Convex for live state, and provides the reflection introspection dashboard for V2 reflection telemetry.

The live app is a React 18 app delivered without a bundler: modules load directly in the browser through an import map, and components are authored with `React.createElement` rather than JSX.

## Technology Stack

| Area | Live implementation |
|---|---|
| Runtime | Static ESM browser app served from `workflow-engine/ui/` |
| UI framework | React 18.2 via ESM/importmap, rendered with `createRoot`; component code uses `React.createElement` |
| Styling | `styles.css` Q palette/T token system plus Tailwind CDN utilities |
| Data | Convex browser client via ESM (`convex@1.17.4/browser`), string API refs in `js/api.js` |
| Markdown | `marked@15.0.4` |
| Sanitization | `DOMPurify@3.2.4` |
| Auth | Password wall via `LoginGate`, `PasswordContext`, and auto-injected `password` args |
| PWA | `manifest.json`, app icons, service worker registration at `/sw.js` |
| Static server | `workflow-engine/ui/package.json` runs `npx serve -l 3000` |

`index.html` owns the import map, Tailwind CDN config, Google Fonts, PWA manifest link, module bootstrap, and service worker registration. The PWA service worker caches local static assets under cache `cc3-v2` and leaves Convex plus `esm.sh` requests network-only.

## Component Architecture

The live component tree under `workflow-engine/ui/js/components/` is:

```text
components/
├── auth/
│   ├── index.js
│   ├── LoginForm.js
│   ├── LoginGate.js
│   └── PasswordContext.js
├── chat/
│   ├── AssignmentPane.js
│   ├── ChatHeader.js
│   ├── ChatInput.js
│   ├── ChatPanel.js
│   ├── ChatSidebar.js
│   ├── ChatView.js
│   ├── index.js
│   ├── MessageBubble.js
│   ├── MessageList.js
│   ├── ModeToggle.js
│   ├── ThreadItem.js
│   └── ThreadList.js
├── effects/
│   └── index.js
├── introspection/
│   ├── index.js
│   └── IntrospectionDashboard.js
├── job/
│   ├── index.js
│   ├── JobCard.js
│   ├── JobChain.js
│   └── JobDetail.js
├── namespace/
│   ├── index.js
│   ├── NamespaceCard.js
│   ├── NamespaceHeader.js
│   ├── NamespaceList.js
│   └── NamespaceSettings.js
└── shared/
    ├── ConfirmDialog.js
    ├── EmptyState.js
    ├── ErrorBoundary.js
    ├── index.js
    ├── JsonViewer.js
    ├── LoadingSkeleton.js
    ├── QIcon.js
    ├── StatusBadge.js
    └── Timestamp.js
```

Full file inventory for spot checks:

```text
workflow-engine/ui/js/components/auth/index.js
workflow-engine/ui/js/components/auth/LoginForm.js
workflow-engine/ui/js/components/auth/LoginGate.js
workflow-engine/ui/js/components/auth/PasswordContext.js
workflow-engine/ui/js/components/chat/AssignmentPane.js
workflow-engine/ui/js/components/chat/ChatHeader.js
workflow-engine/ui/js/components/chat/ChatInput.js
workflow-engine/ui/js/components/chat/ChatPanel.js
workflow-engine/ui/js/components/chat/ChatSidebar.js
workflow-engine/ui/js/components/chat/ChatView.js
workflow-engine/ui/js/components/chat/index.js
workflow-engine/ui/js/components/chat/MessageBubble.js
workflow-engine/ui/js/components/chat/MessageList.js
workflow-engine/ui/js/components/chat/ModeToggle.js
workflow-engine/ui/js/components/chat/ThreadItem.js
workflow-engine/ui/js/components/chat/ThreadList.js
workflow-engine/ui/js/components/effects/index.js
workflow-engine/ui/js/components/introspection/index.js
workflow-engine/ui/js/components/introspection/IntrospectionDashboard.js
workflow-engine/ui/js/components/job/index.js
workflow-engine/ui/js/components/job/JobCard.js
workflow-engine/ui/js/components/job/JobChain.js
workflow-engine/ui/js/components/job/JobDetail.js
workflow-engine/ui/js/components/namespace/index.js
workflow-engine/ui/js/components/namespace/NamespaceCard.js
workflow-engine/ui/js/components/namespace/NamespaceHeader.js
workflow-engine/ui/js/components/namespace/NamespaceList.js
workflow-engine/ui/js/components/namespace/NamespaceSettings.js
workflow-engine/ui/js/components/shared/ConfirmDialog.js
workflow-engine/ui/js/components/shared/EmptyState.js
workflow-engine/ui/js/components/shared/ErrorBoundary.js
workflow-engine/ui/js/components/shared/index.js
workflow-engine/ui/js/components/shared/JsonViewer.js
workflow-engine/ui/js/components/shared/LoadingSkeleton.js
workflow-engine/ui/js/components/shared/QIcon.js
workflow-engine/ui/js/components/shared/StatusBadge.js
workflow-engine/ui/js/components/shared/Timestamp.js
```

Top-level composition:

| File | Role |
|---|---|
| `js/main.js` | App shell, responsive mode detection, view switching between threads and introspection, mobile back handling |
| `js/api.js` | String-based Convex API reference map used by UI hooks |
| `js/hooks/useConvex.js` | Convex provider, live query hook, mutation hook, password injection |
| `js/hooks/useNamespaceSettings.js` | Namespace harness/model config reader and writer |
| `components/auth/` | Password wall and credential context |
| `components/chat/` | Cross-namespace thread list, chat, mode toggle, assignment pane |
| `components/job/` | AgentHUD job chain, job cards, job detail modal, kill/retry affordances |
| `components/introspection/` | V2 reflection analytics dashboard |
| `components/namespace/` | Legacy namespace display pieces plus current harness config modal |
| `components/effects/` | Grain overlay and scanline sweep |
| `components/shared/` | Reusable status, timestamp, JSON, loading, icon, empty/error/confirm utilities |

`NamespaceList`, `NamespaceCard`, and `NamespaceHeader` still exist in the component tree, but the live app shell no longer uses a separate namespace drawer for primary navigation. Namespace filtering is handled inside the thread sidebar.

## App Shell

`App` wraps the app in this order:

1. `LoginGate`
2. `ErrorBoundary`
3. `ConfirmDialogProvider`
4. fixed-height Q palette root
5. `GrainOverlay`
6. `ScanlineSweep`
7. `AppLayout`

`AppLayout` subscribes to `api.namespaces.list`, keeps `activeView` as either `threads` or `introspection`, and renders:

- `ChatPanel` for the default operations center
- `IntrospectionDashboard` when the reflection dashboard is open

## Phase 15 UI Surfaces

1. **Password wall:** `LoginGate` shows `LoginForm` until both Convex URL and admin password are present. It validates by calling `namespaces:list` with the supplied password using `ConvexHttpClient`, then persists `convexUrl` and `adminPassword` in localStorage. `useQuery` and `useMutation` inject the password into every Convex call. See [`password-wall.md`](password-wall.md).

2. **All-namespace thread list:** `ChatPanel` calls `api.chatThreads.listAll` with a paged `limit` starting at 50. Threads are sorted server-side by `latestMessageAt` with `updatedAt` fallback. The namespace filter accordion is secondary; zero selected namespaces means all namespaces.

3. **Namespace badges and unread indicators:** `ThreadItem` displays a namespace badge for mixed-namespace context. It shows a torch fullbright unread dot when `latestMessageAt` is newer than `thread.lastReadAt`. `ChatPanel` calls `chatThreads.markRead` when a thread is selected and when messages render.

4. **Jam/cook/guardian mode toggle:** `ModeToggle` renders runic tabs with Q icons: jam/eye, cook/axe, guardian/armor. Guardian is disabled until the thread has a linked assignment. `ChatHeader` and `MobileChatHeader` both use the same mode toggle behavior.

5. **AgentHUD job cards:** `JobChain` renders AgentHUD-style job nodes with provider logos, status runes, HP duration bars, ARM idle bars, retry countdown bars for `awaiting_retry`, FRAGS tool-call counts, DMG token counts, and FIENDS/subagent rollups. Provider logo assets live under `workflow-engine/ui/public/`.

6. **Kill button:** `JobDetail` shows `Kill Agent` for running jobs that do not already have `killRequested`. The button calls `api.jobs.requestKill`. Chat jobs can also be interrupted from `ChatInput`; the stop button calls `api.chatJobs.requestKill` and then shows the pending kill state.

7. **Draft persistence:** `ChatPanel` stores per-thread drafts in an in-memory `Map` and mirrors them to localStorage under `workflow-engine:draft:<threadId>` with a 500 ms debounce. Drafts are cleared after successful send.

8. **Assignment pane PM nudge and north-star surface:** `AssignmentPane` shows the current assignment, editable status, collapsible north star text, job chain, artifacts, decisions, and a PM Nudge editor. The nudge writes through `assignments.update({ pmNudge })`. North-star amendments are reflected when the assignment `northStar` has been appended by the authorized workflow path; the UI displays the resulting north star but does not author amendments directly. See [`mental-model.md`](mental-model.md#mid-flight-assignment-modification).

9. **`assignmentsCreated` history:** If `thread.assignmentsCreated` contains more than one assignment, `AssignmentPane` shows previous/next navigation and calls `chatThreads.updateFocusAssignment` to move the thread focus pointer.

10. **Introspection dashboard with V2 reflections:** `IntrospectionDashboard` is the V2 hard-cutover dashboard. It calls `api.reflectionsV2.coverageRate`, `api.reflectionsV2.recent`, and `api.reflectionsV2.gaps`, then renders coverage health, gap reasons, job-type attention, rubric heatmaps, run-shape scatter, theme cloud, reflection stream, and a detail drawer. See [`reflection-feedback-spec.md`](reflection-feedback-spec.md).

11. **NamespaceSettings harness/model config:** The settings gear in the namespace filter opens `NamespaceSettings`. It reads `namespaces.getHarnessDefaults`, edits per-job-type harness/model entries, supports fan-out arrays, can add custom job types, saves the active namespace, and can "Save All" across all namespace IDs passed from `ChatPanel`. See [`harness-model-config-spec.md`](harness-model-config-spec.md).

12. **Q palette and effects:** `styles.css` defines the Q palette, T tokens, font stack, copper textures, riveted panels, fullbright dots, Q buttons, markdown styling, and responsive layout rules. `QIcon.js` ports the brandkit icon system into React.createElement components. `GrainOverlay` renders a canvas grain layer and `ScanlineSweep` renders the ambient scanline. The source aesthetic pointer is [`../guides/styleguide/brandkit.jsx`](../guides/styleguide/brandkit.jsx).

13. **Responsive breakpoints:** `main.js` classifies widths as mobile `< 768`, tablet `< 1024`, laptop `< 1440`, and desktop otherwise. CSS has matching mobile drawer rules at `max-width: 767px`, tablet rules at `768px..1024px`, desktop spacious rules at `min-width: 1441px`, plus introspection compaction at `1320px` and `920px`.

14. **Mobile back-button and drawer behavior:** On mobile, `AppLayout` pushes a history entry and intercepts `popstate`. If introspection is active, back returns to threads; otherwise it increments `mobileBackTrigger`, and `ChatPanel` closes the thread drawer and assignment pane. The thread pane is a left drawer with overlay, and the assignment pane is a full-width right drawer.

## Chat and Assignment Flow

The default screen is the operations center, not a landing page. The left pane is the all-namespace conversation list, the center is the selected chat, and the right pane is assignment detail when the selected thread has an assignment.

Message flow:

1. User sends a message through `ChatInput`.
2. `ChatPanel` inserts the user message through `chatMessages.add`.
3. `ChatPanel` triggers a chat job through `chatJobs.trigger`.
4. The runner writes assistant or PM messages back to Convex.
5. `MessageList` updates through the live `chatMessages.list` subscription.

Message rendering uses `marked` plus `DOMPurify`. Roles are styled as:

| Role | UI treatment |
|---|---|
| `user` | Right-aligned copper gradient bubble |
| `assistant` | Quartermaster label, teleport avatar, stone bubble |
| `pm` | Dispatch label, torch accent, distinct left border |

Guardian semantics are described in [`guardian-mode-spec.md`](guardian-mode-spec.md), with the current UI showing mode, PM messages, assignment status, and alignment status. Guardian session routing is a backend/runner concern surfaced through thread mode and assignment context.

## Real-Time Convex Usage

All live query and mutation hooks auto-inject the password from `PasswordContext`. Passing `null` as the query name disables a subscription until the selected object exists.

### Live Queries

| UI location | Query | Args | Purpose |
|---|---|---|---|
| `main.js` | `api.namespaces.list` | `{}` | Namespace list for filters/settings and introspection namespace selector |
| `ChatPanel` | `api.chatThreads.listAll` | `{ limit }` | Cross-namespace thread list |
| `ChatPanel` | `api.assignments.get` | `{ id: selectedThread.assignmentId }` | Selected assignment header/pane state |
| `ChatPanel` | `api.chatMessages.list` | `{ threadId }` | Selected thread messages |
| `ChatPanel` | `api.chatJobs.getActiveForThread` | `{ threadId }` | Typing/processing indicator and chat stop affordance |
| `ThreadList` / `ThreadItem` | `api.assignments.get` | `{ id: thread.assignmentId }` | Per-thread assignment status and alignment badges |
| `AssignmentPane` | `api.assignments.getChainWithTerminalJobs` | `{ id: assignmentId }` | Archive tier: chain structure plus terminal job data |
| `AssignmentPane` | `api.jobs.getActiveGroupsWithJobs` | `{ assignmentId }` | Live tier: active group jobs only |
| `NamespaceSettings` | `api.namespaces.getHarnessDefaults` | `{ namespaceId }` | Current harness/model defaults for editing |
| `IntrospectionDashboard` | `api.reflectionsV2.coverageRate` | `{ namespaceId, last, harness? }` | Reflection coverage denominator and by-harness health |
| `IntrospectionDashboard` | `api.reflectionsV2.recent` | portfolio and filtered args | Recent V2 reflection rows for analytics and drilldowns |
| `IntrospectionDashboard` | `api.reflectionsV2.gaps` | portfolio args | Missing-reflection gap rows |

The assignment pane follows the subscription discipline in [`convex-bandwidth-optimization.md`](convex-bandwidth-optimization.md): terminal data comes from an archive-style query, while mutable running data comes from the narrow active-group query.

### Mutations and Actions Initiated by UI

| UI action | Mutation |
|---|---|
| Create conversation | `chatThreads.create` |
| Rename conversation | `chatThreads.updateTitle` |
| Delete conversation | `chatThreads.remove` |
| Switch jam/cook/guardian | `chatThreads.updateMode` |
| Mark selected thread read | `chatThreads.markRead` |
| Change focused assignment history item | `chatThreads.updateFocusAssignment` |
| Send chat message | `chatMessages.add` then `chatJobs.trigger` |
| Interrupt active chat job | `chatJobs.requestKill` |
| Edit assignment status or PM nudge | `assignments.update` |
| Kill running assignment job | `jobs.requestKill` |
| Retry a job group | `jobs.retryGroup` |
| Save harness/model defaults | `namespaces.updateHarnessDefaults` |

## Visual System

The UI implements the Quake-inspired flavor described in [`mental-model.md`](mental-model.md#the-quake-aesthetic-philosophy). `styles.css` is the live token file:

- Q palette: void, stone, copper, torch, lava, slime, teleport, bone, iron
- T tokens: zero radius, 4 px spacing grid, typography, animation, effects, buttons, bars
- Fonts: Silkscreen for display, IBM Plex Mono for console, Chakra Petch for body
- Surfaces: copper textures, riveted panels, stone/void backgrounds
- Signals: fullbright dots, status runes, glow utilities
- Effects: grain overlay, scanline sweep, torch flicker, fullbright pulse

Animations and overlays respect `prefers-reduced-motion`. Grain and scanline are hidden on mobile for performance.

## PWA and Static Assets

`manifest.json` declares:

- `name`: Claude Comms III
- `short_name`: CC3
- `display`: standalone
- `start_url`: `/`
- app icons at `/public/icon-192.png` and `/public/icon-512.png`
- maskable icon using the 512 px asset

`sw.js` caches `/`, `/index.html`, `/styles.css`, `/manifest.json`, and core app icons. It intentionally does not cache Convex or `esm.sh` requests.

## Development

Run the UI through the local static server. Do not open `index.html` directly; service worker, manifest behavior, and root-relative assets expect a server.

```bash
cd workflow-engine/ui && nohup npm start > /tmp/ui-server.log 2>&1 &
```

The UI serves on port `3000`.

Convex must be available separately, and the user must provide the Convex deployment URL plus admin password in the login form. The URL and password are stored in localStorage by the live UI.

## Related Specs

- [`mental-model.md`](mental-model.md) - why-layer authority and UI mental model
- [`password-wall.md`](password-wall.md) - single-user password wall design
- [`harness-model-config-spec.md`](harness-model-config-spec.md) - namespace harness/model semantics
- [`reflection-feedback-spec.md`](reflection-feedback-spec.md) - reflection feedback loop and V2 context
- [`guardian-mode-spec.md`](guardian-mode-spec.md) - guardian mode semantics
- [`convex-bandwidth-optimization.md`](convex-bandwidth-optimization.md) - subscription decomposition discipline
- [`../guides/styleguide/brandkit.jsx`](../guides/styleguide/brandkit.jsx) - source brandkit flavor pointer
