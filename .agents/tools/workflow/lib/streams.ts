import { existsSync, readFileSync } from "fs";

/**
 * Stream Handlers for different AI harnesses
 *
 * Parses JSON stream output from Claude, Codex, and Gemini CLIs.
 * Extracts text results, completion status, and session IDs.
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimitInfo {
  resetsAt: number;       // Unix seconds
  rateLimitType: string;  // "five_hour" | "seven_day" (claude), "codex_usage" (codex)
}

export interface StreamHandler {
  /** Process a JSON event from the harness output stream */
  onEvent(event: Record<string, unknown>): void;
  /** Get accumulated result text */
  getResult(): string;
  /** Check if a terminal result event was observed (success or error) */
  isTerminal(): boolean;
  /** Check if the stream indicates successful completion */
  isComplete(): boolean;
  /** Get session ID for resume functionality */
  getSessionId(): string | null;
  /** Get a failure reason if a terminal error was observed */
  getFailureReason(): string | null;
  /** Get rate-limit info if a provider usage limit was detected (Claude and Codex) */
  getRateLimitInfo(): RateLimitInfo | null;
}

export interface CommandOptions {
  /** Session/thread ID for harness resume */
  sessionId?: string;
  /** Fork the session instead of resuming in-place (creates new branch) */
  forkSession?: boolean;
  /** Model to pass to harness CLI */
  model?: string;
}

export interface AgyCommandOptions extends CommandOptions {
  /** Print-mode timeout passed to agy, in milliseconds */
  printTimeoutMs?: number;
}

export interface CommandResult {
  cmd: string;
  args: string[];
}

export interface InteractiveClaudeCommandOptions extends CommandOptions {
  /** Settings JSON path containing hook configuration for interactive mode */
  settingsPath: string;
  /** Optional setting source override, e.g. "user" to suppress project settings */
  settingSources?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const FALLBACK_MAX_CHARS = 5000;

const CLAUDE_DISALLOWED_TOOLS = [
  "AskUserQuestion",
  "NotebookEdit",
  "PushNotification",
  "RemoteTrigger",
  "Workflow",
  "ScheduleWakeup",
  "mcp__claude_ai_Gmail__authenticate",
  "mcp__claude_ai_Gmail__complete_authentication",
  "mcp__claude_ai_Google_Calendar__authenticate",
  "mcp__claude_ai_Google_Calendar__complete_authentication",
  "mcp__claude_ai_Google_Drive__authenticate",
  "mcp__claude_ai_Google_Drive__complete_authentication",
];

function truncateFallback(text: string): string {
  if (text.length <= FALLBACK_MAX_CHARS) return text;
  return "...truncated.\n" + text.slice(-FALLBACK_MAX_CHARS);
}

// ============================================================================
// Claude Stream Handler
// ============================================================================

export class ClaudeStreamHandler implements StreamHandler {
  private textChunks: string[] = [];
  private finalResult: string | null = null;
  private complete = false;
  private success = false;
  private sessionId: string | null = null;
  private failureReason: string | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;

