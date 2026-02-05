/**
 * File-based Job Tracking
 *
 * Compatible with agent_monitor.py TUI. Writes status.json and agent.log
 * files in the same format as agent_job.py for process-level monitoring.
 *
 * This is separate from Convex tracking - used for debugging/monitoring
 * when you need to see verbose JSON streams and process-level telemetry.
 *
 * Enhanced to support:
 * - read_position tracking for recovery after runner restart
 * - Orphan detection and reconciliation
 * - Reading status from disk
 */

import {
  writeFileSync,
  mkdirSync,
  appendFileSync,
  renameSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface FileJobStatus {
  job_id: string;
  harness: string;
  agent_id: string | null;
  pid: number | null;
  logs: string | null;
  status: "running" | "complete" | "error" | "timeout";
  status_reason: string | null;
  start_time: string | null;
  last_event_time: string | null;
  end_time: string | null;
  operations: number;
  /** Byte position in log file that has been processed (for recovery) */
  read_position?: number;
  completion: {
    messages: string[];
    final_message: string | null;
    tokens: {
      input: number | null;
      output: number | null;
      total: number | null;
    };
    duration_ms: number | null;
  };
}

export interface JobPaths {
  statusPath: string;
  logPath: string;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the root directory for job files.
 * Respects AGENT_JOBS_ROOT env var, defaults to /tmp/agent_jobs/$USER
 */
export function getJobsRoot(): string {
  if (process.env.AGENT_JOBS_ROOT) {
    return process.env.AGENT_JOBS_ROOT;
  }
  const user = process.env.USER || "unknown";
  return join(tmpdir(), "agent_jobs", user);
}

/**
 * Get UTC timestamp in ISO format (matches agent_job.py format)
 */
export function utcNowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

/**
 * Get the directory path for a specific job
 */
export function getJobDir(jobId: string): string {
  return join(getJobsRoot(), jobId);
}

/**
 * Check if a process is alive by PID
 */
export function isPidAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0); // Signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}

/**
 * List all job directories in the jobs root
 */
export function listJobDirs(): string[] {
  const root = getJobsRoot();
  if (!existsSync(root)) return [];

  return readdirSync(root).filter((name) => {
    const dir = join(root, name);
    try {
      return statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * Read status.json for a job, returns null if not found or invalid
 */
export function readJobStatus(jobId: string): FileJobStatus | null {
  const statusPath = join(getJobDir(jobId), "status.json");
  if (!existsSync(statusPath)) return null;

  try {
    const content = readFileSync(statusPath, "utf-8");
    return JSON.parse(content) as FileJobStatus;
  } catch {
    return null;
  }
}

/**
 * Get paths for a job (without creating the directory)
 */
export function getJobPaths(jobId: string): JobPaths {
  const jobDir = getJobDir(jobId);
  return {
    statusPath: join(jobDir, "status.json"),
    logPath: join(jobDir, "agent.log"),
  };
}

/**
 * Find orphaned jobs: status="running" but process is dead
 */
export function findOrphanedJobs(): Array<{
  jobId: string;
  status: FileJobStatus;
  paths: JobPaths;
}> {
  const orphans: Array<{ jobId: string; status: FileJobStatus; paths: JobPaths }> = [];

  for (const jobId of listJobDirs()) {
    const status = readJobStatus(jobId);
    if (!status) continue;

    // Only care about "running" jobs
    if (status.status !== "running") continue;

    // Check if process is still alive
    if (!isPidAlive(status.pid)) {
      orphans.push({
        jobId,
        status,
        paths: getJobPaths(jobId),
      });
    }
  }

  return orphans;
}

// ============================================================================
// Job Status Management
// ============================================================================

/**
 * Create initial job status object
 */
export function createFileJobStatus(
  jobId: string,
  harness: string,
  pid: number
): FileJobStatus {
  return {
    job_id: jobId,
    harness,
    agent_id: jobId,
    pid,
    logs: null, // Set after dir creation
    status: "running",
    status_reason: "initializing",
    start_time: utcNowIso(),
    last_event_time: utcNowIso(),
    end_time: null,
    operations: 0,
    read_position: 0,
    completion: {
      messages: [],
      final_message: null,
      tokens: { input: null, output: null, total: null },
      duration_ms: null,
    },
  };
}

/**
 * Create job directory and return paths to status.json and agent.log
 */
export function ensureJobDir(jobId: string): JobPaths {
  const jobDir = getJobDir(jobId);
  mkdirSync(jobDir, { recursive: true });
  return {
    statusPath: join(jobDir, "status.json"),
    logPath: join(jobDir, "agent.log"),
  };
}

/**
 * Write status.json atomically (via temp file + rename)
 */
export function writeJobStatus(statusPath: string, status: FileJobStatus): void {
  const tmpPath = statusPath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(status, null, 2));
  renameSync(tmpPath, statusPath);
}

/**
 * Append a line to the agent.log file
 */
export function appendToLog(logPath: string, line: string): void {
  appendFileSync(logPath, line + "\n");
}

// ============================================================================
// High-level Job Tracker
// ============================================================================

/**
 * JobTracker manages file-based status for a single job.
 * Use this to track process-level telemetry alongside Convex.
 */
export class JobTracker {
  private status: FileJobStatus;
  private paths: JobPaths;

  constructor(jobId: string, harness: string, pid: number) {
    this.paths = ensureJobDir(jobId);
    this.status = createFileJobStatus(jobId, harness, pid);
    this.status.logs = this.paths.logPath;
    this.writeStatus();
  }

  /**
   * Create a JobTracker from an existing status on disk.
   * Used for recovery/reconciliation of orphaned jobs.
   */
  static fromExisting(
    jobId: string,
    status: FileJobStatus,
    paths: JobPaths
  ): JobTracker {
    const tracker = Object.create(JobTracker.prototype) as JobTracker;
    tracker.status = { ...status };
    tracker.paths = paths;
    return tracker;
  }

  /** Update status reason (current activity) */
  updateStatusReason(reason: string): void {
    this.status.status_reason = reason;
    this.status.last_event_time = utcNowIso();
    this.writeStatus();
  }

  /** Increment operation count */
  incrementOperations(): void {
    this.status.operations++;
    this.status.last_event_time = utcNowIso();
    this.writeStatus();
  }

  /** Record an event (increments ops, updates timestamp, optionally updates reason) */
  recordEvent(statusReason?: string): void {
    this.status.operations++;
    this.status.last_event_time = utcNowIso();
    if (statusReason) {
      this.status.status_reason = statusReason;
    }
    this.writeStatus();
  }

  /** Append raw JSON line to log file */
  logLine(line: string): void {
    appendToLog(this.paths.logPath, line);
  }

  /** Mark job as complete */
  complete(finalMessage?: string): void {
    this.status.status = "complete";
    this.status.status_reason = "completed";
    this.status.end_time = utcNowIso();
    if (finalMessage) {
      this.status.completion.final_message = finalMessage;
      this.status.completion.messages.push(finalMessage);
    }
    this.writeStatus();
  }

  /** Mark job as failed */
  fail(reason: string): void {
    this.status.status = "error";
    this.status.status_reason = reason;
    this.status.end_time = utcNowIso();
    this.writeStatus();
  }

  /** Mark job as timed out */
  timeout(): void {
    this.status.status = "timeout";
    this.status.status_reason = "idle_timeout";
    this.status.end_time = utcNowIso();
    this.writeStatus();
  }

  /** Update token stats */
  updateTokens(input: number | null, output: number | null): void {
    this.status.completion.tokens.input = input;
    this.status.completion.tokens.output = output;
    if (input != null && output != null) {
      this.status.completion.tokens.total = input + output;
    }
    this.writeStatus();
  }

  /** Get current status */
  getStatus(): FileJobStatus {
    return { ...this.status };
  }

  /** Get log path */
  getLogPath(): string {
    return this.paths.logPath;
  }

  /** Get status path */
  getStatusPath(): string {
    return this.paths.statusPath;
  }

  /** Get current read position in log file */
  getReadPosition(): number {
    return this.status.read_position ?? 0;
  }

  /** Update read position (bytes processed in log file) */
  setReadPosition(position: number): void {
    this.status.read_position = position;
    this.writeStatus();
  }

  /** Get job ID */
  getJobId(): string {
    return this.status.job_id;
  }

  /** Get harness type */
  getHarness(): string {
    return this.status.harness;
  }

  /** Check if job is in a terminal state */
  isTerminal(): boolean {
    return this.status.status !== "running";
  }

  private writeStatus(): void {
    writeJobStatus(this.paths.statusPath, this.status);
  }
}
