/**
 * Harness Executor
 *
 * Encapsulates the execution of AI harness processes (Claude, Codex, Gemini)
 * with file-based event streaming for crash resilience.
 *
 * Key features:
 * - Process stdout writes directly to log file (independent of runner)
 * - LogTailer watches file for real-time event processing
 * - Orphan detection and reconciliation on startup
 * - Clean separation from runner orchestration logic
 */

import { spawn, ChildProcess } from "child_process";
import {
  watch,
  FSWatcher,
  openSync,
  closeSync,
  createReadStream,
  statSync,
  existsSync,
  writeFileSync,
} from "fs";
import { createInterface } from "readline";
import { EventEmitter } from "events";

import {
  JobTracker,
  FileJobStatus,
  JobPaths,
  ensureJobDir,
  findOrphanedJobs,
  isPidAlive,
  utcNowIso,
  writeJobStatus,
} from "./file-tracker.js";

import {
  StreamHandler,
  createStreamHandler,
  buildCommand,
  CommandOptions,
} from "./streams.js";

// ============================================================================
// Types
// ============================================================================

export type Harness = "claude" | "codex" | "gemini";

export interface ExecutionCallbacks {
  /** Called when job completes successfully */
  onComplete: (result: string, sessionId?: string, exitForced?: boolean) => void;
  /** Called when job fails */
  onFail: (reason: string, partialResult?: string, exitForced?: boolean) => void;
  /** Called when job times out (max duration or idle timeout before terminal event) */
  onTimeout: (partialResult: string) => void;
  /** Optional: called for each event (for custom handling) */
  onEvent?: (event: Record<string, unknown>) => void;
}

export interface ExecutionHandle {
  jobId: string;
  pid: number;
  /** Kill the process */
  kill: () => void;
  /** Get current tracker for status inspection */
  getTracker: () => JobTracker;
}

export interface ExecutorConfig {
  /** Timeout in milliseconds before killing the process (max total duration) */
  timeoutMs: number;
  /** Idle timeout in milliseconds - kills job if no events received for this duration */
  idleTimeoutMs?: number;
  /** Working directory for spawned processes (defaults to process.cwd()) */
  cwd?: string;
  /** Polling interval for file watcher fallback (ms) */
  pollIntervalMs?: number;
  /** Debounce time for file change events (ms) */
  debounceMs?: number;
}

export interface ExecuteOptions {
  jobId: string;
  harness: Harness;
  prompt: string;
  /** Session ID for Claude resume */
  sessionId?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface ReconciliationResult {
  jobId: string;
  finalStatus: "complete" | "error" | "timeout";
  result?: string;
  sessionId?: string;
}

// ============================================================================
// LogTailer - Watches log file and processes new lines
// ============================================================================

/**
 * Tails a log file and emits events for each new JSON line.
 * Handles file watching with fallback polling for reliability.
 */
export class LogTailer extends EventEmitter {
  private logPath: string;
  private position: number;
  private watcher: FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private processing = false;
  private stopped = false;
  private lineBuffer = "";

  private pollIntervalMs: number;
  private debounceMs: number;

  constructor(
    logPath: string,
    startPosition: number = 0,
    options: { pollIntervalMs?: number; debounceMs?: number } = {}
  ) {
    super();
    this.logPath = logPath;
    this.position = startPosition;
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.debounceMs = options.debounceMs ?? 50;
  }

  /**
   * Start watching the log file
   */
  start(): void {
    if (this.stopped) return;

    // Process any existing content first
    this.processNewContent();

    // Set up file watcher
    try {
      this.watcher = watch(this.logPath, (eventType) => {
        if (eventType === "change") {
          this.scheduleProcess();
        }
      });

      this.watcher.on("error", (err) => {
        console.error(`[LogTailer] Watch error for ${this.logPath}:`, err);
        // Fall back to polling
        this.startPolling();
      });
    } catch (err) {
      console.error(`[LogTailer] Failed to watch ${this.logPath}:`, err);
      this.startPolling();
    }

    // Also poll as a fallback (some systems have flaky fs.watch)
    this.startPolling();
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.stopped = true;

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Get current read position
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * Process all remaining content (call before stopping for final read)
   */
  async flush(): Promise<void> {
    await this.processNewContent();
  }

  private startPolling(): void {
    if (this.pollTimer || this.stopped) return;

    this.pollTimer = setInterval(() => {
      this.scheduleProcess();
    }, this.pollIntervalMs);
  }

  private scheduleProcess(): void {
    if (this.stopped) return;

    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processNewContent();
    }, this.debounceMs);
  }