  onEvent(event: Record<string, unknown>): void {
    if (event.hook_event_name) {
      this.onHookEvent(event);
      return;
    }

    const type = event.type as string;

    // Capture rate_limit_event (fires before the synthetic result)
    if (type === "rate_limit_event") {
      const info = event.rate_limit_info as {
        status?: string;
        resetsAt?: number;
        rateLimitType?: string;
      } | undefined;
      if (info?.status === "rejected" && info.resetsAt && info.rateLimitType) {
        this.rateLimitInfo = {
          resetsAt: info.resetsAt,
          rateLimitType: info.rateLimitType,
        };
      }
    }

    // Capture assistant text messages
    if (type === "assistant" && event.message) {
      const msg = event.message as {
        content?: Array<{ type?: string; text?: string }>;
      };
      if (msg.content) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            this.textChunks.push(block.text);
          }
        }
      }
    }

    // Capture final result and session_id
    if (type === "result") {
      this.complete = true;
      const subtype = event.subtype as string | undefined;
      const isError = Boolean(event.is_error);
      this.success = subtype === "success" && !isError;
      if (event.result) {
        this.finalResult = String(event.result);
      }
      // Capture session_id for resume functionality
      if (event.session_id) {
        this.sessionId = String(event.session_id);
      }
      if (!this.success) {
        const reason = subtype || "error";
        this.failureReason = `claude_result_${reason}`;
      }
    }
  }

  private onHookEvent(event: Record<string, unknown>): void {
    const hookEventName = event.hook_event_name as string;

    if (event.session_id && hookEventName !== "SessionStart") {
      this.sessionId = String(event.session_id);
    } else if (event.session_id && !this.sessionId) {
      this.sessionId = String(event.session_id);
    }

    if (hookEventName === "Stop") {
      this.complete = true;
      this.success = true;
      if (typeof event.last_assistant_message === "string") {
        this.finalResult = event.last_assistant_message;
      }
      return;
    }

    if (hookEventName === "StopFailure") {
      this.complete = true;
      this.success = false;
      if (typeof event.last_assistant_message === "string") {
        this.finalResult = event.last_assistant_message;
      }

      const reason =
        (event.error as string | undefined) ??
        (event.matcher as string | undefined) ??
        "unknown";
      this.failureReason = `claude_stop_failure_${reason}`;

      const info = event.rate_limit_info as {
        resetsAt?: number;
        rateLimitType?: string;
      } | undefined;
      if (reason === "rate_limit" && info?.resetsAt && info.rateLimitType) {
        this.rateLimitInfo = {
          resetsAt: info.resetsAt,
          rateLimitType: info.rateLimitType,
        };
      }
    }
  }

  getResult(): string {
    // Prefer the final result field, fall back to accumulated text
    return this.finalResult || truncateFallback(this.textChunks.join("\n\n"));
  }

  isTerminal(): boolean {
    return this.complete;
  }

  isComplete(): boolean {
    return this.complete && this.success;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}

// ============================================================================
// Codex Stream Handler
// ============================================================================

/**
 * Parse the reset time out of a Codex usage-limit message, e.g.
 * "You've hit your usage limit. Visit ... or try again at Aug 8th, 2026 5:04 AM."
 * Codex renders the timestamp in the machine's local timezone and the runner
 * shares that machine, so local-time Date parsing is correct.
 * Returns Unix seconds, or null when there is no parseable timestamp
 * (e.g. purely purchase-gated credit exhaustion).
 */
export function parseCodexUsageLimitReset(message: string): number | null {
  const match = message.match(/try again at\s+(.+?)\.?\s*$/i);
  if (!match) return null;
  const cleaned = match[1].replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const parsed = new Date(cleaned).getTime();
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

export class CodexStreamHandler implements StreamHandler {
  private messages: string[] = [];
  private lastMessage: string | null = null;
  private complete = false;
  private failed = false;
  private finalResult: string | null = null;
  private threadId: string | null = null;
  private failureReason: string | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;

  onEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === "thread.started" && event.thread_id) {
      this.threadId = String(event.thread_id);
    }

    if (type === "item.completed") {
      const item = event.item as { type?: string; text?: string } | undefined;
      if (item?.type === "agent_message" && item.text) {
        this.messages.push(item.text);
        this.lastMessage = item.text;
      }
    }

    // A usage-limit wall surfaces as both a bare error event and the
    // turn.failed error payload; sniff both so orphan replay catches
    // whichever made it into the log.
    if (type === "error" && typeof event.message === "string") {
      this.detectUsageLimit(event.message);
    }

    if (type === "turn.failed") {
      const err = event.error as { message?: string } | undefined;
      const message = err?.message ?? "unknown";
      this.detectUsageLimit(message);
      this.failed = true;
      this.failureReason = `codex_turn_failed: ${message.slice(0, 200)}`;
      this.finalResult = this.lastMessage;
    }

    if (type === "turn.completed") {
      this.complete = true;
      // Snapshot the last agent_message as the final result at the terminal
      // event. Mirrors Claude's pattern: getResult() prefers finalResult and
      // falls back to the full accumulated trail on timeout / no completion.
      this.finalResult = this.lastMessage;
    }
  }

  private detectUsageLimit(message: string): void {
    if (this.rateLimitInfo) return;
    if (!/usage limit/i.test(message)) return;
    // No parseable reset time → resetsAt = now; jobs.rateLimited clamps the
    // first retry to 60s and its backoff schedule takes over from there.
    this.rateLimitInfo = {
      resetsAt: parseCodexUsageLimitReset(message) ?? Math.floor(Date.now() / 1000),
      rateLimitType: "codex_usage",
    };
  }

  getResult(): string {
    return this.finalResult || truncateFallback(this.messages.join("\n\n"));
  }

  isTerminal(): boolean {
    return this.complete || this.failed;
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return this.threadId;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}

