# Workflow Engine UI Rebuild - Implementation Plan

## Executive Summary

Transform the single-file workflow-engine UI into a proper multi-file React application with:
- Config-based Convex URL (no URL params)
- Multi-namespace support with hierarchical navigation
- Component-based architecture with proper separation of concerns
- Modern visual design with collapsible sections

---

## Current State Analysis

### Existing Implementation (`workflow-engine/ui/index.html`)
- **~500 lines** of inline React in a single HTML file
- Uses `React.createElement()` directly (no JSX)
- Relies on URL params (`convexUrl`, `namespace`) or localStorage
- Single-namespace view only
- Components are tightly coupled in one file
- Basic card layout without deep hierarchy visualization

### Data Model (from Convex schema)
**Assignments:**
- `namespace`, `northStar`, `status`, `blockedReason`, `independent`, `priority`
- `artifacts`, `decisions` (strings - likely JSON)
- `headJobId`, `createdAt`, `updatedAt`

**Jobs:**
- `assignmentId`, `jobType`, `harness` (claude/codex/gemini)
- `context`, `status`, `result` (strings - potentially large)
- `nextJobId` (linked list), `startedAt`, `completedAt`, `createdAt`

---

## Proposed Architecture

### File Structure
```
workflow-engine/ui/
├── index.html              # Shell HTML with imports
├── config.json             # Convex URL configuration
├── styles.css              # Global styles and animations
├── js/
│   ├── main.js             # Entry point, renders App
│   ├── config.js           # Config loader (reads config.json)
│   ├── api.js              # Convex API references and client setup
│   ├── hooks/
│   │   ├── useConvex.js    # Convex client hook
│   │   ├── useNamespaces.js    # Fetch all namespaces
│   │   └── useQueueData.js     # Queue subscription hook
│   └── components/
│       ├── App.js              # Root component, routing/layout
│       ├── layout/
│       │   ├── Header.js       # App header with connection status
│       │   ├── Sidebar.js      # Namespace navigation
│       │   └── MainContent.js  # Content area wrapper
│       ├── namespace/
│       │   ├── NamespaceList.js    # List all namespaces with stats
│       │   ├── NamespaceCard.js    # Individual namespace summary
│       │   └── NamespaceDetail.js  # Selected namespace view
│       ├── assignment/
│       │   ├── AssignmentList.js   # Assignments within namespace
│       │   ├── AssignmentCard.js   # Assignment summary card
│       │   └── AssignmentDetail.js # Expanded assignment with jobs
│       ├── job/
│       │   ├── JobChain.js         # Visual job chain
│       │   ├── JobCard.js          # Job summary
│       │   └── JobDetail.js        # Full job details modal/panel
│       └── shared/
│           ├── StatusBadge.js      # Status indicator
│           ├── ConnectionStatus.js # Connection indicator
│           ├── MetricCard.js       # Stats display
│           ├── Collapsible.js      # Expandable section
│           ├── JsonViewer.js       # Pretty-print JSON content
│           └── Timestamp.js        # Formatted timestamps
```

### Config File (`config.json`)
```json
{
  "convexUrl": "https://your-project.convex.cloud"
}
```

---

## Decisions Made

| Decision | Question | Resolution |
|----------|----------|------------|
| D1 | Status filter persistence | Per namespace, stored in component state |
| D2 | Complete assignments visibility | Show all with filter (users can hide complete) |
| D3 | Job detail display | Inline expansion with modal option for large content |
| D4 | Namespace list refresh | Polling every 30s |

---

## Visual Design Specifications

### Color Palette
- Background: `gray-900` (dark mode base)
- Surface: `gray-800` (cards), `gray-700` (hover)
- Border: `gray-700` default, status color on active
- Status colors:
  - pending: `yellow-500`
  - active: `blue-500`
  - blocked/failed: `red-500`
  - complete: `green-500`
  - running: `purple-500`

### Typography
- Headers: Bold, larger text, `text-white`
- Labels: `text-gray-400`, smaller
- Values: `text-white` or status color
- Truncation with tooltip for long text

### Layout
- Sidebar: 256px fixed width, scrollable namespace list
- Header: 64px height, sticky
- Content: max-width 1280px, centered, responsive grid
- Card spacing: 16px gap
- Border radius: `rounded-lg` (8px)

