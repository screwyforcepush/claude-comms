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

  return template
    .replace(/\{\{NORTH_STAR\}\}/g, assignment.northStar)
    .replace(/\{\{ARTIFACTS\}\}/g, assignment.artifacts || "(none)")
    .replace(/\{\{DECISIONS\}\}/g, assignment.decisions || "(none)")
    .replace(/\{\{CONTEXT\}\}/g, job.context || "(no specific context)")
    .replace(/\{\{PREVIOUS_RESULT\}\}/g, resultText)
    .replace(/\{\{ASSIGNMENT_ID\}\}/g, assignment._id)
    .replace(/\{\{GROUP_ID\}\}/g, group._id)
    .replace(/\{\{CURRENT_JOB_ID\}\}/g, job._id)
    .replace(/\{\{HARNESS\}\}/g, job.harness);
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
2. **Create** an assignment with a clear North Star
3. **Insert** an initial job to begin work (usually \`plan\` type)
4. **Inform** the user what you've initiated

### CLI Commands Available

\`\`\`bash
# Create a new assignment (auto-linked to this thread)
npx tsx .agents/tools/workflow/cli.ts create "<north-star-description>" --priority <N>

# Insert initial job into NEW assignment (becomes head)
npx tsx .agents/tools/workflow/cli.ts insert-job <assignmentId> --type plan --context "<context>"

# Append job to EXISTING assignment (links to tail of chain)
npx tsx .agents/tools/workflow/cli.ts insert-job <assignmentId> --append --type implement --context "<context>"

# View current assignments
npx tsx .agents/tools/workflow/cli.ts assignments

# View queue status
npx tsx .agents/tools/workflow/cli.ts queue

# Delete assignment and all its jobs
npx tsx .agents/tools/workflow/cli.ts delete-assignment <assignmentId>
\`\`\`

> Harness is auto-selected from config per job type. Override with \`--harness <claude|codex|gemini>\` if needed.

### Job Types You Can Create

| Type | Use When |
|------|----------|
| \`plan\` | Breaking down complex requirements into work packages |
| \`implement\` | Clear requirements ready for coding |
| \`research\` | Technical questions need answers first |
| \`uat\` | Need to test user-facing functionality |`;
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