// ============================================================================
// Gemini Stream Handler
// ============================================================================

export class GeminiStreamHandler implements StreamHandler {
  private buffer = "";
  private currentTurnBuffer = "";
  private complete = false;
  private failureReason: string | null = null;
  private sessionId: string | null = null;

  onEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === "init" && event.session_id) {
      this.sessionId = String(event.session_id);
    }

    if (type === "message" && event.role === "assistant") {
      const content = event.content as string | undefined;
      if (content) {
        this.buffer += content;
        this.currentTurnBuffer += content;
      }
    }

    // tool_use marks a turn boundary — next assistant messages are a new turn
    if (type === "tool_use") {
      this.currentTurnBuffer = "";
    }

    if (type === "result") {
      this.complete = true;
      const status = event.status as string | undefined;
      if (status && status !== "success") {
        this.failureReason = `gemini_result_${status}`;
      }
    }
  }

  getResult(): string {
    // Prefer the last assistant turn, fall back to full accumulated buffer
    return this.currentTurnBuffer || truncateFallback(this.buffer);
  }

  isTerminal(): boolean {
    return this.complete;
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return null;
  }
}

// ============================================================================
// Agy Stream Handler
// ============================================================================

export class AgyStreamHandler implements StreamHandler {
  private complete = false;
  private success = false;
  private sessionId: string | null = null;
  private failureReason: string | null = null;
  private finalResult: string | null = null;
  private rootConversationId: string | null = null;

  onEvent(event: Record<string, unknown>): void {
    const hookEventName = event.hook_event_name as string | undefined;
    const conversationId = event.conversationId as string | undefined;

    if (conversationId && !this.rootConversationId) {
      this.rootConversationId = conversationId;
      this.sessionId = conversationId;
    }

    if (hookEventName !== "Stop") return;

    // Subagents inherit the hook environment; only the root conversation Stop
    // should terminate the parent workflow job.
    if (
      this.rootConversationId &&
      conversationId &&
      conversationId !== this.rootConversationId
    ) {
      return;
    }

    const fullyIdle = event.fullyIdle as boolean | undefined;
    if (fullyIdle === false) return;

    this.complete = true;

    const error = event.error as string | undefined;
    const terminationReason = event.terminationReason as string | undefined;
    const normalizedReason = (terminationReason || "").toLowerCase();
    this.success = !error && !normalizedReason.includes("error") && !normalizedReason.includes("max_steps");

    if (typeof event.result === "string") {
      this.finalResult = event.result;
    } else {
      const transcriptPath = event.transcriptPath as string | undefined;
      const transcriptResult = transcriptPath ? readAgyFinalPlannerResponse(transcriptPath) : null;
      if (transcriptResult) {
        this.finalResult = transcriptResult;
      }
    }

    if (!this.success) {
      this.failureReason = `agy_stop_${terminationReason || error || "unknown"}`;
    }
  }

  getResult(): string {
    return this.finalResult || "";
  }

  isTerminal(): boolean {
    return this.complete;
  }

