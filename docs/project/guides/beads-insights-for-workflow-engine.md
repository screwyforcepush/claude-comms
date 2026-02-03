# Beads Insights for Workflow-Engine

> Deep analysis of steveyegge/beads repo comparing patterns with claude-comms + workflow-engine. Stack-ranked by potential impact.

---

## STACK-RANKED INSIGHTS

### Tier 1: High-Impact, Adopt Now

---

#### 1. EPHEMERAL WISPS (Local-Only Work Items)

**Source:** ElenaForge analysis of Molecules/Wisps

**The Pattern:**
Beads distinguishes between **persistent** (Mol) and **ephemeral** (Wisp) work items. Wisps are local-only, never synced to git, and auto-garbage-collected after 24 hours.

**Why It Matters:**
- PM decision jobs, patrol cycles, health checks = noise in the database
- Assignment view gets cluttered with operational mechanics
- No distinction between "feature work" and "workflow scaffolding"

**Adoption:**
```typescript
// Add to jobs schema
jobs: defineTable({
  ...existing,
  ephemeral: v.optional(v.boolean()),  // Never exported, auto-GC'd
})

// CLI commands
insert-job --ephemeral     // Create wisp-like job
squash-assignment <id>     // Compress to digest, clear ephemeral flag
burn-assignment <id>       // Delete entirely (ephemeral only)
```

**Impact:** Reduces database noise by 40-60% for long-running assignments

---

#### 2. STEP-LEVEL PARALLELISM DETECTION

**Source:** MarcusAether analysis of Dependency Graph

**The Pattern:**
Beads automatically discovers which steps CAN run in parallel using union-find algorithm on blocking depth. Returns `CanParallel: ["job-2", "job-3"]` per job.

**Why It Matters:**
- Workflow-engine forces sequential execution within assignments
- PM must manually split into separate assignments for parallelism
- No visibility into what COULD parallelize

**Adoption:**
```typescript
// Enhance scheduler.ts
interface ReadyJob {
  job: Job;
  assignment: Assignment;
  previousResult: string | null;
  canParallel?: string[];  // NEW: IDs that can run concurrently
}

// Let PM decide if to spawn parallel streams
```

**Impact:** Enables 2-3x throughput for assignments with independent sub-tasks

---

#### 3. "LANDING THE PLANE" SESSION PROTOCOL

**Source:** OscarVelocity analysis of Session Management

**The Pattern:**
Mandatory checkpoint sequence: file issues → quality gates → sync → push → verify. Non-negotiable: "The plane is NOT landed until `git push` succeeds."

**Why It Matters:**
- Prevents stranded work when sessions end unexpectedly
- Forces explicit artifact documentation
- Creates handoff context for next session

**Adoption:**
```markdown
## Landing Checkpoint Flow
verify (re-check north_star)
  → retrospect (document artifacts & decisions)
  → flush (sync state)
  → handoff (generate continuation prompt)
  → COMPLETE assignment (only after all above)
```

**Impact:** Eliminates "lost work" scenarios, improves multi-session continuity

---

#### 4. MODULAR PM DECISION MODULES

**Source:** Already designed in `pm-modular-prompt-design.md`

**The Pattern:**
PM prompt should be context-aware based on `{{PREVIOUS_JOB_TYPE}}`. Different decision trees for: after-plan, after-implement, after-uat, after-verify, after-refine, after-research.

**Why It Matters:**
- Current PM has generic decision tree regardless of context
- "After UAT" decisions differ from "After Implement" decisions
- Reduces PM cognitive load with focused guidance

**Adoption:**
```
templates/
├── pm-header.md
├── pm-modules/
│   ├── after-plan.md
│   ├── after-implement.md
│   ├── after-uat.md
│   └── ...
└── pm-footer.md (CLI commands)
```

**Impact:** More accurate PM decisions, fewer wasted job cycles

---

### Tier 2: Medium-Impact, Plan for Phase 2

---

#### 5. RICH DEPENDENCY TYPES

**Source:** MarcusAether analysis of Dependency Graph

**The Pattern:**
Beads has 4 dependency types with different semantics:
- `blocks` - Hard blocker (affects ready queue)
- `parent-child` - Hierarchy (organizational)
- `discovered-from` - Historical tracking ("found while working on X")
- `waits-for` - Gate pattern (wait for ALL children)

**Why It Matters:**
- Workflow-engine only has implicit `nextJobId` chaining
- No way to express "this job was discovered during that job"
- No parallel fanout gates (wait for N jobs to complete)