### Visual Hierarchy Pattern
```
┌─────────────────────────────────────────────┐
│ HEADER: Title | Connection Status | Config  │
├───────────┬─────────────────────────────────┤
│ SIDEBAR   │ MAIN CONTENT                    │
│           │                                 │
│ Namespace │  ┌──────────────────────────┐   │
│ - ns1     │  │ QUEUE METRICS (5 cards)  │   │
│ - ns2     │  └──────────────────────────┘   │
│ - ns3 *   │                                 │
│           │  ┌──────────────────────────┐   │
│           │  │ ASSIGNMENT CARD          │   │
│           │  │  ├─ Status | Priority    │   │
│           │  │  ├─ NorthStar text       │   │
│           │  │  └─ JOB CHAIN            │   │
│           │  │       [●]─[●]─[○]─[○]    │   │
│           │  └──────────────────────────┘   │
│           │                                 │
│           │  ┌──────────────────────────┐   │
│           │  │ ASSIGNMENT CARD...       │   │
│           │  └──────────────────────────┘   │
└───────────┴─────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation
| Task | Description | Dependencies |
|------|-------------|--------------|
| 1.1 | Create file structure and `config.json` | None |
| 1.2 | Create `config.js` to load config | 1.1 |
| 1.3 | Create `api.js` with Convex references | 1.1 |
| 1.4 | Create `styles.css` with animations | 1.1 |
| 1.5 | Update `index.html` as shell | 1.1-1.4 |

### Phase 2: Core Hooks & Shared Components
| Task | Description | Dependencies |
|------|-------------|--------------|
| 2.1 | Create `useConvex.js` hook | 1.3 |
| 2.2 | Create shared components: StatusBadge, ConnectionStatus, MetricCard | 1.4 |
| 2.3 | Create Collapsible and JsonViewer | 1.4 |
| 2.4 | Create Timestamp component | None |

### Phase 3: Backend Addition
| Task | Description | Dependencies |
|------|-------------|--------------|
| 3.1 | Add `getAllNamespaces` query to `scheduler.ts` | None |

### Phase 4: Layout Components
| Task | Description | Dependencies |
|------|-------------|--------------|
| 4.1 | Create Header component | 2.2 |
| 4.2 | Create Sidebar component | 2.1 |
| 4.3 | Create MainContent wrapper | None |
| 4.4 | Create App shell with routing | 4.1-4.3 |

### Phase 5: Namespace Components
| Task | Description | Dependencies |
|------|-------------|--------------|
| 5.1 | Create `useNamespaces.js` hook | 2.1, 3.1 |
| 5.2 | Create NamespaceCard | 2.2 |
| 5.3 | Create NamespaceList | 5.1, 5.2 |
| 5.4 | Create NamespaceDetail | 5.3 |

### Phase 6: Job Components
| Task | Description | Dependencies |
|------|-------------|--------------|
| 6.1 | Create JobCard | 2.2, 2.4 |
| 6.2 | Create JobDetail | 6.1, 2.3 |
| 6.3 | Create JobChain | 6.1 |

### Phase 7: Assignment Components
| Task | Description | Dependencies |
|------|-------------|--------------|
| 7.1 | Create `useQueueData.js` hook | 2.1 |
| 7.2 | Create AssignmentCard | 6.3, 2.2 |
| 7.3 | Create AssignmentDetail | 7.2, 2.3 |
| 7.4 | Create AssignmentList | 7.2, 7.1 |

### Phase 8: Integration
| Task | Description | Dependencies |
|------|-------------|--------------|
| 8.1 | Wire all components into App | 4-7 |
| 8.2 | Add main.js entry point | 8.1 |
| 8.3 | Test end-to-end | 8.2 |

### Phase 9: Polish
| Task | Description | Dependencies |
|------|-------------|--------------|
| 9.1 | Add keyboard navigation | 8.3 |
| 9.2 | Add loading states and error handling | 8.3 |
| 9.3 | Responsive design adjustments | 8.3 |

---

## New Convex Query Required

### `scheduler:getAllNamespaces`
```typescript
export const getAllNamespaces = query({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query("assignments").collect();
    const namespaceMap = new Map();

    for (const a of assignments) {
      if (!namespaceMap.has(a.namespace)) {
        namespaceMap.set(a.namespace, {
          name: a.namespace,
          counts: { pending: 0, active: 0, blocked: 0, complete: 0 },
          lastActivity: 0
        });
      }
      const ns = namespaceMap.get(a.namespace);
      ns.counts[a.status]++;
      ns.lastActivity = Math.max(ns.lastActivity, a.updatedAt);
    }

    return Array.from(namespaceMap.values());
  }
});
```

---

## Success Criteria

1. ✅ Config file (`config.json`) used instead of URL params
2. ✅ All namespaces visible and navigable
3. ✅ Component files are separate (not single HTML blob)
4. ✅ Clear visual hierarchy: Namespace → Assignment → Job
5. ✅ All entity properties displayed
6. ✅ Collapsible sections work for large content
7. ✅ Modern design with proper spacing/typography
8. ✅ Zero build step (ESM/CDN only)
9. ✅ Real-time updates for queue data still work