  isComplete(): boolean {
    return this.complete && this.success;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getFailureReason(): string | null {
    return this.failureReason;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return null;
  }
}

function readAgyFinalPlannerResponse(transcriptPath: string): string | null {
  if (!existsSync(transcriptPath)) return null;

  try {
    const lines = readFileSync(transcriptPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim());

    for (let i = lines.length - 1; i >= 0; i--) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(lines[i]) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (
        parsed.type === "PLANNER_RESPONSE" &&
        parsed.source === "MODEL" &&
        typeof parsed.content === "string"
      ) {
        return parsed.content;
      }
    }
  } catch {
    return null;
  }

  return null;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create appropriate stream handler for the given harness
 */
export function createStreamHandler(harness: string): StreamHandler {
  switch (harness) {
    case "claude":
      return new ClaudeStreamHandler();
    case "codex":
      return new CodexStreamHandler();
    case "gemini":
      return new GeminiStreamHandler();
    case "agy":
      return new AgyStreamHandler();
    default:
      return new ClaudeStreamHandler();
  }
}

// ============================================================================
// Command Building
// ============================================================================

/**
 * Build command and arguments for spawning a harness process.
 *
 * The prompt is intentionally NOT part of argv — callers must pipe it to the
 * child's stdin (claude: bare `-p`, codex: the `-` sentinel). Argv prompts
 * are visible in `ps` and capped at ~128KiB per argument by the kernel.
 */
export function buildCommand(
  harness: string,
  options: CommandOptions = {}
): CommandResult {
  switch (harness) {
    case "claude": {
      const args = [
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format",
        "stream-json",
        "--disable-slash-commands",
        "--disallowedTools",
        ...CLAUDE_DISALLOWED_TOOLS,
      ];
      if (options.model) {
        args.push("--model", options.model);
      }

      // Add --resume flag for session continuity
      if (options.sessionId) {
        args.push("--resume", options.sessionId);
        // Fork creates a new session branch from the resumed session
        if (options.forkSession) {
          args.push("--fork-session");
        }
      }

      args.push("-p");
      return { cmd: "claude", args };
    }
    case "codex": {
      const args = ["--yolo", "e"];
      if (options.sessionId) {
        args.push("resume");
        if (options.model) {
          args.push("-m", options.model);
        }
        args.push(options.sessionId, "-", "--json");
      } else {
        if (options.model) {
          args.push("-m", options.model);
        }
        args.push("-", "--json");
      }
      return { cmd: "codex", args };
    }
    default:
      throw new Error(`Unknown harness: ${harness}`);
  }
}

export function buildAgyCommand(options: AgyCommandOptions = {}): CommandResult {
  const args = ["--dangerously-skip-permissions"];

  if (options.sessionId) {
    args.push("--conversation", options.sessionId);
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.printTimeoutMs) {
    args.push("--print-timeout", formatAgyDuration(options.printTimeoutMs));
  }

  // No prompt flag: agy enters print mode by detecting a non-TTY stdin and
  // reads the prompt from it. `-p` requires an inline argument and `-p -`
  // sends a literal hyphen, so bare piping is the only stdin form agy supports.
  return { cmd: "agy", args };
}

function formatAgyDuration(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

/**
 * Build the Claude command used by the interactive wrapper.
 *
 * This intentionally omits -p/--print and stream-json output. Hook settings are
 * passed explicitly, so headless mode remains unaffected by wrapper hooks.
 */
export function buildInteractiveClaudeCommand(
  options: InteractiveClaudeCommandOptions
): CommandResult {
  const args = [
    "--dangerously-skip-permissions",
    "--disable-slash-commands",
    "--disallowedTools",
    ...CLAUDE_DISALLOWED_TOOLS,
  ];

  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.settingsPath) {
    args.push("--settings", options.settingsPath);
  }
  if (options.settingSources) {
    args.push("--setting-sources", options.settingSources);
  }
  if (options.sessionId) {
    args.push("--resume", options.sessionId);
    if (options.forkSession) {
      args.push("--fork-session");
    }
  }

  return { cmd: "claude", args };
}