**Adoption:**
```typescript
jobs: defineTable({
  ...existing,
  dependencyType: v.optional(v.union(
    v.literal("blocks"),
    v.literal("discovered-from"),
    v.literal("waits-for"),
  )),
  blockedBy: v.optional(v.array(v.id("jobs"))),  // For waits-for gates
})
```

**Impact:** Enables complex workflow patterns (parallel fanout, conditional paths)

---

#### 6. CONTENT-HASH IDEMPOTENCY

**Source:** SophiaQuartz + NinaSpectra analysis

**The Pattern:**
Every issue has a SHA256 content hash. Import logic: same ID + same hash = skip (idempotent), same ID + different hash = update.

**Why It Matters:**
- Detects data corruption during transmission
- Enables resilient retry logic
- Future-proofs for multi-runner scenarios

**Adoption:**
```typescript
// In jobs.ts complete() mutation
export const complete = mutation({
  args: {
    id: v.id("jobs"),
    result: v.string(),
    resultHash: v.string(),  // SHA256 of result
  },
  handler: async (ctx, args) => {
    const computed = sha256(args.result);
    if (computed !== args.resultHash) {
      throw new Error("Result hash mismatch - corruption detected");
    }
    // ... proceed
  },
});
```

**Impact:** Catches silent corruption, enables offline-first future

---

#### 7. RUNNER RESILIENCE PATTERNS

**Source:** VictorPulse analysis of Daemon Architecture

**The Pattern:**
Beads daemon has: version checking (refuse stale daemons), health heartbeats (30s), graceful fallback (RPC → direct DB), panic recovery per-connection, bounded semaphore for connections.

**Why It Matters:**
- Runner.ts can silently disconnect from Convex
- No explicit health checks
- Single crash kills all jobs

**Adoption:**
```typescript
// Health check every 30s
setInterval(async () => {
  const healthy = await healthCheck();
  if (!healthy) {
    cleanup();
    setTimeout(startRunner, 2000);
  }
}, 30000);

// Bounded job execution
const MAX_CONCURRENT_JOBS = 5;
const jobSemaphore = new Set<string>();

// Per-job error boundary
async function executeJobSafely(job, assignment, prev) {
  try {
    return await executeJob(job, assignment, prev);
  } catch (e) {
    await client.mutation(api.jobs.fail, { id: job._id, result: String(e) });
  }
}
```

**Impact:** Prevents runner outages, enables graceful degradation

---

#### 8. COMPACTION & MEMORY DECAY

**Source:** LilaCompact analysis

**The Pattern:**
Beads compacts closed issues after 30 days:
- Tier 1: 70% reduction via AI summarization (Summary, Key Decisions, Resolution)
- Tier 2: 95% reduction for 90+ day old items
- Tombstones with TTL for soft-deletes

**Why It Matters:**
- PM `{{JOB_HISTORY}}` grows indefinitely
- Long assignments accumulate irrelevant context
- Context window is expensive

**Adoption:**
```typescript
// Three-phase context window
Phase 1 (last 3 jobs): Full detail
Phase 2 (jobs 4-10): Summary only (100 chars)
Phase 3 (11+ jobs): Type, status, duration only

// Add compaction metadata
jobs: defineTable({
  ...existing,
  compactionLevel: v.optional(v.number()),
  compactedAt: v.optional(v.number()),
  summary: v.optional(v.string()),
})
```

**Impact:** Reduces PM prompt size by 60-80% for long assignments

---

#### 9. AGENT-OPTIMIZED CLI DESIGN

**Source:** IvyCLI analysis

**The Pattern:**
- Universal `--json` flag (global, not per-command)
- Command consolidation (`bd doctor --fix` not `bd recover`)
- Non-interactive first (`bd update` flags, not `bd edit`)
- `bd ready` as primary entry point

**Why It Matters:**
- Workflow-engine CLI lacks structured output
- No unified "ready work" pattern
- Mixed interactive/non-interactive commands

**Adoption:**
```bash
# Primary agent entry point
wf ready --json

# All commands support --json
wf jobs list --json
wf jobs claim <id> --json
wf jobs complete <id> --result "..." --json

# Consolidate: wf doctor --fix, wf daemons {list,health,stop}
```

**Impact:** Enables programmatic agent integration, reduces cognitive load

---

### Tier 3: Lower-Impact / Future Consideration

---

#### 10. MULTI-AGENT COORDINATION (Contributor/Maintainer Routing)

