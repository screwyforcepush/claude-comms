# Workflow Engine Frontend UI - Implementation Plan

**Phase ID:** 01-WorkflowUI
**North Star:** Build a frontend UI in workflow-engine/ directory that uses WebSocket to connect to Convex DB and visualizes assignments, jobs, their statuses, and the job execution flow in real-time

---

## Executive Summary

Create a minimal, self-contained frontend dashboard within the `workflow-engine/` directory that:
- Connects to Convex via WebSocket for real-time updates
- Displays assignments with status indicators (pending/active/blocked/complete)
- Shows job chains linked to each assignment
- Visualizes job execution flow as a timeline
- Requires minimal setup (single HTML file with inline dependencies)

---

## Technical Decisions

### Decision 1: Single HTML File vs React Setup

**Recommendation: Single HTML file with CDN dependencies**

| Option | Pros | Cons |
|--------|------|------|
| **Single HTML (Recommended)** | Zero build step, works immediately, easy to serve, self-contained | Limited component reuse, inline CSS/JS |
| React + Vite | Component architecture, better scaling | Requires build setup, npm install, more files |

**Rationale:** The requirement explicitly asks for "simple - single HTML file with inline JS/CSS or minimal React setup". Given the scope (dashboard display, no complex interactions), a single HTML file with Convex's browser client is ideal.

### Decision 2: Styling Approach

**Recommendation: Tailwind CSS via CDN + inline styles**

- Use Tailwind CDN for rapid styling
- No build step required
- Clean, responsive design out of the box

### Decision 3: Convex Client

**Recommendation: ConvexReactClient via CDN**

- Import from `https://esm.sh/convex/react`
- Use `useQuery` hooks for real-time subscriptions
- React 18 via CDN for rendering

---

## Architecture

```
workflow-engine/
├── convex/                    # Existing backend
│   ├── schema.ts
│   ├── assignments.ts
│   ├── jobs.ts
│   └── scheduler.ts
├── ui/                        # NEW: Frontend directory
│   └── index.html             # Self-contained dashboard
└── package.json
```

### Data Flow

```
Convex Cloud (WebSocket)
       │
       ▼
┌─────────────────────────────┐
│  scheduler.watchQueue()     │ ◀── Real-time subscription
│  scheduler.getQueueStatus() │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  React Components           │
│  - QueueStatus (metrics)    │
│  - AssignmentList           │
│  - AssignmentCard           │
│  - JobTimeline              │
│  - JobNode                  │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  HTML Dashboard             │
│  (single index.html)        │
└─────────────────────────────┘
```

---

## Work Packages

### WP1: Project Scaffolding
**Scope:** Create UI directory and base HTML structure

**Tasks:**
1. Create `workflow-engine/ui/` directory
2. Create `index.html` with:
   - HTML5 doctype and structure
   - CDN imports: React 18, ReactDOM, Tailwind CSS
   - Convex client from esm.sh
   - Basic page layout (header, main content area)
3. Add namespace configuration input (reads from URL param or localStorage)

**Files Modified:**
- `workflow-engine/ui/index.html` (new)

**Success Criteria:**
- Page loads without errors
- React renders successfully
- Tailwind styles apply correctly

---

### WP2: Convex Connection Layer
**Scope:** Establish WebSocket connection to Convex

**Tasks:**
1. Import ConvexReactClient from CDN
2. Create ConvexProvider wrapper component
3. Read Convex URL from:
   - URL parameter `?convexUrl=...`
   - Or prompt user on first load
   - Store in localStorage for persistence
4. Handle connection states (connecting, connected, error)
5. Display connection status indicator

**Dependencies:** WP1

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Successfully connects to Convex deployment
- Shows connection status
- Handles reconnection gracefully

---

### WP3: Queue Status Dashboard
**Scope:** Display aggregate queue metrics

**Tasks:**
1. Subscribe to `scheduler.getQueueStatus(namespace)`
2. Create status cards showing:
   - Total assignments
   - Pending / Active / Blocked / Complete counts
   - Running jobs count
3. Color-code status indicators:
   - Pending: gray
   - Active: blue
   - Blocked: red
   - Complete: green
