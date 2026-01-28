# Product Owner Chat - Architecture & Implementation Plan

## Executive Summary

This document details the architecture and implementation plan for the Product Owner Chat feature. The feature enables users to interact with an AI Product Owner through a chat interface with two modes:
- **Jam Mode**: Read-only ideation - helps spec out ideas, asks follow-up questions
- **Cook Mode**: Full autonomy - can create assignments and insert jobs into the workflow queue

## Part 1: Schema Design

### New Convex Tables

#### chatThreads
```typescript
// workflow-engine/convex/schema.ts
chatThreads: defineTable({
  namespace: v.string(),           // Links to namespace for scoping
  title: v.string(),               // User-editable thread title
  mode: v.union(
    v.literal("jam"),              // Read-only ideation mode
    v.literal("cook")              // Full autonomy mode
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_namespace", ["namespace"])
  .index("by_namespace_updated", ["namespace", "updatedAt"])
```

#### chatMessages
```typescript
chatMessages: defineTable({
  threadId: v.id("chatThreads"),   // Parent thread reference
  role: v.union(
    v.literal("user"),
    v.literal("assistant")
  ),
  content: v.string(),             // Message content (markdown supported)
  createdAt: v.number(),
})
  .index("by_thread", ["threadId"])
  .index("by_thread_created", ["threadId", "createdAt"])
```

### Design Decisions

1. **No assignmentId on thread**: The Product Owner is NOT tied to assignments - it CREATES them. This is different from PM which operates WITHIN an assignment context.

2. **namespace scoping**: Threads are scoped to namespace to maintain isolation and allow different projects to have separate chat histories.

3. **Simple mode toggle**: Binary jam/cook mode stored on thread, not per-message. Mode changes affect future interactions but history is preserved.

---

## Part 2: API Design

### Queries

```typescript
// workflow-engine/convex/chatThreads.ts

// Get all threads for a namespace (sorted by most recent)
export const list = query({
  args: { namespace: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_namespace_updated", q => q.eq("namespace", args.namespace))
      .order("desc")
      .collect();
  }
});

// Get single thread by ID
export const get = query({
  args: { id: v.id("chatThreads") },
  handler: async (ctx, args) => ctx.db.get(args.id)
});

// workflow-engine/convex/chatMessages.ts

// Get messages for a thread (chronological order)
export const list = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", q => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  }
});
```

### Mutations

```typescript
// workflow-engine/convex/chatThreads.ts

// Create a new thread
export const create = mutation({
  args: {
    namespace: v.string(),
    title: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("jam"), v.literal("cook")))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("chatThreads", {
      namespace: args.namespace,
      title: args.title || "New Chat",
      mode: args.mode || "jam",  // Default to safe mode
      createdAt: now,
      updatedAt: now,
    });
  }
});

// Update thread mode
export const updateMode = mutation({
  args: {
    id: v.id("chatThreads"),
    mode: v.union(v.literal("jam"), v.literal("cook"))
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      mode: args.mode,
      updatedAt: Date.now(),
    });
  }
});

// Update thread title
export const updateTitle = mutation({
  args: {
    id: v.id("chatThreads"),
    title: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  }
});

// workflow-engine/convex/chatMessages.ts

// Add message to thread
export const add = mutation({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string()
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update thread's updatedAt
    await ctx.db.patch(args.threadId, { updatedAt: now });

    return await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      createdAt: now,
    });
  }
});
```

---

## Part 3: UI Component Architecture

### Component Hierarchy

```
AppLayout
├── Sidebar (existing)
│   └── NamespaceList (existing)
│
├── MainContent (existing)
│   └── ... existing assignment views ...
│
└── ChatPanel (NEW) ─────────────────────────────
    ├── ChatSidebar
    │   ├── NewChatButton
    │   └── ThreadList
    │       └── ThreadItem (per thread)
    │
    └── ChatView
        ├── ChatHeader
        │   ├── ThreadTitle (editable)
        │   └── ModeToggle (Jam | Cook)
        │
        ├── MessageList
        │   └── MessageBubble (per message)
        │       └── (markdown rendering)
        │
        └── ChatInput
            ├── TextArea (auto-resize)
            └── SendButton
```

