# Workflow Engine UI Specification

> Browser-based interface for workflow management and chat

**Version:** 1.0
**Last Updated:** 2026-02-02
**Status:** Active

---

## Overview

The Workflow Engine UI is a vanilla JavaScript application that provides:
- Namespace management and selection
- Chat interface for PO/PM communication
- Thread management with mode switching (jam/cook/guardian)
- Assignment visibility and status tracking
- Job chain visualization

### Technology Stack

- **Frontend:** Vanilla JavaScript, HTML, CSS
- **Backend:** Convex (real-time subscriptions)
- **No build step:** Direct browser execution

---

## Component Architecture

```
workflow-engine/ui/
├── index.html           # Entry point
├── styles.css           # Global styles
└── js/
    ├── main.js          # Application bootstrap
    ├── api.js           # Convex client wrapper
    ├── config.js        # Configuration
    ├── hooks/
    │   └── useConvex.js # Reactive Convex bindings
    └── components/
        ├── namespace/   # Namespace selection
        ├── chat/        # Chat interface
        ├── job/         # Job visualization
        └── shared/      # Reusable components
```

---

## Views

### Namespace Selection

Path: `/` (default)

| Component | Purpose |
|-----------|---------|
| NamespaceList | Display all namespaces with stats |
| NamespaceCard | Individual namespace with counts |
| NamespaceHeader | Selected namespace info |

**Features:**
- Shows assignment counts by status (pending/active/blocked/complete)
- Click to select namespace
- Last activity timestamp

### Chat View

Path: `/?namespace=<id>&thread=<id>`

| Component | Purpose |
|-----------|---------|
| ChatSidebar | Thread list and creation |
| ThreadList | List of threads in namespace |
| ThreadItem | Individual thread preview |
| ChatPanel | Main chat area |
| ChatHeader | Thread title and mode |
| ModeToggle | Switch between jam/cook/guardian |
| MessageList | Conversation history |
| MessageBubble | Individual message |
| ChatInput | Message composition |
| AssignmentPane | Linked assignment details |

**Features:**
- Thread list with mode indicators
- Real-time message updates
- Mode switching with visual feedback
- Assignment status display (guardian mode)
- Alignment status indicators (🟢/🟠/🔴)

### Assignment Pane

Shows when thread has linked assignment:

| Field | Display |
|-------|---------|
| North Star | Assignment objective |
| Status | pending/active/blocked/complete |
| Alignment | aligned/uncertain/misaligned (guardian only) |
| Groups | Chain of job groups |
| Jobs | Individual job status per group |

---

## Message Roles

| Role | Visual Treatment |
|------|------------------|
| `user` | Right-aligned, user color |
| `assistant` | Left-aligned, assistant color |
| `pm` | Left-aligned, distinct PM style (system-like) |

---

## Mode Indicators

| Mode | Display |
|------|---------|
| `jam` | 💡 Jam (ideation) |
| `cook` | 🍳 Cook (autonomous) |
| `guardian` | 🛡️ Guardian (monitoring) |

---

## Real-Time Updates

The UI subscribes to Convex queries for real-time updates:

| Query | Purpose |
|-------|---------|
| `namespaces.list` | All namespaces with stats |
| `chatThreads.list` | Threads in namespace |
| `chatMessages.list` | Messages in thread |
| `assignments.getWithGroups` | Assignment with job chain |
| `scheduler.watchQueue` | Active assignments and jobs |

---

## File Locations

| Component | Path |
|-----------|------|
| Entry Point | `workflow-engine/ui/index.html` |
| Styles | `workflow-engine/ui/styles.css` |
| Main App | `workflow-engine/ui/js/main.js` |
| API Client | `workflow-engine/ui/js/api.js` |
| Chat Components | `workflow-engine/ui/js/components/chat/` |
| Namespace Components | `workflow-engine/ui/js/components/namespace/` |
| Job Components | `workflow-engine/ui/js/components/job/` |
| Shared Components | `workflow-engine/ui/js/components/shared/` |

---

## Development

### Running Locally

```bash
cd workflow-engine
npx convex dev      # Start Convex dev server
# Open ui/index.html in browser (or use local server)
```

### Configuration

Edit `workflow-engine/ui/js/config.js`:

```javascript
export const config = {
  convexUrl: "https://your-deployment.convex.cloud",
};
```

---

## Pending Enhancements

1. **Assignment creation from UI** - Currently CLI-only
2. **Job result viewing** - Show full job output
3. **Guardian mode actions** - Block/unblock from UI
4. **Responsive design** - Mobile support
