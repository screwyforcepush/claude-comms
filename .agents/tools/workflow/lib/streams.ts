/**
 * Stream Handlers for different AI harnesses
 *
 * Parses JSON stream output from Claude, Codex, and Gemini CLIs.
 * Extracts text results, completion status, and session IDs.
 */

// ============================================================================
// Types
// ============================================================================

export interface StreamHandler {
  /** Process a JSON event from the harness output stream */
  onEvent(event: Record<string, unknown>): void;
  /** Get accumulated result text */
  getResult(): string;
  /** Check if the stream indicates successful completion */
  isComplete(): boolean;
  /** Get session ID for resume functionality (Claude only) */
  getSessionId(): string | null;
  /** Get a failure reason if a terminal error was observed */
  getFailureReason(): string | null;
}

export interface CommandOptions {
  /** Session ID for Claude session resume */
  sessionId?: string;
}

export interface CommandResult {
  cmd: string;
  args: string[];
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

  onEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

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

  getResult(): string {
    // Prefer the final result field, fall back to accumulated text
    return this.finalResult || this.textChunks.join("\n\n");
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
}

// ============================================================================
// Codex Stream Handler
// ============================================================================

export class CodexStreamHandler implements StreamHandler {
  private messages: string[] = [];
  private complete = false;

  onEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === "item.completed") {
      const item = event.item as { type?: string; text?: string } | undefined;
      if (item?.type === "agent_message" && item.text) {
        this.messages.push(item.text);
      }
    }

    if (type === "turn.completed") {
      this.complete = true;
    }
  }

  getResult(): string {
    return this.messages.join("\n\n");
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return null; // Codex doesn't support session resume
  }

  getFailureReason(): string | null {
    return null;
  }
}

// ============================================================================
// Gemini Stream Handler
// ============================================================================

export class GeminiStreamHandler implements StreamHandler {
  private buffer = "";
  private complete = false;
  private failureReason: string | null = null;

  onEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === "message" && event.role === "assistant") {
      const content = event.content as string | undefined;
      if (content) this.buffer += content;
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
    return this.buffer;
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return null; // Gemini doesn't support session resume
  }

  getFailureReason(): string | null {
    return this.failureReason;
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
      ];

      // Add --resume flag for session continuity
      if (options.sessionId) {
        args.push("--resume", options.sessionId);
      }

      args.push("-p", prompt);
      return { cmd: "claude", args };
    }
    case "codex":
      return {
        cmd: "codex",
        args: ["--yolo", "e", prompt, "--json"],
      };
    case "gemini":
      return {
        cmd: "gemini",
        args: [
          "--yolo",
          "-m",
          "auto-gemini-3",
          "--output-format",
          "stream-json",
          "-p",
          prompt,
        ],
      };
    default:
      throw new Error(`Unknown harness: ${harness}`);
  }
}