  private async processNewContent(): Promise<void> {
    if (this.processing || this.stopped) return;
    this.processing = true;

    try {
      if (!existsSync(this.logPath)) {
        this.processing = false;
        return;
      }

      const stats = statSync(this.logPath);
      const fileSize = stats.size;

      // Handle file truncation (e.g., log rotation)
      if (fileSize < this.position) {
        console.log(`[LogTailer] File truncated, resetting position from ${this.position} to 0`);
        this.position = 0;
        this.lineBuffer = "";
      }

      if (fileSize <= this.position) {
        this.processing = false;
        return;
      }

      // Read new content from current position
      const stream = createReadStream(this.logPath, {
        start: this.position,
        end: fileSize - 1, // Read up to current size (exclusive end)
        encoding: "utf-8",
      });

      // Collect all new content
      let newContent = this.lineBuffer;
      for await (const chunk of stream) {
        newContent += chunk;
      }

      // Split into lines, keeping incomplete last line in buffer
      const lines = newContent.split("\n");

      // If content doesn't end with newline, last element is incomplete
      if (!newContent.endsWith("\n")) {
        this.lineBuffer = lines.pop() || "";
      } else {
        this.lineBuffer = "";
        // Remove empty string from trailing newline
        if (lines.length > 0 && lines[lines.length - 1] === "") {
          lines.pop();
        }
      }

      // Process complete lines
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          this.emit("event", event, line);
        } catch {
          // Not valid JSON, emit as raw line
          this.emit("line", line);
        }
      }

      // Update position to file size (we've read everything up to this point)
      // Subtract buffered incomplete line bytes
      const bufferedBytes = Buffer.byteLength(this.lineBuffer, "utf-8");
      this.position = fileSize - bufferedBytes;
      this.emit("position", this.position);
    } catch (err) {
      console.error(`[LogTailer] Error processing ${this.logPath}:`, err);
    } finally {
      this.processing = false;
    }
  }
}

// ============================================================================
// HarnessExecutor - Main executor class
// ============================================================================

/**
 * Executes harness processes with file-based event streaming.
 */
