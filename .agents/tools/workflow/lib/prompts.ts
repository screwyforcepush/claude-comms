/**
 * Prompt Building Module
 *
 * Handles template loading and prompt assembly for all job types.
 * Extracted from runner.ts for modularity.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Types needed for prompt building
export interface Assignment {
  _id: string;
  _creationTime: number;
  namespaceId: string;
  northStar: string;
  status: "pending" | "active" | "blocked" | "complete";
  blockedReason?: string;
  independent: boolean;
  priority: number;
  artifacts: string;
  decisions: string;
  headGroupId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface JobGroup {
  _id: string;
  _creationTime: number;
  assignmentId: string;
  nextGroupId?: string;
  status: "pending" | "running" | "complete" | "failed";
  aggregatedResult?: string;
  createdAt: number;
}

export interface Job {
  _id: string;
  _creationTime: number;
  groupId: string;
  jobType: string;
  harness: "claude" | "codex" | "gemini";
  context?: string;
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  prompt?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

export interface ChatMessage {
  _id: string;
  threadId: string;
  role: "user" | "assistant" | "pm";
  content: string;
  createdAt: number;
}

export interface ChatJobContext {
  threadId: string;
  namespaceId: string;
  mode: "jam" | "cook" | "guardian";
  // For differential prompting
  effectivePromptMode: "jam" | "cook";
  lastPromptMode?: "jam" | "cook";
  messages: ChatMessage[];
  latestUserMessage: string;
  claudeSessionId?: string;
  // Guardian mode context
  assignmentId?: string;
  isGuardianEvaluation?: boolean; // True when PO is evaluating PM response
}

// Prompt types for differential prompting
export type PromptType = "full" | "mode_activation" | "minimal" | "guardian_eval";

// Resolve templates directory relative to this module
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "templates");

/**
 * Load a template file by job type
 */
export function loadTemplate(jobType: string): string {
  const templatePath = join(TEMPLATES_DIR, `${jobType}.md`);
  try {
    return readFileSync(templatePath, "utf-8");
  } catch {
    console.error(`Template not found: ${jobType}.md`);
    return "Execute the task as described.\n\n{{CONTEXT}}";
  }
}

// Accumulated job result for PM jobs
export interface AccumulatedJobResult {
  jobType: string;
  harness: string; // Kept for internal tracking, not shown to PM
  result: string;
  groupId?: string;
  groupIndex?: number;
}

/**
 * Format accumulated results for PM prompt
 * Uses jobType with A/B/C suffixes for multiple jobs of same type
 * Does NOT expose harness names - PM sees only jobType labels
 */
function formatAccumulatedResults(
  accumulatedResults: AccumulatedJobResult[]
): string {
  if (!accumulatedResults || accumulatedResults.length === 0) {
    return "(no previous results)";
  }

  // Group by jobType to determine if we need A/B/C suffixes
  const byJobType = new Map<string, AccumulatedJobResult[]>();
  for (const r of accumulatedResults) {
    const list = byJobType.get(r.jobType) || [];
    list.push(r);
    byJobType.set(r.jobType, list);
  }

  // Build sections with A/B/C suffixes for duplicates
  const sections: string[] = [];
  const suffixes = ["A", "B", "C", "D", "E", "F", "G", "H"];

  for (const [jobType, results] of byJobType) {
    if (results.length === 1) {
      // Single job of this type - no suffix
      sections.push(`## ${jobType}\n\n${results[0].result}`);
    } else {
      // Multiple jobs of same type - add A/B/C suffixes
      for (let i = 0; i < results.length; i++) {
        const suffix = suffixes[i] || `${i + 1}`;
        sections.push(`## ${jobType} ${suffix}\n\n${results[i].result}`);
      }
    }
  }

  return sections.join("\n\n---\n\n");
}

interface GroupedResults {
  groupId: string;
  groupIndex: number;
  results: AccumulatedJobResult[];
}

function groupAccumulatedResults(
  accumulatedResults: AccumulatedJobResult[]
): GroupedResults[] {
  if (!accumulatedResults || accumulatedResults.length === 0) {
    return [];
  }

  const groups = new Map<string, GroupedResults>();
  let fallbackIndex = 0;

  for (const result of accumulatedResults) {
    const groupId = result.groupId || `unknown-${fallbackIndex}`;
    const groupIndex =
      typeof result.groupIndex === "number" ? result.groupIndex : fallbackIndex;

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        groupId,
        groupIndex,
        results: [],
      });
    }

    groups.get(groupId)!.results.push(result);
    fallbackIndex += 1;
  }

  return Array.from(groups.values()).sort((a, b) => a.groupIndex - b.groupIndex);
}