4. Auto-refresh via Convex subscription

**Dependencies:** WP2

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Displays real-time queue metrics
- Updates automatically when data changes
- Clear visual hierarchy

---

### WP4: Assignment List View
**Scope:** Display all non-complete assignments

**Tasks:**
1. Subscribe to `scheduler.watchQueue(namespace)`
2. Create AssignmentCard component showing:
   - North star text (truncated with expand)
   - Status badge (pending/active/blocked)
   - Blocked reason (if blocked)
   - Priority indicator
   - Independent flag indicator
   - Created/updated timestamps
3. Sort assignments by: status (active first), then priority, then createdAt
4. Implement expand/collapse for long north star text

**Dependencies:** WP2

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Lists all active/pending/blocked assignments
- Shows key metadata clearly
- Real-time updates when status changes

---

### WP5: Job Chain Timeline
**Scope:** Visualize job execution flow within each assignment

**Tasks:**
1. For each assignment, render job chain as horizontal timeline
2. Create JobNode component showing:
   - Job type (plan, implement, refine, uat, verify, etc.)
   - Harness icon (Claude/Codex/Gemini)
   - Status indicator (pending/running/complete/failed)
   - Duration (if complete)
3. Connect nodes with arrows showing linked-list flow
4. Highlight currently running job with pulse animation
5. Show result preview on hover (tooltip)

**Dependencies:** WP4

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Visual timeline shows job sequence
- Running jobs are clearly indicated
- Complete jobs show duration
- Failed jobs show error state

---

### WP6: Job Detail Expansion
**Scope:** Expandable job details

**Tasks:**
1. Click on job node to expand details panel
2. Show full job details:
   - Context (PM instructions)
   - Result text (formatted)
   - Start/complete timestamps
   - Previous job result (for context chaining)
3. Syntax highlighting for code in results (optional, use Prism.js CDN)
4. Copy-to-clipboard for result text

**Dependencies:** WP5

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Expanding job shows full details
- Results are readable and formatted
- Code blocks are highlighted

---

### WP7: Real-time Updates & Polish
**Scope:** Ensure smooth real-time experience

**Tasks:**
1. Add visual feedback for real-time updates:
   - Flash animation when status changes
   - New assignment slides in
   - Completed assignment fades out
2. Add auto-scroll to active/running items
3. Add timestamp "last updated" indicator
4. Handle empty states (no assignments, no jobs)
5. Add favicon and page title with status
6. Add refresh button for manual reconnect

**Dependencies:** WP6

**Files Modified:**
- `workflow-engine/ui/index.html`

**Success Criteria:**
- Updates feel smooth and natural
- User knows when updates occur
- Empty states are handled gracefully

---

### WP8: Configuration & Documentation
**Scope:** Make the UI easy to configure and use

**Tasks:**
1. Add settings panel for:
   - Convex URL
   - Namespace
   - Theme (light/dark)
2. Persist settings in localStorage
3. Add README section to SPEC.md about UI usage
4. Add inline help/tooltip for first-time users

**Dependencies:** WP7

**Files Modified:**
- `workflow-engine/ui/index.html`
- `workflow-engine/SPEC.md`

**Success Criteria:**
- Easy to configure without editing code
- Settings persist across sessions
- Documentation explains how to use

---

## Ambiguities & Decisions Needed

### Question 1: Convex URL Source
**Options:**
1. Hardcode in HTML (simple but inflexible)
2. Read from environment variable (requires build step)
3. **URL param + localStorage (recommended)** - flexible, no build needed
4. Read from `config.json` (would need fetch on load)

**Recommendation:** Option 3 - URL param + localStorage

### Question 2: Complete Assignments Display
**Options:**
1. Hide complete assignments entirely
2. Show in separate "Completed" section (collapsed by default)
3. Show all but fade out complete ones

**Recommendation:** Option 2 - Separate collapsed section (matches `watchQueue` behavior which filters them)

### Question 3: Job Result Formatting
**Options:**
1. Plain text only
2. Markdown rendering (requires marked.js CDN)
3. **Syntax highlighting for code blocks (recommended)** - Prism.js CDN