### New Components

| Component | File | Description |
|-----------|------|-------------|
| `ChatPanel` | `components/chat/ChatPanel.js` | Main container, manages chat state |
| `ChatSidebar` | `components/chat/ChatSidebar.js` | Thread list and new chat button |
| `ThreadList` | `components/chat/ThreadList.js` | Scrollable list of chat threads |
| `ThreadItem` | `components/chat/ThreadItem.js` | Single thread preview (title, timestamp) |
| `ChatView` | `components/chat/ChatView.js` | Main chat area for selected thread |
| `ChatHeader` | `components/chat/ChatHeader.js` | Title and mode toggle |
| `ModeToggle` | `components/chat/ModeToggle.js` | Binary segmented control (Jam/Cook) |
| `MessageList` | `components/chat/MessageList.js` | Scrollable message history |
| `MessageBubble` | `components/chat/MessageBubble.js` | Individual message with role styling |
| `ChatInput` | `components/chat/ChatInput.js` | Text input with send button |

### Navigation Integration

Add chat access to the existing UI via:
1. **Tab in main content area** - Add "Chat" tab alongside existing assignment views
2. **OR Floating button** - Chat icon in bottom-right that opens chat panel

**Recommended: Tab approach** - More integrated, better for sustained conversations

### State Management

The chat panel will use:
- `useQuery` hook for real-time subscription to threads and messages
- `useMutation` for creating threads/messages
- Local state for selected thread ID, input text, loading states

---

## Part 4: Runner Integration - Chat Job Type

### New Job Type: `chat`

The chat job is fundamentally different from other jobs:
- NOT tied to a specific assignment
- Receives the full chat thread context
- Mode determines what actions it can take

### Runner Changes

```typescript
// .agents/tools/workflow/runner.ts

// New interface for chat job context
interface ChatJobContext {
  threadId: string;
  namespace: string;
  mode: "jam" | "cook";
  messages: Array<{ role: string; content: string }>;
  latestUserMessage: string;
}

// Chat jobs bypass normal assignment-based scheduling
// They run immediately when created
```

### Chat-Specific Execution Path

1. **Triggering**: When user sends a message in UI
2. **Job Creation**: UI creates a `chat` job with thread context
3. **Execution**: Runner detects chat job and runs Product Owner agent
4. **Response**: Agent response is added as assistant message to thread

### Two Approaches for Chat Job Handling

**Option A: Pseudo-Assignment (Recommended)**
Create a special "chat-thread" assignment type that holds chat jobs. Each thread gets a hidden assignment. This reuses existing job infrastructure.

```typescript
// When creating a chat thread, also create a hidden assignment
const assignmentId = await client.mutation(api.assignments.create, {
  namespace,
  northStar: `Chat thread: ${threadId}`,
  independent: true,  // Chat doesn't block other work
  priority: 0,        // High priority for responsiveness
});

// Link thread to assignment
await client.mutation(api.chatThreads.update, {
  id: threadId,
  assignmentId,
});
```

**Option B: Direct Execution**
Chat jobs bypass the assignment system entirely. Runner has special handling for chat job type.

**Recommendation**: Option A - reuses existing infrastructure, maintains consistency, enables job history tracking per thread.

### Updated Schema (if using Option A)

```typescript
chatThreads: defineTable({
  namespace: v.string(),
  title: v.string(),
  mode: v.union(v.literal("jam"), v.literal("cook")),
  assignmentId: v.optional(v.id("assignments")),  // Hidden assignment for chat jobs
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

## Part 5: Product Owner Agent Template

### Template File: `templates/product-owner.md`

```markdown
# Product Owner Agent