function isReviewJobType(jobType: string): boolean {
  return jobType === "review" || jobType.endsWith("review");
}

function includesJobType(results: AccumulatedJobResult[], jobType: string): boolean {
  return results.some((r) => r.jobType === jobType);
}

function inferPrimaryJobType(results: AccumulatedJobResult[]): string {
  if (includesJobType(results, "implement")) return "implement";
  if (includesJobType(results, "plan")) return "plan";
  if (includesJobType(results, "document")) return "document";
  if (includesJobType(results, "uat")) return "uat";
  return results[0]?.jobType || "unknown";
}

function buildPmModules(accumulatedResults: AccumulatedJobResult[]): string {
  const grouped = groupAccumulatedResults(accumulatedResults);
  if (grouped.length === 0) {
    return "No prior job results found. Ask clarifying questions if needed and decide the first actionable job.";
  }

  const latestGroup = grouped[grouped.length - 1];
  const latestHasReview = latestGroup.results.some((r) => isReviewJobType(r.jobType));
  const latestHasImplement = latestGroup.results.some((r) => r.jobType === "implement");
  const latestHasPlan = latestGroup.results.some((r) => r.jobType === "plan");

  if (latestHasReview) {
    let reviewGroupIndex = -1;
    for (let i = grouped.length - 1; i >= 0; i--) {
      if (grouped[i].results.some((r) => isReviewJobType(r.jobType))) {
        reviewGroupIndex = i;
        break;
      }
    }

    const priorGroup =
      reviewGroupIndex > 0 ? grouped[reviewGroupIndex - 1] : undefined;
    const p1JobType = priorGroup ? inferPrimaryJobType(priorGroup.results) : "unknown";
    const priorResults = priorGroup
      ? formatAccumulatedResults(priorGroup.results)
      : "(no prior group found)";

    return `### Post-Review Decision\n\n#### R-1 Context (Group Before Review)\n${priorResults}\n\n#### Decision Logic (P-1 = ${p1JobType})\n1. **If fundamental decisions are required** (cannot be inferred from mental-model + north star with high confidence):\n   - Ask clarifying questions\n   - Block the assignment until resolved\n2. **If high-severity issues have a clear optimal solution and reviewers concur**:\n   - Append a new **${p1JobType}** job to address/refine\n   - Include the issues raised and rationale in your PM response\n3. **If only medium/low/no issues and reviewers (and UAT, if present) approve**:\n   - Filter issues for alignment with mental model and real product value\n   - If **P-1 = plan**: update the plan doc yourself, then append **implement** (or complete if planning-only)\n   - If **P-1 = implement**: append **implement** to address items, or append **document** if no further changes are warranted\n\nAlways include the issues raised and your decision rationale.\n`;
  }

  if (latestHasImplement) {
    return `### Post-Implement Decision\n\n- Append a **review** job to assess the implementation quality and alignment.\n- If the implementation impacts UX, include **uat** in the same job group.\n- Provide clear context for reviewers/UAT (what changed, success criteria, files/flows).\n`;
  }

  if (latestHasPlan) {
    return `### Post-Plan Decision\n\n- If the plan/spec represents **non-trivial change** (5+ files, backend + frontend, foundational schema, or core system building blocks), append a **review** job.\n- If the plan is **trivial** or already reviewed and approved, append **implement** to execute the full plan.\n- Ensure the plan doc path is recorded in artifacts.\n`;
  }

  return "No matching PM module found. Decide next steps based on the latest results and north star alignment.";
}

/**
 * Build prompt for assignment-based jobs
 * Each job has its own jobType and context
 */
export function buildPrompt(
  group: JobGroup,
  assignment: Assignment,
  job: Job,
  accumulatedResults: AccumulatedJobResult[]
): string {
  const template = loadTemplate(job.jobType);

  // Format accumulated results for PM/retrospect jobs
  const resultText = formatAccumulatedResults(accumulatedResults);
  const pmModules =
    job.jobType === "pm" ? buildPmModules(accumulatedResults) : "";

  return template
    .replace(/\{\{NORTH_STAR\}\}/g, assignment.northStar)
    .replace(/\{\{ARTIFACTS\}\}/g, assignment.artifacts || "(none)")
    .replace(/\{\{DECISIONS\}\}/g, assignment.decisions || "(none)")
    .replace(/\{\{CONTEXT\}\}/g, job.context || "(no specific context)")
    .replace(/\{\{PREVIOUS_RESULT\}\}/g, resultText)
    .replace(/\{\{ASSIGNMENT_ID\}\}/g, assignment._id)
    .replace(/\{\{GROUP_ID\}\}/g, group._id)
    .replace(/\{\{CURRENT_JOB_ID\}\}/g, job._id)
    .replace(/\{\{HARNESS\}\}/g, job.harness)
    .replace(/\{\{PM_MODULES\}\}/g, pmModules);
}