export class HarnessExecutor {
  private config: ExecutorConfig;
  private activeJobs = new Map<
    string,
    {
      child: ChildProcess;
      tailer: LogTailer;
      tracker: JobTracker;
      handler: StreamHandler;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(config: ExecutorConfig) {
    this.config = {
      pollIntervalMs: 500,
      debounceMs: 50,
      ...config,
    };
  }

  /**
   * Execute a harness job with file-based event streaming
   */
  execute(options: ExecuteOptions, callbacks: ExecutionCallbacks): ExecutionHandle {
    const { jobId, harness, prompt, sessionId, env } = options;

    // 1. Create job directory and ensure log file exists
    const paths = ensureJobDir(jobId);
    writeFileSync(paths.logPath, ""); // Ensure empty file exists

    // 2. Open file descriptor for child stdout
    const logFd = openSync(paths.logPath, "a");

    // 3. Build command
    const commandOptions: CommandOptions = {};
    if (sessionId && harness === "claude") {
      commandOptions.sessionId = sessionId;
    }
    const { cmd, args } = buildCommand(harness, prompt, commandOptions);

    // 4. Spawn child with stdout going directly to file
    const child = spawn(cmd, args, {
      stdio: ["ignore", logFd, "pipe"], // stdout to file, stderr to pipe
      env: { ...process.env, ...env },
      cwd: this.config.cwd,
    });

    // Close our copy of the fd (child inherited it)
    closeSync(logFd);

    const pid = child.pid || 0;

    // 5. Create tracker (this also writes initial status.json)
    const tracker = new JobTracker(jobId, harness, pid);

    // 6. Create stream handler
    const handler = createStreamHandler(harness);

    // 7. Create and start log tailer
    const tailer = new LogTailer(paths.logPath, 0, {
      pollIntervalMs: this.config.pollIntervalMs,
      debounceMs: this.config.debounceMs,
    });

    // 8. Set up state flags
    let timedOut = false;
    let idleTimedOut = false;
    let spawnFailed = false;
    let jobCompleted = false; // Set when terminal result event triggers completion

    // Grace period before force-killing after terminal event (ms)
    const TERMINAL_GRACE_MS = 2000;

    // Wire up event handling
    tailer.on("event", (event: Record<string, unknown>, _rawLine: string) => {
      handler.onEvent(event);
      const eventType = (event.type as string) || "event";
      tracker.recordEvent(eventType);

      // Reset idle timeout on each event
      resetIdleTimeout();

      // Call optional user callback
      callbacks.onEvent?.(event);

      // Check for terminal result event — decouple completion from process exit
      if (handler.isTerminal() && !jobCompleted) {
        jobCompleted = true;

        // Clear all timeouts — we're handling completion now
        clearTimeout(timeout);
        if (idleTimeout) clearTimeout(idleTimeout);

        // Stop tailing — no further events needed
        tailer.stop();

        console.log(`[${jobId}] Terminal event received, waiting ${TERMINAL_GRACE_MS}ms for process exit`);

        // Grace period: let the process exit naturally, then determine exitForced
        setTimeout(() => {
          const exitForced = child.exitCode === null;

          if (exitForced) {
            console.log(`[${jobId}] Process still alive after grace period, force killing`);
            child.kill("SIGTERM");
            setTimeout(() => {
              if (child.exitCode === null) child.kill("SIGKILL");
            }, 5000);
          }

          this.activeJobs.delete(jobId);

          const result = handler.getResult();
          if (handler.isComplete()) {
            tracker.complete(result);
            callbacks.onComplete(result, handler.getSessionId() || undefined, exitForced);
          } else {
            const failureReason = handler.getFailureReason();
            const reason = failureReason || "terminal_error";
            tracker.fail(reason);
            callbacks.onFail(reason, result, exitForced);
          }
        }, TERMINAL_GRACE_MS);
      }
    });

    tailer.on("position", (pos: number) => {
      tracker.setReadPosition(pos);
    });

    tailer.start();

    // Max duration timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      console.log(`[${jobId}] Timeout after ${this.config.timeoutMs}ms (max duration)`);
      tracker.timeout();
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, this.config.timeoutMs);

    // Idle timeout (resets on each event)
    let idleTimeout: NodeJS.Timeout | null = null;
    const idleTimeoutMs = this.config.idleTimeoutMs;

    const resetIdleTimeout = () => {
      if (!idleTimeoutMs) return;
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        idleTimedOut = true;
        console.log(`[${jobId}] Idle timeout after ${idleTimeoutMs}ms (no events)`);
        tracker.timeout();
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5000);
      }, idleTimeoutMs);
    };

    // Start initial idle timeout
    resetIdleTimeout();

    // 9. Handle spawn errors (command not found, permission denied, etc.)
    child.on("error", (err) => {
      spawnFailed = true;
      clearTimeout(timeout);
      if (idleTimeout) clearTimeout(idleTimeout);
      tailer.stop();
      this.activeJobs.delete(jobId);

      const reason = `spawn_error: ${err.message}`;
      console.error(`[${jobId}] Spawn failed: ${err.message}`);
      tracker.fail(reason);
      callbacks.onFail(reason, undefined);
    });

    // 10. Handle stderr
    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${jobId}] stderr: ${data.toString()}`);
    });

    // 11. Handle process exit
    // When jobCompleted is set, the terminal event handler already handled
    // completion — this becomes a no-op for callback purposes.
    child.on("close", async (code) => {
      if (spawnFailed || jobCompleted) return;

      clearTimeout(timeout);
      if (idleTimeout) clearTimeout(idleTimeout);

      // Final flush to capture any remaining events
      // NOTE: flush may process a terminal event, triggering the event handler
      // which sets jobCompleted and starts its own grace period timer.
      // Re-check jobCompleted after flush to avoid double-firing callbacks.
      await tailer.flush();
      tailer.stop();

      if (jobCompleted) return;

      this.activeJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      if (timedOut || idleTimedOut) {
        callbacks.onTimeout(result || "(no output)");
      } else if (code === 0 && handler.isComplete()) {
        tracker.complete(result);
        callbacks.onComplete(result, handler.getSessionId() || undefined, false);
      } else {
        const failureReason = handler.getFailureReason();
        const reason = failureReason
          ? `process_exit_${code} (${failureReason})`
          : `process_exit_${code}`;
        tracker.fail(reason);
        callbacks.onFail(reason, result, false);
      }
    });

    // Track active job
    this.activeJobs.set(jobId, { child, tailer, tracker, handler, timeout });

    return {
      jobId,
      pid,
      kill: () => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 5000);
      },
      getTracker: () => tracker,
    };
  }

  /**
   * Reconcile orphaned jobs on startup.
   * Reads unprocessed events from log files and determines final status.
   */
  async reconcileOrphans(
    onReconciled: (result: ReconciliationResult) => Promise<void>
  ): Promise<void> {
    const orphans = findOrphanedJobs();

    if (orphans.length === 0) {
      console.log("[Reconcile] No orphaned jobs found");
      return;
    }

    console.log(`[Reconcile] Found ${orphans.length} orphaned jobs`);

    for (const { jobId, status, paths } of orphans) {
      console.log(`[Reconcile] Processing orphan: ${jobId}`);

      try {
        const result = await this.reconcileOrphan(jobId, status, paths);
        await onReconciled(result);
      } catch (err) {
        console.error(`[Reconcile] Error processing ${jobId}:`, err);

        // Mark as error
        status.status = "error";
        status.status_reason = `reconciliation_error: ${err}`;
        status.end_time = utcNowIso();
        writeJobStatus(paths.statusPath, status);

        await onReconciled({
          jobId,
          finalStatus: "error",
          result: `Reconciliation failed: ${err}`,
        });
      }
    }
  }

  /**
   * Process a single orphaned job
   */
  private async reconcileOrphan(
    jobId: string,
    status: FileJobStatus,
    paths: JobPaths
  ): Promise<ReconciliationResult> {
    // Check if process is somehow still alive (shouldn't be, but check anyway)
    if (isPidAlive(status.pid)) {
      console.log(`[Reconcile] ${jobId} still alive (PID ${status.pid}), killing`);
      try {
        process.kill(status.pid!, "SIGTERM");
        await new Promise((r) => setTimeout(r, 500));
        if (isPidAlive(status.pid)) {
          process.kill(status.pid!, "SIGKILL");
        }
      } catch {
        // Ignore kill errors
      }
    }

    // Create handler to process events
    const handler = createStreamHandler(status.harness);

    // Read log from last known position (or 0 if not set)
    const startPosition = status.read_position ?? 0;

    if (!existsSync(paths.logPath)) {
      // No log file - mark as error
      status.status = "error";
      status.status_reason = "orphaned_no_log";
      status.end_time = utcNowIso();
      writeJobStatus(paths.statusPath, status);

      return {
        jobId,
        finalStatus: "error",
        result: "Job orphaned with no log file",
      };
    }

    // Process remaining events in log
    const stream = createReadStream(paths.logPath, {
      start: startPosition,
      encoding: "utf-8",
    });

    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let eventsProcessed = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        handler.onEvent(event);
        eventsProcessed++;
      } catch {
        // Not JSON, skip
      }
    }

    console.log(
      `[Reconcile] ${jobId}: processed ${eventsProcessed} events from position ${startPosition}`
    );

    // Determine final status
    const result = handler.getResult();
    const sessionId = handler.getSessionId();

    if (handler.isComplete()) {
      // Job actually completed successfully
      status.status = "complete";
      status.status_reason = "reconciled_complete";
      status.end_time = utcNowIso();
      status.completion.final_message = result;
      writeJobStatus(paths.statusPath, status);

      return {
        jobId,
        finalStatus: "complete",
        result,
        sessionId: sessionId || undefined,
      };
    } else {
      // Job was interrupted
      status.status = "error";
      status.status_reason = "orphaned_interrupted";
      status.end_time = utcNowIso();
      if (result) {
        status.completion.final_message = result;
      }
      writeJobStatus(paths.statusPath, status);

      return {
        jobId,
        finalStatus: "error",
        result: result || "Job orphaned without completion",
      };
    }
  }

  /**
   * Check if a job is currently being tracked
   */
  isTracking(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  /**
   * Get handle for an active job
   */
  getHandle(jobId: string): ExecutionHandle | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    return {
      jobId,
      pid: job.child.pid || 0,
      kill: () => {
        job.child.kill("SIGTERM");
        setTimeout(() => {
          if (!job.child.killed) job.child.kill("SIGKILL");
        }, 5000);
      },
      getTracker: () => job.tracker,
    };
  }

  /**
   * Kill all active jobs (for shutdown)
   */
  killAll(): void {
    for (const [jobId, job] of this.activeJobs) {
      console.log(`[Executor] Killing job ${jobId}`);
      clearTimeout(job.timeout);
      job.tailer.stop();
      job.child.kill("SIGTERM");
    }
    this.activeJobs.clear();
  }
}
