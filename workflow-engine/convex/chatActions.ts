"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { spawn } from "child_process";

/**
 * Chat Actions - Direct Claude execution with session resume support
 *
 * This module handles direct chat interaction without the assignment/job infrastructure.
 * Chat threads maintain conversation context via Claude's --resume flag.
 *
 * Architecture:
 * - sendMessage action directly spawns Claude CLI (no runner involvement)
 * - Session ID is extracted from init event and stored on thread
 * - Subsequent messages use --resume flag for conversation continuity
 *
 * Key differences from job-based flow:
 * - No assignment/job records created
 * - Direct execution in Convex action (not via runner)
 * - Session resume via --resume flag for conversation continuity
 *
 * NOTE: This file uses "use node" directive and can ONLY contain actions.
 * Queries and mutations are in chatActionsHelpers.ts
 */

interface ClaudeJsonEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  result?: string;
  message?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: string;
}

/**
 * Execute Claude CLI and parse JSON output
 * Returns { sessionId, response } or throws on error
 */
async function executeClaudeCli(
  message: string,
  existingSessionId: string | null
): Promise<{ sessionId: string; response: string }> {
  const args = [
    "-p",
    message,
    "--output-format",
    "stream-json",
    "--dangerously-skip-permissions",
  ];

  // Add resume flag if we have an existing session
  if (existingSessionId) {
    args.push("--resume", existingSessionId);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    let sessionId: string | null = existingSessionId;
    const textChunks: string[] = [];
    let finalResult: string | null = null;

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      // Parse JSON lines from stdout
      const lines = stdout.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const event: ClaudeJsonEvent = JSON.parse(line);

          // Extract session_id from init event
          if (event.type === "system" && event.subtype === "init" && event.session_id) {
            sessionId = event.session_id;
          }

          // Capture assistant text messages
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text) {
                textChunks.push(block.text);
              }
            }
          }

          // Capture final result
          if (event.type === "result" && event.result) {
            finalResult = event.result;
          }
        } catch {
          // Ignore non-JSON lines
        }
      }

      if (code !== 0) {
        // Check for session-related errors that might need recovery
        const lowerStderr = stderr.toLowerCase();
        if (
          lowerStderr.includes("session not found") ||
          lowerStderr.includes("invalid session") ||
          lowerStderr.includes("session")
        ) {
          reject(new Error(`SESSION_INVALID: ${stderr}`));
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
        return;
      }

      const response = finalResult || textChunks.join("\n\n");

      if (!sessionId) {
        reject(new Error("No session_id received from Claude CLI"));
        return;
      }

      if (!response) {
        reject(new Error("No response received from Claude CLI"));
        return;
      }

      resolve({ sessionId, response });
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });

    // Timeout after 5 minutes (Convex action limit is 10 min)
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude CLI timeout after 5 minutes"));
    }, 5 * 60 * 1000);

    // Clear timeout when child exits
    child.on("exit", () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Send a message in a chat thread
 *
 * This action:
 * - Reads existing claudeSessionId from thread (if any)
 * - Stores the user message first
 * - Executes Claude CLI with --resume if session exists
 * - Captures new session_id and stores it
 * - Saves assistant response to chatMessages
 * - Does NOT create assignment/job records
 */
export const sendMessage = action({
  args: {
    threadId: v.id("chatThreads"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string }> => {
    // 1. Get thread to check for existing session
    const thread = await ctx.runQuery(internal.chatActionsHelpers.getThread, {
      threadId: args.threadId,
    });

    if (!thread) {
      return { success: false, error: "Thread not found" };
    }

    // 2. Store user message first
    await ctx.runMutation(internal.chatActionsHelpers.addMessage, {
      threadId: args.threadId,
      role: "user",
      content: args.message,
    });

    const existingSessionId = thread.claudeSessionId || null;

    try {
      // 3. Execute Claude CLI
      const { sessionId, response } = await executeClaudeCli(
        args.message,
        existingSessionId
      );

      // 4. Update session ID if new or changed
      if (sessionId !== existingSessionId) {
        await ctx.runMutation(internal.chatActionsHelpers.updateSessionId, {
          threadId: args.threadId,
          sessionId,
        });
      }

      // 5. Save assistant response
      await ctx.runMutation(internal.chatActionsHelpers.addMessage, {
        threadId: args.threadId,
        role: "assistant",
        content: response,
      });

      return { success: true, response };
    } catch (err) {
      const error = err as Error;

      // Handle session recovery
      if (error.message.startsWith("SESSION_INVALID:")) {
        console.log(
          `[Chat] Session invalid for thread ${args.threadId}, clearing and retrying`
        );

        // Clear the invalid session
        await ctx.runMutation(internal.chatActionsHelpers.clearSessionId, {
          threadId: args.threadId,
        });

        // Retry without session resume
        try {
          const { sessionId, response } = await executeClaudeCli(
            args.message,
            null
          );

          // Store new session ID
          await ctx.runMutation(internal.chatActionsHelpers.updateSessionId, {
            threadId: args.threadId,
            sessionId,
          });

          // Save assistant response
          await ctx.runMutation(internal.chatActionsHelpers.addMessage, {
            threadId: args.threadId,
            role: "assistant",
            content: response,
          });

          return { success: true, response };
        } catch (retryErr) {
          const retryError = retryErr as Error;
          // Save error as assistant message for visibility
          await ctx.runMutation(internal.chatActionsHelpers.addMessage, {
            threadId: args.threadId,
            role: "assistant",
            content: `Error: ${retryError.message}`,
          });
          return {
            success: false,
            error: `Recovery failed: ${retryError.message}`,
          };
        }
      }

      // Save error as assistant message for visibility
      await ctx.runMutation(internal.chatActionsHelpers.addMessage, {
        threadId: args.threadId,
        role: "assistant",
        content: `Error: ${error.message}`,
      });

      return { success: false, error: error.message };
    }
  },
});