/**
 * Determine which prompt type to use based on context
 */
export function determinePromptType(chatContext: ChatJobContext): PromptType {
  const isNewSession = !chatContext.claudeSessionId;
  const isGuardianEval = chatContext.isGuardianEvaluation === true;

  // Guardian evaluation always gets its special prompt
  if (isGuardianEval) {
    return "guardian_eval";
  }

  // New session (no claudeSessionId) - send full prompt
  if (isNewSession) {
    return "full";
  }

  // Check if mode changed since last prompt
  const modeChanged = chatContext.lastPromptMode !== chatContext.effectivePromptMode;

  if (modeChanged) {
    return "mode_activation";
  }

  // Same mode, resuming session - minimal prompt
  return "minimal";
}

/**
 * Build prompt for chat jobs with differential prompting
 * - Full prompt for new sessions
 * - Mode activation snippet when mode changes
 * - Minimal prompt for same-mode resume
 * - Guardian eval injection for PM report evaluation
 */
export function buildChatPrompt(chatContext: ChatJobContext, namespace: string): string {
  const promptType = determinePromptType(chatContext);
  const template = loadTemplate("product-owner");

  // Variable replacements used across all prompt types
  const replaceVars = (text: string): string => {
    return text
      .replace(/\{\{THREAD_ID\}\}/g, chatContext.threadId)
      .replace(/\{\{NAMESPACE\}\}/g, namespace)
      .replace(/\{\{MODE\}\}/g, chatContext.effectivePromptMode)
      .replace(/\{\{LATEST_MESSAGE\}\}/g, chatContext.latestUserMessage)
      .replace(/\{\{ASSIGNMENT_ID\}\}/g, chatContext.assignmentId || "(no assignment linked)");
  };

  switch (promptType) {
    case "full":
      return buildFullPrompt(template, chatContext, replaceVars);

    case "mode_activation":
      return buildModeActivationPrompt(chatContext, replaceVars);

    case "minimal":
      return buildMinimalPrompt(chatContext, replaceVars);

    case "guardian_eval":
      return buildGuardianEvalPrompt(template, chatContext, replaceVars);
  }
}

/**
 * Build full prompt for new sessions
 */
