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
  rateLimitType: string;  // "five_hour" or "seven_day"
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
  /** Get rate-limit info if a rate_limit_event was detected (Claude only) */
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

export class CodexStreamHandler implements StreamHandler {
  private messages: string[] = [];
  private lastMessage: string | null = null;
  private complete = false;
  private finalResult: string | null = null;
  private threadId: string | null = null;

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

    if (type === "turn.completed") {
      this.complete = true;
      // Snapshot the last agent_message as the final result at the terminal
      // event. Mirrors Claude's pattern: getResult() prefers finalResult and
      // falls back to the full accumulated trail on timeout / no completion.
      this.finalResult = this.lastMessage;
    }
  }

  getResult(): string {
    return this.finalResult || truncateFallback(this.messages.join("\n\n"));
  }

  isTerminal(): boolean {
    return this.complete;
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return this.threadId;
  }

  getFailureReason(): string | null {
    return null;
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return null;
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
    default:
      return new ClaudeStreamHandler();
  }
}

// ============================================================================
// Command Building
// ============================================================================

/**
 * Build command and arguments for spawning a harness process
 */
export function buildCommand(
  harness: string,
  prompt: string,
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

      args.push("-p", prompt);
      return { cmd: "claude", args };
    }
    case "codex": {
      const args = ["--yolo", "e"];
      if (options.sessionId) {
        args.push("resume");
        if (options.model) {
          args.push("-m", options.model);
        }
        args.push(options.sessionId, prompt, "--json");
      } else {
        if (options.model) {
          args.push("-m", options.model);
        }
        args.push(prompt, "--json");
      }
      return { cmd: "codex", args };
    }
    case "gemini": {
      const args = ["--yolo"];
      if (options.sessionId) {
        args.push("--resume", options.sessionId);
      }
      if (options.model) {
        args.push("-m", options.model);
      }
      args.push("--output-format", "stream-json", "-p", prompt);
      return { cmd: "gemini", args };
    }
    default:
      throw new Error(`Unknown harness: ${harness}`);
  }
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
