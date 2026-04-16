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
  listJobDirs,
  readJobStatus,
  getJobPaths,
  isPidAlive,
  utcNowIso,
  writeJobStatus,
} from "./file-tracker.js";

import {
  StreamHandler,
  RateLimitInfo,
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
  /** Called when job hits a provider rate limit (Claude only). If not provided, falls through to onFail. */
  onRateLimit?: (rateLimitInfo: RateLimitInfo, partialResult?: string) => void;
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
  /** Fork the session instead of resuming in-place */
  forkSession?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface ReconciliationResult {
  jobId: string;
  finalStatus: "complete" | "error" | "timeout";
  result?: string;
  sessionId?: string;
}

export interface OrphanInfo {
  jobId: string;
  status: FileJobStatus;
  paths: JobPaths;
  pidAlive: boolean;
}

export interface DeadOrphanResult {
  jobId: string;
  finalStatus: "complete" | "error";
  result?: string;
  sessionId?: string;
  isComplete: boolean;
  rateLimitInfo?: RateLimitInfo;
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
      pidPoll?: NodeJS.Timeout;
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
    const { jobId, harness, prompt, sessionId, forkSession, env } = options;

    // 1. Create job directory and ensure log file exists
    const paths = ensureJobDir(jobId);
    writeFileSync(paths.logPath, ""); // Ensure empty file exists

    // 2. Open file descriptor for child stdout
    const logFd = openSync(paths.logPath, "a");

    // 3. Build command
    const commandOptions: CommandOptions = {};
    if (sessionId && harness === "claude") {
      commandOptions.sessionId = sessionId;
      if (forkSession) {
        commandOptions.forkSession = true;
      }
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
    let jobCompleted = false;
    let hasSeenResult = false;

    // Settling timer: after a terminal result event, wait for sustained silence
    // before firing completion. If ANY event arrives during the settling window
    // the agent (or its background subagents) is still active, so we cancel the
    // timer and wait for the next result event to restart it.
    const SETTLING_MS = 120_000; // 2 minutes
    let settlingTimer: NodeJS.Timeout | null = null;

    // Wire up event handling
    tailer.on("event", (event: Record<string, unknown>, _rawLine: string) => {
      handler.onEvent(event);
      const eventType = (event.type as string) || "event";
      tracker.recordEvent(eventType);

      // Reset idle timeout on each event (only before first result)
      if (!hasSeenResult) {
        resetIdleTimeout();
      }

      // Call optional user callback
      callbacks.onEvent?.(event);

      // Cancel settling timer on any event — agent is still active
      if (settlingTimer) {
        clearTimeout(settlingTimer);
        settlingTimer = null;
      }

      // Check for terminal result event
      if (handler.isTerminal() && !jobCompleted) {
        if (!hasSeenResult) {
          hasSeenResult = true;
          // Clear idle timeout — settling timer takes over
          if (idleTimeout) {
            clearTimeout(idleTimeout);
            idleTimeout = null;
          }
          console.log(`[${jobId}] Result event detected, entering settling mode (${SETTLING_MS / 1000}s)`);
        }

        // Start/restart settling timer — complete after sustained silence
        settlingTimer = setTimeout(() => {
          if (jobCompleted) return;
          jobCompleted = true;

          clearTimeout(timeout);
          tailer.stop();

          console.log(`[${jobId}] Settling complete (${SETTLING_MS / 1000}s silence after last result)`);

          const exitForced = child.exitCode === null;
          if (exitForced) {
            console.log(`[${jobId}] Process still alive after settling, force killing`);
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
            // Check for rate limit before generic failure
            const rateLimitInfo = handler.getRateLimitInfo();
            if (rateLimitInfo && callbacks.onRateLimit) {
              tracker.fail("rate_limited");
              callbacks.onRateLimit(rateLimitInfo, result);
            } else {
              const failureReason = handler.getFailureReason();
              const reason = failureReason || "terminal_error";
              tracker.fail(reason);
              callbacks.onFail(reason, result, exitForced);
            }
          }
        }, SETTLING_MS);
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
      if (settlingTimer) { clearTimeout(settlingTimer); settlingTimer = null; }
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
    // Process exit is the fast path for completion — the settling timer is the
    // fallback for when the process lingers after emitting a result event.
    child.on("close", async (code) => {
      if (spawnFailed || jobCompleted) return;

      clearTimeout(timeout);
      if (idleTimeout) clearTimeout(idleTimeout);

      // Final flush to capture any remaining events
      await tailer.flush();
      tailer.stop();

      // Clear settling timer — process exit is the authoritative signal
      if (settlingTimer) { clearTimeout(settlingTimer); settlingTimer = null; }

      if (jobCompleted) return;
      jobCompleted = true; // Prevent settling timer from double-firing

      this.activeJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      if (timedOut || idleTimedOut) {
        callbacks.onTimeout(result || "(no output)");
      } else if (code === 0 && handler.isComplete()) {
        tracker.complete(result);
        callbacks.onComplete(result, handler.getSessionId() || undefined, false);
      } else {
        // Check for rate limit before generic failure
        const rateLimitInfo = handler.getRateLimitInfo();
        if (rateLimitInfo && callbacks.onRateLimit) {
          tracker.fail("rate_limited");
          callbacks.onRateLimit(rateLimitInfo, result);
        } else {
          const failureReason = handler.getFailureReason();
          const reason = failureReason
            ? `process_exit_${code} (${failureReason})`
            : `process_exit_${code}`;
          tracker.fail(reason);
          callbacks.onFail(reason, result, false);
        }
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
   * Scan for orphaned jobs: status="running" in file tracker but not in activeJobs.
   * Returns both dead and live PIDs — caller decides how to handle each.
   */
  scanOrphans(): OrphanInfo[] {
    const orphans: OrphanInfo[] = [];

    for (const jobId of listJobDirs()) {
      if (this.activeJobs.has(jobId)) continue;

      const status = readJobStatus(jobId);
      if (!status) continue;
      if (status.status !== "running") continue;

      orphans.push({
        jobId,
        status,
        paths: getJobPaths(jobId),
        pidAlive: isPidAlive(status.pid),
      });
    }

    return orphans;
  }

  /**
   * Finalize a dead orphan: replay ALL events from position 0 to rebuild handler state,
   * update file status, and return result for Convex writeback by caller.
   */
  async finalizeDeadOrphan(orphan: OrphanInfo): Promise<DeadOrphanResult> {
    const { jobId, status, paths } = orphan;

    if (!existsSync(paths.logPath)) {
      status.status = "error";
      status.status_reason = "orphaned_no_log";
      status.end_time = utcNowIso();
      writeJobStatus(paths.statusPath, status);

      return {
        jobId,
        finalStatus: "error",
        result: "Job orphaned with no log file",
        isComplete: false,
      };
    }

    // Replay from position 0 — not read_position. The old runner may have
    // advanced read_position past a result event but died before the Convex
    // callback fired. Replaying from 0 rebuilds full handler state.
    const handler = createStreamHandler(status.harness);

    const stream = createReadStream(paths.logPath, {
      start: 0,
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
      `[Reconcile] ${jobId}: replayed ${eventsProcessed} events from position 0`
    );

    const result = handler.getResult();
    const sessionId = handler.getSessionId();
    const isComplete = handler.isComplete();

    if (isComplete) {
      status.status = "complete";
      status.status_reason = "reconciled_complete";
      status.end_time = utcNowIso();
      status.completion.final_message = result;
    } else {
      status.status = "error";
      status.status_reason = "orphaned_interrupted";
      status.end_time = utcNowIso();
      if (result) {
        status.completion.final_message = result;
      }
    }
    writeJobStatus(paths.statusPath, status);

    return {
      jobId,
      finalStatus: isComplete ? "complete" : "error",
      result: result || (isComplete ? undefined : "Job orphaned without completion"),
      sessionId: sessionId || undefined,
      isComplete,
      rateLimitInfo: handler.getRateLimitInfo() || undefined,
    };
  }

  /**
   * Adopt a live orphan: replay events up to current file size, then start a
   * LogTailer from that position. Uses PID polling instead of child.on('close').
   */
  adoptOrphan(orphan: OrphanInfo, callbacks: ExecutionCallbacks): ExecutionHandle {
    const { jobId, status, paths } = orphan;
    const pid = status.pid!;

    // Capture file size BEFORE replay — events written during replay won't be
    // skipped by the tailer because we start the tailer from this boundary.
    const replayUpTo = existsSync(paths.logPath) ? statSync(paths.logPath).size : 0;

    // Replay events from 0 up to the boundary to rebuild handler state
    const handler = createStreamHandler(status.harness);
    const tracker = JobTracker.fromExisting(jobId, status, paths);

    // We need to replay synchronously before starting the tailer.
    // Use a promise that we await internally via the returned handle pattern.
    let replayDone = false;
    const replayPromise = (async () => {
      if (replayUpTo > 0) {
        const stream = createReadStream(paths.logPath, {
          start: 0,
          end: replayUpTo - 1,
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
          `[Adopt] ${jobId}: replayed ${eventsProcessed} events (0..${replayUpTo})`
        );
      }
      replayDone = true;
      // Check if replay found a terminal result
      if (handler.isTerminal()) hasSeenResult = true;
    })();

    // Set up state flags (same pattern as execute())
    let jobCompleted = false;
    let hasSeenResult = false;

    const SETTLING_MS = 120_000;
    let settlingTimer: NodeJS.Timeout | null = null;

    const completeJob = (finalStatus: "complete" | "error" | "timeout", exitForced: boolean) => {
      if (jobCompleted) return;
      jobCompleted = true;

      if (settlingTimer) { clearTimeout(settlingTimer); settlingTimer = null; }
      clearTimeout(timeout);
      if (pidPoll) clearInterval(pidPoll);
      tailer.stop();
      this.activeJobs.delete(jobId);

      const result = handler.getResult();
      if (finalStatus === "timeout") {
        callbacks.onTimeout(result || "(no output)");
      } else if (handler.isComplete()) {
        tracker.complete(result);
        callbacks.onComplete(result, handler.getSessionId() || undefined, exitForced);
      } else {
        // Check for rate limit before generic failure
        const rateLimitInfo = handler.getRateLimitInfo();
        if (rateLimitInfo && callbacks.onRateLimit) {
          tracker.fail("rate_limited");
          callbacks.onRateLimit(rateLimitInfo, result);
        } else {
          const failureReason = handler.getFailureReason();
          const reason = failureReason || "orphan_interrupted";
          tracker.fail(reason);
          callbacks.onFail(reason, result, exitForced);
        }
      }
    };

    // Start tailer from the replay boundary — no gap, no overlap
    const tailer = new LogTailer(paths.logPath, replayUpTo, {
      pollIntervalMs: this.config.pollIntervalMs,
      debounceMs: this.config.debounceMs,
    });

    // Wire up event handling (same settling logic as execute())
    tailer.on("event", (event: Record<string, unknown>) => {
      if (!replayDone) return; // Ignore events until replay is complete
      handler.onEvent(event);
      const eventType = (event.type as string) || "event";
      tracker.recordEvent(eventType);

      callbacks.onEvent?.(event);

      // Cancel settling timer on any event — agent is still active
      if (settlingTimer) {
        clearTimeout(settlingTimer);
        settlingTimer = null;
      }

      if (handler.isTerminal() && !jobCompleted) {
        hasSeenResult = true;

        settlingTimer = setTimeout(() => {
          if (jobCompleted) return;

          console.log(`[Adopt] ${jobId}: settling complete (${SETTLING_MS / 1000}s silence)`);

          const exitForced = isPidAlive(pid);
          if (exitForced) {
            try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
            setTimeout(() => {
              try { if (isPidAlive(pid)) process.kill(pid, "SIGKILL"); } catch { /* ignore */ }
            }, 5000);
          }

          completeJob(handler.isComplete() ? "complete" : "error", exitForced);
        }, SETTLING_MS);
      }
    });

    tailer.on("position", (pos: number) => {
      tracker.setReadPosition(pos);
    });

    // Start tailer after replay completes
    replayPromise.then(() => {
      if (jobCompleted) return;
      tailer.start();

      // If replay already found a terminal result, start settling immediately
      if (hasSeenResult && !settlingTimer && !jobCompleted) {
        console.log(`[Adopt] ${jobId}: terminal result found in replay, entering settling mode`);
        settlingTimer = setTimeout(() => {
          if (jobCompleted) return;
          const exitForced = isPidAlive(pid);
          if (exitForced) {
            try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
            setTimeout(() => {
              try { if (isPidAlive(pid)) process.kill(pid, "SIGKILL"); } catch { /* ignore */ }
            }, 5000);
          }
          completeJob(handler.isComplete() ? "complete" : "error", exitForced);
        }, SETTLING_MS);
      }
    });

    // Max duration timeout
    const timeout = setTimeout(() => {
      console.log(`[Adopt] ${jobId}: timeout after ${this.config.timeoutMs}ms`);
      tracker.timeout();
      try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
      setTimeout(() => {
        try { if (isPidAlive(pid)) process.kill(pid, "SIGKILL"); } catch { /* ignore */ }
      }, 5000);
      completeJob("timeout", true);
    }, this.config.timeoutMs);

    // PID liveness polling (replaces child.on('close') for adopted processes)
    const pidPoll = setInterval(async () => {
      if (jobCompleted) return;
      if (!isPidAlive(pid)) {
        console.log(`[Adopt] ${jobId}: PID ${pid} died`);
        clearInterval(pidPoll);

        // Final flush to capture remaining events
        await tailer.flush();
        tailer.stop();

        if (jobCompleted) return;
        completeJob(handler.isComplete() ? "complete" : "error", false);
      }
    }, 2000);

    // Proxy ChildProcess for activeJobs map compatibility
    const proxyChild = Object.create(null) as ChildProcess;
    (proxyChild as any).pid = pid;
    (proxyChild as any).kill = (signal?: string) => {
      try { process.kill(pid, (signal as NodeJS.Signals) || "SIGTERM"); } catch { /* ignore */ }
    };
    (proxyChild as any).killed = false;
    (proxyChild as any).exitCode = null;

    this.activeJobs.set(jobId, {
      child: proxyChild,
      tailer,
      tracker,
      handler,
      timeout,
      pidPoll,
    });

    return {
      jobId,
      pid,
      kill: () => {
        try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
        setTimeout(() => {
          try { if (isPidAlive(pid)) process.kill(pid, "SIGKILL"); } catch { /* ignore */ }
        }, 5000);
      },
      getTracker: () => tracker,
    };
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
      if (job.pidPoll) clearInterval(job.pidPoll);
      job.tailer.stop();
      job.child.kill("SIGTERM");
    }
    this.activeJobs.clear();
  }
}