**Source:** ZekeParallel analysis

**The Pattern:**
- `bd init --contributor` routes planning to personal repo
- `bd init --stealth` for private local use
- Auto-detection of fork vs maintainer status
- `discovered-from` dependencies inherit routing

**Why It Matters:**
- Multiple agents working on same namespace could collide
- No visibility levels (public/internal/ephemeral)
- No role-based routing

**Adoption (Future):**
```typescript
assignments: defineTable({
  visibility: v.union("public", "internal", "ephemeral"),
  agentRole: v.optional(v.union("conductor", "contributor", "maintainer")),
  routedNamespaceId: v.optional(v.id("namespaces")),
})
```

**Impact:** Enables true multi-agent autonomy without coordination overhead

---

#### 11. HASH-BASED COLLISION PREVENTION

**Source:** NinaSpectra analysis

**The Pattern:**
- Hash-based IDs (bd-a1b2) from content, not sequential
- Adaptive length scaling (4→5→6 chars as DB grows)
- Birthday paradox math for collision probability

**Why It Matters:**
- Only critical if: multiple concurrent runners, offline mode, federation
- Convex handles ID generation atomically today

**Adoption:** Defer unless adding offline-first or multi-runner features.

---

#### 12. GIT HOOKS FOR CONSISTENCY

**Source:** RexTrigger analysis

**The Pattern:**
- pre-commit: Flush pending changes to JSONL
- pre-push: Validate no uncommitted changes
- post-merge: Import updated JSONL
- post-checkout: Import after branch switch

**Why It Matters:**
- Beads has dual state (DB + JSONL) requiring sync
- Workflow-engine uses Convex (single source of truth)
- Hooks pattern doesn't directly apply

**Adoption:** Not needed. Convex handles consistency. But the **validation pattern** (pre/post checks) could apply to mutations.

---

#### 13. FORMULAS (Declarative Workflow Templates)

**Source:** ElenaForge analysis of Molecules

**The Pattern:**
TOML-based workflow definitions with variables, dependencies, gates:
```toml
[[steps]]
id = "implement"
needs = ["plan"]
[steps.gate]
type = "gh:run"
timeout = "30m"
```

**Why It Matters:**
- PM manually chains jobs today
- No declarative "recipe" system
- Complex workflows require many CLI calls

**Adoption (Future):**
```yaml
# recipes/feature-development.yaml
recipe: "feature-dev"
jobs:
  - id: plan, type: plan, depends: []
  - id: implement, type: implement, depends: [plan]
  - id: uat, type: uat, depends: [implement]
```

**Impact:** Eliminates manual job chaining for common patterns

---

## QUICK REFERENCE: ADOPTION PRIORITY

| Rank | Concept | Effort | Impact | Phase |
|------|---------|--------|--------|-------|
| 1 | Ephemeral Wisps | Low | High | Now |
| 2 | Step-Level Parallelism | Medium | High | Now |
| 3 | Landing Protocol | Low | High | Now |
| 4 | Modular PM Prompts | Medium | High | Now |
| 5 | Rich Dependency Types | Medium | Medium | Phase 2 |
| 6 | Content-Hash Validation | Low | Medium | Phase 2 |
| 7 | Runner Resilience | Medium | Medium | Phase 2 |
| 8 | Compaction/Memory Decay | High | Medium | Phase 2 |
| 9 | Agent-Optimized CLI | Medium | Medium | Phase 2 |
| 10 | Multi-Agent Routing | High | Low | Future |
| 11 | Hash-Based IDs | High | Low | Future |
| 12 | Git Hooks Pattern | N/A | N/A | N/A |
| 13 | Formula System | High | Medium | Future |

---

## SUMMARY

**Beads' core insight:** Treat agents as first-class citizens with explicit session discipline, ephemeral vs persistent distinction, and dependency-aware work graphs.

**Workflow-engine's strength:** Simpler model (single DB, PM control) that's easier to reason about.

**Best hybrid approach:**
1. Keep PM shadow job pattern (excellent for oversight)
2. Add ephemeral jobs (reduce noise immediately)
3. Add step-level parallelism detection (improve throughput)
4. Implement landing protocol (prevent lost work)
5. Modularize PM prompts by context (better decisions)

The patterns from beads that matter most are about **session discipline** (landing the plane), **noise reduction** (wisps/ephemeral), and **parallelism visibility** (step-level detection). The git-backed persistence and hash-based IDs are elegant but solve problems we don't have today with Convex.