**Recommendation:** Option 3 with Prism.js for code highlighting

---

## Job Sequence

```
Phase: 01-WorkflowUI

Job 1: implement (WP1 + WP2)
├── Scaffold project
├── Create index.html with CDN imports
└── Establish Convex connection

Job 2: implement (WP3 + WP4)
├── Queue status dashboard
└── Assignment list view

Job 3: implement (WP5 + WP6)
├── Job timeline visualization
└── Job detail expansion

Job 4: implement (WP7)
└── Real-time polish and animations

Job 5: refine
└── Code review and cleanup

Job 6: uat
└── Manual testing of all features

Job 7: verify
└── Final verification against north star
```

---

## Dependencies Graph

```
WP1 ──► WP2 ──► WP3 ──► WP7
              │
              └──► WP4 ──► WP5 ──► WP6 ──► WP7 ──► WP8
```

---

## Estimated Complexity

| Work Package | Complexity | Lines of Code |
|--------------|------------|---------------|
| WP1 | Low | ~50 |
| WP2 | Medium | ~80 |
| WP3 | Low | ~60 |
| WP4 | Medium | ~100 |
| WP5 | Medium-High | ~150 |
| WP6 | Medium | ~100 |
| WP7 | Low | ~50 |
| WP8 | Low | ~40 |
| **Total** | | **~630** |

---

## API Reference (for Implementation)

### Queries to Use

```typescript
// Real-time queue watch - main data feed
scheduler.watchQueue({ namespace: string })
// Returns: { assignment, jobs[], hasRunningJob, nextPendingJob }[]

// Queue metrics
scheduler.getQueueStatus({ namespace: string })
// Returns: { totalAssignments, pendingAssignments, activeAssignments,
//            blockedAssignments, completeAssignments, runningJobs,
//            hasActiveNonIndependent }
```

### Status Color Scheme

| Status | Color | Tailwind Class |
|--------|-------|----------------|
| pending | Gray | `bg-gray-100 text-gray-600` |
| active | Blue | `bg-blue-100 text-blue-700` |
| running | Blue (animated) | `bg-blue-500 text-white animate-pulse` |
| blocked | Red | `bg-red-100 text-red-700` |
| complete | Green | `bg-green-100 text-green-700` |
| failed | Red (solid) | `bg-red-500 text-white` |

### Job Type Icons

| Job Type | Emoji |
|----------|-------|
| plan | 📋 |
| implement | 🔨 |
| refine | ✨ |
| uat | 🧪 |
| verify | ✅ |
| research | 🔍 |
| pm | 👔 |
| retrospect | 📝 |

### Harness Icons

| Harness | Icon/Emoji |
|---------|------------|
| claude | 🟠 |
| codex | 🟢 |
| gemini | 🔵 |

---

## Success Criteria (Final)

1. **Connection:** Dashboard connects to Convex and displays real-time data
2. **Assignments:** All non-complete assignments visible with status, priority, and metadata
3. **Jobs:** Job chains visualized as timeline with status indicators
4. **Real-time:** Updates appear within seconds without manual refresh
5. **Usability:** Clear, intuitive interface with good visual hierarchy
6. **Self-contained:** Single HTML file, no build step required
7. **Configurable:** Convex URL and namespace configurable via UI

---

## Appendix: Convex Schema Reference

### assignments table
- `namespace`: string
- `northStar`: string
- `status`: "pending" | "active" | "blocked" | "complete"
- `blockedReason?`: string
- `independent`: boolean
- `priority`: number
- `artifacts`: string
- `decisions`: string
- `headJobId?`: Id<"jobs">
- `createdAt`: number
- `updatedAt`: number

### jobs table
- `assignmentId`: Id<"assignments">
- `jobType`: string
- `harness`: "claude" | "codex" | "gemini"
- `context?`: string
- `status`: "pending" | "running" | "complete" | "failed"
- `result?`: string
- `nextJobId?`: Id<"jobs">
- `startedAt?`: number
- `completedAt?`: number
- `createdAt`: number
