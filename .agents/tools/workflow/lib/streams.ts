/**
 * Stream Handlers for different AI harnesses
 *
 * Parses JSON stream output from the Claude, Codex, and Antigravity (agy) CLIs.
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
  /**
   * Get rate-limit info if a provider usage limit was detected. Returning
   * info routes the job into the pause-and-retry path; returning null on a
   * limit wall makes the job fail fast instead (the agy handler does this
   * deliberately — see mental-model.md "Rate-Limit Resilience").
   */
  getRateLimitInfo(): RateLimitInfo | null;
  /**
   * Optional: receive raw stderr chunks. Harnesses that report structured
   * errors on stderr (agy's `AGY_ERROR: {...}` line) parse them here.
   */
  onStderr?(chunk: string): void;
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

// Monitor is the other door to "I'll act when the monitor reports": a headless
// run never gets that event. Removed from the schema alongside the background
// parameter (see buildClaudeHeadlessEnv in claude-runtime.ts).
// @see docs/project/spec/mental-model.md#mm-headless-runtime-levers
const CLAUDE_DISALLOWED_TOOLS = [
  "AskUserQuestion",
  "Monitor",
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
      // Transient provider errors (429/5xx, e.g. 529 Overloaded) retry via
      // the rate-limit pause machinery. Key on the structured status — the
      // error message text drifts across CLI versions. Deterministic 4xx
      // request errors must still fail fast. A rate_limit_event (fires
      // before the synthetic result, carries the true reset time) wins;
      // with no reset time given, resetsAt = now and jobs.rateLimited's
      // 60s clamp + backoff schedule take over.
      const apiErrorStatus = event.api_error_status;
      if (
        isError &&
        !this.rateLimitInfo &&
        typeof apiErrorStatus === "number" &&
        (apiErrorStatus === 429 || apiErrorStatus >= 500)
      ) {
        this.rateLimitInfo = {
          resetsAt: Math.floor(Date.now() / 1000),
          rateLimitType: `api_error_${apiErrorStatus}`,
        };
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
// Agy (Antigravity) Stream Handler — `agy --output-format stream-json`
// ============================================================================

/**
 * Structured error agy prints on stderr as `AGY_ERROR: {...}` when a headless
 * run fails for a provider/model reason (exit code 3). `status` is the
 * invariant we key on; the message text drifts across CLI versions.
 */
export interface AgyError {
  status: string;
  error_code?: number;
  code_kind?: string;
  retryable?: boolean;
  short_error?: string;
  error_id?: string;
}

const AGY_ERROR_PREFIX = "AGY_ERROR:";

/**
 * Parses the NDJSON stream agy emits on stdout in print mode:
 *   { event: "init", conversation_id, init: { model, cwd, tools[] } }
 *   { event: "step_update", step_update: { step_type, state, text_delta?, usage?, tool_info?, subagent_info? } }
 *   { event: "result", result: { conversation_id, status: "SUCCESS"|"ERROR", response, error, usage } }
 *
 * Fixtures for every branch live in lib/fixtures/agy/.
 */
export class AgyStreamHandler implements StreamHandler {
  private sessionId: string | null = null;
  private complete = false;
  private success = false;
  private finalResult: string | null = null;
  private resultError: string | null = null;
  private textDeltas: string[] = [];
  private agyError: AgyError | null = null;
  private stderrBuffer = "";

  onEvent(event: Record<string, unknown>): void {
    const kind = event.event as string | undefined;

    if (kind === "init") {
      const conversationId = event.conversation_id;
      if (conversationId) this.sessionId = String(conversationId);
      return;
    }

    if (kind === "step_update") {
      const step = event.step_update as {
        step_type?: string;
        state?: string;
        text_delta?: string;
      } | undefined;
      if (step?.step_type === "agent_response" && step.state === "ACTIVE" && typeof step.text_delta === "string") {
        this.textDeltas.push(step.text_delta);
      }
      return;
    }

    if (kind === "result") {
      const result = event.result as {
        conversation_id?: string;
        status?: string;
        response?: string;
        error?: string;
      } | undefined;
      this.complete = true;
      this.success = result?.status === "SUCCESS";
      if (result?.conversation_id) this.sessionId = String(result.conversation_id);
      if (typeof result?.response === "string" && result.response.trim()) {
        this.finalResult = result.response;
      }
      if (!this.success) {
        this.resultError = (result?.error || "unknown").trim();
      }
    }
  }

  onStderr(chunk: string): void {
    this.stderrBuffer += chunk;
    let newline = this.stderrBuffer.indexOf("\n");
    while (newline >= 0) {
      this.parseStderrLine(this.stderrBuffer.slice(0, newline));
      this.stderrBuffer = this.stderrBuffer.slice(newline + 1);
      newline = this.stderrBuffer.indexOf("\n");
    }
    // The AGY_ERROR line is usually the last thing agy prints and may arrive
    // without a trailing newline; try the remainder too, consuming it only
    // when it parses as a whole line.
    if (this.stderrBuffer.startsWith(AGY_ERROR_PREFIX) && this.parseStderrLine(this.stderrBuffer)) {
      this.stderrBuffer = "";
    }
  }

  private parseStderrLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith(AGY_ERROR_PREFIX)) return false;
    try {
      const parsed = JSON.parse(trimmed.slice(AGY_ERROR_PREFIX.length).trim()) as Partial<AgyError>;
      if (typeof parsed.status === "string") {
        this.agyError = parsed as AgyError;
        return true;
      }
    } catch {
      // Partial line — wait for more stderr.
    }
    return false;
  }

  /** The structured provider error, if agy reported one on stderr. */
  getAgyError(): AgyError | null {
    return this.agyError;
  }

  private isQuotaWall(): boolean {
    return this.agyError?.status === "RESOURCE_EXHAUSTED" || this.agyError?.error_code === 429;
  }

  /**
   * Result text. On a provider error the result is a legible notice rather
   * than the raw error, because the PM reads this field to judge sibling
   * output: a quota-walled reviewer is an absent reviewer, not a verdict.
   */
  getResult(): string {
    if (this.finalResult) return this.finalResult;
    if (this.agyError) return this.describeAgyError();
    return truncateFallback(this.textDeltas.join(""));
  }

  private describeAgyError(): string {
    const err = this.agyError!;
    const code = err.error_code !== undefined ? ` ${err.error_code}` : "";
    const detail = err.short_error ? ` ${err.short_error}` : "";
    const headline = this.isQuotaWall()
      ? "Antigravity (agy) provider quota exhausted — this job produced no output."
      : "Antigravity (agy) provider error — this job produced no output.";
    return `${headline} Status ${err.status}${code}.${detail}\nTreat this as an absent agent, not a verdict on the work under review.`;
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
    if (this.agyError) {
      return this.isQuotaWall()
        ? `rate_limited:${this.agyError.status}`
        : `agy_error:${this.agyError.status}`;
    }
    if (this.complete && !this.success) {
      return `agy_result_error: ${(this.resultError || "unknown").slice(0, 200)}`;
    }
    return null;
  }

  /**
   * Always null — hardcoded. An agy limit wall fails fast and never enters
   * the awaiting_retry pause: the agy quota is small and its reset windows run
   * to days, and the gemini slot is an expendable fan-out reviewer whose
   * siblings cover the round. A pause here would freeze the group for the
   * weakest reviewer in the room. See mental-model.md "Rate-Limit Resilience".
   */
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
      // Harness "gemini" runs on Antigravity (agy); the gemini CLI backend is gone.
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
 * child's stdin (claude: bare `-p`, codex: the `-` sentinel, agy: non-TTY
 * stdin detection). Argv prompts are visible in `ps` and capped at ~128KiB
 * per argument by the kernel.
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
        // Nobody can answer a permission prompt in a headless run: anything
        // that would prompt is denied outright and Claude is told so, which
        // also covers MCP elicitation. Print-mode only, so not in the
        // interactive builder below.
        "--permission-prompts",
        "none",
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
    case "gemini": {
      // Harness "gemini" runs on Antigravity headless mode (agy).
      // No prompt flag: agy enters print mode by detecting a non-TTY stdin and
      // reads the prompt from it. `-p` requires an inline argument and `-p -`
      // sends a literal hyphen, so bare piping is the only stdin form agy supports.
      // No --print-timeout: since agy 1.1.28 an expired print timeout exits 0
      // with truncated output, which would record a cut-off run as a clean
      // completion. The executor's own max-duration kill is the honest timeout.
      const args = [
        "--dangerously-skip-permissions",
        "--disable-slash-commands",
        "--output-format",
        "stream-json",
      ];
      if (options.model) {
        args.push("--model", options.model);
      }
      if (options.sessionId) {
        args.push("--conversation", options.sessionId);
      }
      return { cmd: "agy", args };
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
