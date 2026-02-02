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
  headJobId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Job {
  _id: string;
  _creationTime: number;
  assignmentId: string;
  jobType: string;
  harness: "claude" | "codex" | "gemini";
  context?: string;
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  nextJobId?: string;
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
  messages: ChatMessage[];
  latestUserMessage: string;
  claudeSessionId?: string;
  // Guardian mode context
  assignmentId?: string;
  isGuardianEvaluation?: boolean; // True when PO is evaluating PM response
}

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
  result: string;
}

/**
 * Format accumulated results for PM prompt
 */
function formatAccumulatedResults(
  accumulatedResults: AccumulatedJobResult[],
  previousResult: string | null
): string {
  // If no accumulated results, fall back to single previous result
  if (!accumulatedResults || accumulatedResults.length === 0) {
    return previousResult || "(no previous result)";
  }

  // Single result - use simple format
  if (accumulatedResults.length === 1) {
    return accumulatedResults[0].result;
  }

  // Multiple results - format with headers
  return accumulatedResults
    .map((r, i) => `### Job ${i + 1}: ${r.jobType}\n\n${r.result}`)
    .join("\n\n---\n\n");
}

/**
 * Build prompt for assignment-based jobs
 */
export function buildPrompt(
  jobType: string,
  assignment: Assignment,
  job: Job,
  previousResult: string | null,
  accumulatedResults?: AccumulatedJobResult[]
): string {
  const template = loadTemplate(jobType);

  // For PM/retrospect jobs, use accumulated results; otherwise just previous
  const isPMJob = jobType === "pm" || jobType === "retrospect";
  const resultText = isPMJob
    ? formatAccumulatedResults(accumulatedResults || [], previousResult)
    : (previousResult || "(no previous result)");

  return template
    .replace(/\{\{NORTH_STAR\}\}/g, assignment.northStar)
    .replace(/\{\{ARTIFACTS\}\}/g, assignment.artifacts || "(none)")
    .replace(/\{\{DECISIONS\}\}/g, assignment.decisions || "(none)")
    .replace(/\{\{CONTEXT\}\}/g, job.context || "(no specific context)")
    .replace(/\{\{PREVIOUS_RESULT\}\}/g, resultText)
    .replace(/\{\{ASSIGNMENT_ID\}\}/g, assignment._id)
    .replace(/\{\{CURRENT_JOB_ID\}\}/g, job._id);
}

/**
 * Build prompt for chat jobs with Handlebars-style conditionals
 * Note: Conversation history is handled by Claude session resume, not in the prompt
 */
export function buildChatPrompt(chatContext: ChatJobContext, namespace: string): string {
  const template = loadTemplate("product-owner");
  const isNewSession = !chatContext.claudeSessionId;
  const isGuardianMode = chatContext.mode === "guardian";
  const isGuardianEval = chatContext.isGuardianEvaluation === true;

  // Process Handlebars-style conditionals
  let processed = template;

  // Handle {{#if GUARDIAN_MODE}}...{{/if}} - guardian evaluation mode
  const guardianModeRegex = /\{\{#if GUARDIAN_MODE\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(guardianModeRegex, (_match, content) => {
    return isGuardianEval ? content : "";
  });

  // Handle {{#if COOK_MODE}}...{{else}}...{{/if}}
  // Note: In guardian mode (not eval), treat like cook mode for normal interactions
  const cookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(cookModeRegex, (_match, cookContent, jamContent) => {
    // Guardian evaluation skips this entirely (handled by GUARDIAN_MODE block)
    if (isGuardianEval) return "";
    // Guardian mode (normal interaction) acts like cook
    return chatContext.mode === "cook" || chatContext.mode === "guardian" ? cookContent : jamContent;
  });

  // Handle simple {{#if COOK_MODE}}...{{/if}} without else
  const simpleCookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(simpleCookModeRegex, (_match, content) => {
    if (isGuardianEval) return "";
    return chatContext.mode === "cook" || chatContext.mode === "guardian" ? content : "";
  });

  // Handle {{#if NEW_SESSION}}...{{/if}} for first message only
  const newSessionRegex = /\{\{#if NEW_SESSION\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(newSessionRegex, (_match, content) => {
    // Skip title setting in guardian evaluation mode
    if (isGuardianEval) return "";
    return isNewSession ? content : "";
  });

  // Replace template variables
  return processed
    .replace(/\{\{THREAD_ID\}\}/g, chatContext.threadId)
    .replace(/\{\{NAMESPACE\}\}/g, namespace)
    .replace(/\{\{MODE\}\}/g, chatContext.mode)
    .replace(/\{\{LATEST_MESSAGE\}\}/g, chatContext.latestUserMessage)
    .replace(/\{\{ASSIGNMENT_ID\}\}/g, chatContext.assignmentId || "(no assignment linked)");
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