You are the Product Owner for the {{NAMESPACE}} project. You help users define, refine, and prioritize product requirements.

## Your Capabilities

You have access to the workflow engine to:
- View existing assignments and their status
- Understand project progress and blockers

{{#if COOK_MODE}}
## COOK MODE ACTIVE

You have FULL AUTONOMY to take action:
- CREATE new assignments via CLI
- INSERT jobs into the workflow queue
- Make product decisions and execute them

When the user requests work to be done, you should:
1. Confirm understanding of requirements
2. Create the assignment with clear North Star
3. Insert initial job(s) to begin work
4. Inform the user what you've initiated

CLI Commands available:
```bash
# Create assignment
npx tsx .agents/tools/workflow/cli.ts create "<north-star>" --priority <N>

# Insert initial job
npx tsx .agents/tools/workflow/cli.ts insert-job <assignmentId> --type plan --harness claude --context "<context>"
```
{{else}}
## JAM MODE ACTIVE

You are in READ-ONLY ideation mode:
- You CANNOT create assignments or jobs
- You CAN help spec out ideas
- You CAN ask clarifying questions
- You CAN suggest approaches and trade-offs
- You CAN help refine requirements

When the user wants to execute, suggest they switch to Cook mode.
{{/if}}

## Chat Context
Thread: {{THREAD_ID}}
Namespace: {{NAMESPACE}}
Mode: {{MODE}}

## Conversation History
{{MESSAGES}}

## Latest User Message
{{LATEST_MESSAGE}}

---

Think step-by-step. Be a thoughtful product owner. Help the user build the right thing.
```

### Mode Behavior Differences

| Aspect | Jam Mode | Cook Mode |
|--------|----------|-----------|
| Create Assignments | NO | YES |
| Insert Jobs | NO | YES |
| Ask Questions | YES | YES |
| Suggest Approaches | YES | YES |
| Read Codebase | YES | YES |
| Execute Commands | NO | YES (CLI only) |

---

## Part 6: Implementation Work Packages

### WP1: Backend Schema & API (Backend)
**Files to create/modify:**
- `workflow-engine/convex/schema.ts` - Add chatThreads, chatMessages tables
- `workflow-engine/convex/chatThreads.ts` - Thread queries/mutations
- `workflow-engine/convex/chatMessages.ts` - Message queries/mutations

**Estimated effort**: Small

### WP2: UI Chat Components (Frontend)
**Files to create:**
- `workflow-engine/ui/js/components/chat/ChatPanel.js`
- `workflow-engine/ui/js/components/chat/ChatSidebar.js`
- `workflow-engine/ui/js/components/chat/ThreadList.js`
- `workflow-engine/ui/js/components/chat/ThreadItem.js`
- `workflow-engine/ui/js/components/chat/ChatView.js`
- `workflow-engine/ui/js/components/chat/ChatHeader.js`
- `workflow-engine/ui/js/components/chat/ModeToggle.js`
- `workflow-engine/ui/js/components/chat/MessageList.js`
- `workflow-engine/ui/js/components/chat/MessageBubble.js`
- `workflow-engine/ui/js/components/chat/ChatInput.js`
- `workflow-engine/ui/js/components/chat/index.js`

**Files to modify:**
- `workflow-engine/ui/js/main.js` - Add chat panel to layout
- `workflow-engine/ui/css/styles.css` - Add chat-specific styles

**Estimated effort**: Medium

### WP3: Runner Chat Job Integration (Backend)
**Files to modify:**
- `.agents/tools/workflow/runner.ts` - Add chat job handling
- `.agents/tools/workflow/cli.ts` - Add chat-related commands (optional)

**Files to create:**
- `.agents/tools/workflow/templates/product-owner.md` - PO agent template

**Estimated effort**: Small-Medium

### WP4: Integration & Polish (Full Stack)
- Wire up real-time subscriptions
- Add loading states and error handling
- Test mode toggle behavior
- Test Cook mode assignment creation

**Estimated effort**: Small

---

## Part 7: Job Sequence Recommendation

```
Phase 1: Backend Foundation
├── WP1: Schema & API
│   ├── implement: Add schema tables
│   ├── implement: Create chatThreads.ts
│   ├── implement: Create chatMessages.ts
│   └── verify: Run Convex deployment, test queries

Phase 2: Frontend Components
├── WP2: UI Components
│   ├── implement: Core chat components
│   ├── implement: Main.js integration
│   └── uat: Test chat UI flows

Phase 3: Agent Integration
├── WP3: Runner & Template
│   ├── implement: Product Owner template
│   ├── implement: Runner chat job handling
│   └── verify: Test chat job execution

Phase 4: End-to-End Testing
├── WP4: Integration
│   ├── uat: Full flow testing
│   ├── refine: Bug fixes
│   └── verify: Final acceptance
```

---

## Part 8: Ambiguities & Decisions Needed

### Decision 1: Chat Panel Location
**Options:**
- A) Tab alongside assignments in main content
- B) Slide-out panel from right edge
- C) Separate full-page view with routing

**Recommendation**: Option A - Tab approach, keeps it integrated

### Decision 2: Thread-Assignment Linkage
**Options:**
- A) Each thread gets a hidden assignment (reuses job infrastructure)
- B) Chat jobs are standalone (new execution path)

**Recommendation**: Option A - Consistency, reuse, job history tracking

### Decision 3: Message Streaming
**Options:**
- A) Wait for full response, then display
- B) Stream tokens as they arrive (requires WebSocket/SSE)

**Recommendation**: Option A for MVP - simpler, can add streaming later

### Decision 4: Cook Mode Safety
**Question**: Should Cook mode require confirmation before creating assignments?

**Recommendation**: Yes - Show a confirmation dialog "Create assignment: [northStar]?" before executing

---

## Part 9: File Index

### New Files to Create
```
workflow-engine/convex/chatThreads.ts
workflow-engine/convex/chatMessages.ts
workflow-engine/ui/js/components/chat/ChatPanel.js
workflow-engine/ui/js/components/chat/ChatSidebar.js
workflow-engine/ui/js/components/chat/ThreadList.js
workflow-engine/ui/js/components/chat/ThreadItem.js
workflow-engine/ui/js/components/chat/ChatView.js
workflow-engine/ui/js/components/chat/ChatHeader.js
workflow-engine/ui/js/components/chat/ModeToggle.js
workflow-engine/ui/js/components/chat/MessageList.js
workflow-engine/ui/js/components/chat/MessageBubble.js
workflow-engine/ui/js/components/chat/ChatInput.js
workflow-engine/ui/js/components/chat/index.js
.agents/tools/workflow/templates/product-owner.md
```

### Files to Modify
```
workflow-engine/convex/schema.ts (add tables)
workflow-engine/ui/js/main.js (add chat panel)
workflow-engine/ui/css/styles.css (add chat styles)
.agents/tools/workflow/runner.ts (add chat job handling)
```

---

## Appendix: Comparison with PM Agent

| Aspect | PM Agent | Product Owner Agent |
|--------|----------|---------------------|
| **Context** | Within an assignment | Independent, creates assignments |
| **Triggered by** | Job completion | User chat messages |
| **Purpose** | Quality gate, decide next job | Define & prioritize requirements |
| **Mode** | Single mode | Jam (read-only) or Cook (full autonomy) |
| **Creates Assignments** | No | Yes (in Cook mode) |
| **Chat Interface** | No | Yes |
| **Template Variables** | `{{NORTH_STAR}}`, `{{PREVIOUS_RESULT}}` | `{{MESSAGES}}`, `{{MODE}}`, `{{LATEST_MESSAGE}}` |

The Product Owner sits "above" the assignment level - it defines WHAT gets built. The PM sits "within" assignments - managing HOW things get built.