function buildFullPrompt(
  template: string,
  chatContext: ChatJobContext,
  replaceVars: (text: string) => string
): string {
  let processed = template;

  // Remove GUARDIAN_MODE blocks (not applicable for full prompt)
  const guardianModeRegex = /\{\{#if GUARDIAN_MODE\}\}[\s\S]*?\{\{\/if\}\}/g;
  processed = processed.replace(guardianModeRegex, "");

  // Handle {{#if COOK_MODE}}...{{else}}...{{/if}}
  const cookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(cookModeRegex, (_match, cookContent, jamContent) => {
    return chatContext.effectivePromptMode === "cook" ? cookContent : jamContent;
  });

  // Handle simple {{#if COOK_MODE}}...{{/if}} without else
  const simpleCookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(simpleCookModeRegex, (_match, content) => {
    return chatContext.effectivePromptMode === "cook" ? content : "";
  });

  // Handle {{#if NEW_SESSION}}...{{/if}} - include for new sessions
  const newSessionRegex = /\{\{#if NEW_SESSION\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(newSessionRegex, (_match, content) => content);

  return replaceVars(processed);
}

/**
 * Build mode activation prompt when mode changes during session
 */
function buildModeActivationPrompt(
  chatContext: ChatJobContext,
  replaceVars: (text: string) => string
): string {
  const mode = chatContext.effectivePromptMode.toUpperCase();

  let modeContent: string;

  if (chatContext.effectivePromptMode === "cook") {
    modeContent = `## COOK MODE ACTIVATED

You now have **FULL AUTONOMY** to take action. Adopt COOK mode behavior until explicitly changed.

### Your Powers in Cook Mode

- CREATE new assignments via CLI
- INSERT jobs into the workflow queue
- Make product decisions and execute them

When the user wants work to be done:
1. **Confirm** your understanding of requirements
2. **Create** an assignment with a **verbose north star** (include user perspective + success criteria)
3. **Insert** an initial job to begin work (usually \`plan\` type)
4. **Immediately update** \`docs/project/spec/mental-model.md\` with new insights from the conversation
5. **Inform** the user what you've initiated

### CLI Commands Available

\`\`\`bash
# Create a new assignment (auto-linked to this thread)
npx tsx .agents/tools/workflow/cli.ts create "<north-star-description>" --priority <N>

# Insert job(s) - jobs in the same array run in parallel
npx tsx .agents/tools/workflow/cli.ts insert-job <assignmentId> \\
  --jobs '[{"jobType":"plan","context":"<context>"}]'

# Append to existing chain (use --append to link after current tail)
npx tsx .agents/tools/workflow/cli.ts insert-job <assignmentId> --append \\
  --jobs '[{"jobType":"implement","context":"Build auth"},{"jobType":"uat","context":"Test login"}]'

# View assignments and queue
npx tsx .agents/tools/workflow/cli.ts assignments
npx tsx .agents/tools/workflow/cli.ts queue

# Delete assignment
npx tsx .agents/tools/workflow/cli.ts delete-assignment <assignmentId>
\`\`\`

### Job Types You Can Create

| Type | Use When |
|------|----------|
| \`plan\` | Need a spec doc and work-package breakdown |
| \`implement\` | Clear requirements ready for implementation |
| \`review\` | Engineering quality review of plan/spec or implementation |
| \`uat\` | Need user-perspective testing |
| \`document\` | Update docs and finalize assignment |`;
  } else {
    modeContent = `## JAM MODE ACTIVATED

You are now in **READ-ONLY** ideation mode. Adopt JAM mode behavior until explicitly changed.

### Your Role in Jam Mode

- You CANNOT create assignments or jobs
- You CAN help spec out ideas
- You CAN ask clarifying questions
- You CAN suggest approaches and trade-offs
- You CAN help refine requirements
- You CAN explore the codebase and existing work

Help the user think through their ideas:
- Ask probing questions to clarify requirements
- Identify potential challenges and edge cases
- Suggest technical approaches
- Help prioritize features
- Draft acceptance criteria
- Explore trade-offs between options

### When to Suggest Cook Mode

If the user says things like "Let's do it", "Make it happen", "Start working on this" - suggest they switch to **Cook mode** to take action.`;
  }

  const prompt = `${modeContent}

---

## Current Message

**User says:**
${chatContext.latestUserMessage}`;

  return replaceVars(prompt);
}

/**
 * Build minimal prompt for same-mode resume
 */
function buildMinimalPrompt(
  chatContext: ChatJobContext,
  replaceVars: (text: string) => string
): string {
  const prompt = `## Current Message

**User says:**
${chatContext.latestUserMessage}`;

  return replaceVars(prompt);
}

/**
 * Build guardian evaluation prompt for PM report evaluation
 */
function buildGuardianEvalPrompt(
  template: string,
  chatContext: ChatJobContext,
  replaceVars: (text: string) => string
): string {
  // Extract the GUARDIAN_MODE block from template
  const guardianModeRegex = /\{\{#if GUARDIAN_MODE\}\}([\s\S]*?)\{\{\/if\}\}/;
  const match = template.match(guardianModeRegex);

  if (match && match[1]) {
    return replaceVars(match[1].trim());
  }

  // Fallback if template doesn't have guardian block
  return replaceVars(`## GUARDIAN MODE - ALIGNMENT EVALUATION

You are monitoring assignment alignment. A PM has reported on work progress.

**Assignment ID:** ${chatContext.assignmentId || "(unknown)"}

### PM Progress Report
${chatContext.latestUserMessage}

### Alignment Response

Respond with **ONE** of:

**🟢** - Trajectory aligned with intent. Just the emoji, nothing else.

**🟠** - Uncertain. Include 2-3 sentence rationale explaining the concern.

**🔴** - Misaligned. Include rationale and block the assignment.`);
}

/**
 * Parse chat context from job context JSON field
 */
export function parseChatContext(contextStr: string): ChatJobContext | null {
  try {
    return JSON.parse(contextStr) as ChatJobContext;
  } catch {
    console.error("Failed to parse chat context:", contextStr);
    return null;
  }
}

/**
 * Check if a job is a chat job based on its type
 */
export function isChatJob(job: Job): boolean {
  return job.jobType === "chat" || job.jobType === "product-owner";
}
