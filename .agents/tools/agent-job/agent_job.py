#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Agent Job Adapter - Turns verbose CLI agent runs into file-backed jobs.

Supports Codex and Gemini CLI harnesses with:
- Stable job IDs (harness-native)
- File-backed logs and status
- Idle timeout enforcement
- Simple CLI API: spawn, status, list

Usage:
    uv run agent_job.py spawn --harness <gemini|codex> -- "<assignment>"
    uv run agent_job.py status <job_id>
    uv run agent_job.py list
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# =============================================================================
# Configuration
# =============================================================================

IDLE_TIMEOUT_SEC = int(os.environ.get("IDLE_TIMEOUT_SEC", "300"))


def get_jobs_root() -> Path:
    """Get the jobs root directory from environment or default."""
    if root := os.environ.get("AGENT_JOBS_ROOT"):
        return Path(root)

    tmpdir = os.environ.get("TMPDIR", "/tmp")
    user = os.environ.get("USER", "unknown")
    return Path(tmpdir) / "agent_jobs" / user


def get_consultant_template() -> str:
    """Load the consultant template from the template file."""
    template_path = Path(__file__).parent / "consultant_template.txt"
    if template_path.exists():
        return template_path.read_text()
    return ""


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class TokenStats:
    input: Optional[int] = None
    output: Optional[int] = None
    total: Optional[int] = None


@dataclass
class Completion:
    messages: list[str] = field(default_factory=list)
    final_message: Optional[str] = None
    tokens: TokenStats = field(default_factory=TokenStats)
    duration_ms: Optional[int] = None


@dataclass
class JobStatus:
    job_id: str
    harness: str
    agent_id: Optional[str] = None
    pid: Optional[int] = None
    logs: Optional[str] = None

    status: str = "running"  # running | complete | error | timeout
    status_reason: Optional[str] = None  # current activity or error reason

    start_time: Optional[str] = None
    last_event_time: Optional[str] = None
    end_time: Optional[str] = None

    operations: int = 0

    completion: Completion = field(default_factory=Completion)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "job_id": self.job_id,
            "harness": self.harness,
            "agent_id": self.agent_id,
            "pid": self.pid,
            "logs": self.logs,
            "status": self.status,
            "status_reason": self.status_reason,
            "start_time": self.start_time,
            "last_event_time": self.last_event_time,
            "end_time": self.end_time,
            "operations": self.operations,
            "completion": {
                "messages": self.completion.messages,
                "final_message": self.completion.final_message,
                "tokens": {
                    "input": self.completion.tokens.input,
                    "output": self.completion.tokens.output,
                    "total": self.completion.tokens.total,
                },
                "duration_ms": self.completion.duration_ms,
            }
        }

    @classmethod
    def from_dict(cls, data: dict) -> "JobStatus":
        """Create from dictionary."""
        completion_data = data.get("completion", {})
        tokens_data = completion_data.get("tokens", {})

        return cls(
            job_id=data["job_id"],
            harness=data["harness"],
            agent_id=data.get("agent_id"),
            pid=data.get("pid"),
            logs=data.get("logs"),
            status=data.get("status", "running"),
            status_reason=data.get("status_reason"),
            start_time=data.get("start_time"),
            last_event_time=data.get("last_event_time"),
            end_time=data.get("end_time"),
            operations=data.get("operations", 0),
            completion=Completion(
                messages=completion_data.get("messages", []),
                final_message=completion_data.get("final_message"),
                tokens=TokenStats(
                    input=tokens_data.get("input"),
                    output=tokens_data.get("output"),
                    total=tokens_data.get("total"),
                ),
                duration_ms=completion_data.get("duration_ms"),
            )
        )


# =============================================================================
# Utilities
# =============================================================================

def utc_now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso_time(iso_str: str) -> datetime:
    """Parse ISO time string to datetime."""
    # Handle 'Z' suffix
    if iso_str.endswith("Z"):
        iso_str = iso_str[:-1] + "+00:00"
    return datetime.fromisoformat(iso_str)


def atomic_write_json(path: Path, data: dict) -> None:
    """Write JSON atomically using temp file and rename."""
    tmp_path = path.with_suffix(".tmp")
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    tmp_path.rename(path)


def try_parse_json(line: str) -> Optional[dict]:
    """Try to parse a line as JSON, return None if not valid JSON."""
    line = line.strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


# =============================================================================
# Harness Event Handlers
# =============================================================================

class CodexEventHandler:
    """Handle Codex JSON stream events."""

    @staticmethod
    def extract_job_id(event: dict) -> Optional[str]:
        """Extract job ID from initial event."""
        if event.get("type") == "thread.started":
            return event.get("thread_id")
        return None

    @staticmethod
    def process_event(event: dict, status: JobStatus) -> None:
        """Process a Codex event and update status."""
        event_type = event.get("type", "")

        # Update status_reason based on current activity
        if event_type == "turn.started":
            status.status_reason = "thinking"

        elif event_type == "item.started":
            item = event.get("item", {})
            item_type = item.get("type")
            if item_type:
                status.status_reason = item_type  # reasoning, command_execution, todo_list

        elif event_type == "item.completed":
            item = event.get("item", {})
            item_type = item.get("type")
            if item_type:
                status.status_reason = item_type

            # Capture agent_message text
            if item_type == "agent_message":
                text = item.get("text", "")
                if text:
                    status.completion.messages.append(text)
                    status.completion.final_message = text

        # Handle turn completion with usage stats
        elif event_type == "turn.completed":
            status.status_reason = "completed"
            usage = event.get("usage", {})
            if usage:
                status.completion.tokens.input = usage.get("input_tokens")
                status.completion.tokens.output = usage.get("output_tokens")
                if status.completion.tokens.input and status.completion.tokens.output:
                    status.completion.tokens.total = (
                        status.completion.tokens.input + status.completion.tokens.output
                    )

    @staticmethod
    def is_completion_event(event: dict) -> bool:
        """Check if this event indicates completion."""
        return event.get("type") == "turn.completed"


class GeminiEventHandler:
    """Handle Gemini CLI JSON stream events."""

    def __init__(self):
        self._assistant_buffer = ""

    def extract_job_id(self, event: dict) -> Optional[str]:
        """Extract job ID from initial event."""
        if event.get("type") == "init":
            return event.get("session_id")
        return None

    def process_event(self, event: dict, status: JobStatus) -> None:
        """Process a Gemini event and update status."""
        event_type = event.get("type", "")

        # Update status_reason based on current activity
        if event_type == "tool_use":
            tool_name = event.get("tool_name")
            if tool_name:
                status.status_reason = tool_name  # run_shell_command, write_file, read_file, write_todos

        # Handle assistant messages (accumulate deltas)
        elif event_type == "message" and event.get("role") == "assistant":
            status.status_reason = "responding"
            content = event.get("content", "")
            if content:
                self._assistant_buffer += content

        # Handle result with stats
        elif event_type == "result":
            status.status_reason = "completed"
            stats = event.get("stats", {})
            if stats:
                status.completion.tokens.input = stats.get("input_tokens")
                status.completion.tokens.output = stats.get("output_tokens")
                status.completion.tokens.total = stats.get("total_tokens")
                status.completion.duration_ms = stats.get("duration_ms")

            # Finalize assistant message buffer
            if self._assistant_buffer:
                status.completion.final_message = self._assistant_buffer
                status.completion.messages = [self._assistant_buffer]

    def is_completion_event(self, event: dict) -> bool:
        """Check if this event indicates completion."""
        return event.get("type") == "result" and event.get("status") == "success"


# =============================================================================
# Job Manager
# =============================================================================

class JobManager:
    """Manage agent job lifecycle."""

    def __init__(self, jobs_root: Optional[Path] = None):
        self.jobs_root = jobs_root or get_jobs_root()
        self.jobs_root.mkdir(parents=True, exist_ok=True)

    def get_job_dir(self, job_id: str) -> Path:
        """Get the directory for a job."""
        return self.jobs_root / job_id

    def get_status_path(self, job_id: str) -> Path:
        """Get the status.json path for a job."""
        return self.get_job_dir(job_id) / "status.json"

    def get_log_path(self, job_id: str) -> Path:
        """Get the agent.log path for a job."""
        return self.get_job_dir(job_id) / "agent.log"

    def create_job_dir(self, job_id: str) -> Path:
        """Create job directory structure."""
        job_dir = self.get_job_dir(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir

    def write_status(self, status: JobStatus) -> None:
        """Write status.json atomically."""
        status_path = self.get_status_path(status.job_id)
        atomic_write_json(status_path, status.to_dict())

    def read_status(self, job_id: str) -> Optional[JobStatus]:
        """Read status.json for a job."""
        status_path = self.get_status_path(job_id)
        if not status_path.exists():
            return None

        with open(status_path) as f:
            data = json.load(f)
        return JobStatus.from_dict(data)

    def list_jobs(self) -> list[dict]:
        """List all jobs with summary info."""
        jobs = []

        if not self.jobs_root.exists():
            return jobs

        for job_dir in self.jobs_root.iterdir():
            if not job_dir.is_dir():
                continue

            status = self.read_status(job_dir.name)
            if not status:
                continue

            # Compute runtime and idle time
            now = datetime.now(timezone.utc)
            runtime_sec = 0.0
            idle_sec = 0.0
            if status.start_time:
                start = parse_iso_time(status.start_time)
                if status.end_time:
                    end = parse_iso_time(status.end_time)
                else:
                    end = now
                runtime_sec = (end - start).total_seconds()
            if status.last_event_time:
                last = parse_iso_time(status.last_event_time)
                idle_sec = (now - last).total_seconds()

            job_data = {
                "job_id": status.job_id,
                "harness": status.harness,
                "pid": status.pid,
                "logs": status.logs,
                "status": status.status,
                "status_reason": status.status_reason,
                "start_time": status.start_time,
                "last_event_time": status.last_event_time,
                "runtime_sec": round(runtime_sec, 1),
                "operations": status.operations,
            }

            # Only include idle_sec for running jobs
            if status.status == "running":
                job_data["idle_sec"] = round(idle_sec, 1)

            # Include end_time for finished jobs
            if status.end_time:
                job_data["end_time"] = status.end_time

            jobs.append(job_data)

        # Sort by start_time (newest first)
        jobs.sort(key=lambda x: x.get("start_time") or "", reverse=True)
        return jobs


# =============================================================================
# Spawn Command
# =============================================================================

def build_harness_command(harness: str, assignment: str) -> list[str]:
    """Build the command to run the harness."""
    if harness == "gemini":
        return [
            "gemini",
            "--yolo",
            "-m", "gemini-3-pro-preview",
            "--output-format", "stream-json",
            assignment,
        ]
    elif harness == "codex":
        return [
            "codex",
            "--yolo",
            "e",
            assignment,
            "--json",
        ]
    else:
        raise ValueError(f"Unknown harness: {harness}")


def _run_monitor_loop(
    process: subprocess.Popen,
    handler,
    manager: JobManager,
    harness: str,
    job_id: str,
    status: JobStatus,
    log_file,
    initial_lines: list[str],
) -> None:
    """
    Background monitor loop - runs in forked child process.

    Continues reading harness output, updating status.json, and enforcing idle timeout.
    """
    seen_completion = False
    last_event_time = time.time()

    try:
        # First, process any lines we already buffered before forking
        for line in initial_lines:
            event = try_parse_json(line)
            if event:
                last_event_time = time.time()
                status.operations += 1
                status.last_event_time = utc_now_iso()
                handler.process_event(event, status)
                if handler.is_completion_event(event):
                    seen_completion = True
                manager.write_status(status)

            if log_file:
                log_file.write(line)
                log_file.flush()

        # Continue reading from harness
        for line in iter(process.stdout.readline, ""):
            if not line:
                if process.poll() is not None:
                    break
                continue

            current_time = time.time()

            # Check idle timeout
            if (current_time - last_event_time) > IDLE_TIMEOUT_SEC:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

                status.status = "timeout"
                status.status_reason = "idle_timeout"
                status.end_time = utc_now_iso()
                manager.write_status(status)

                if log_file:
                    log_file.close()
                return

            # Try to parse as JSON
            event = try_parse_json(line)

            if event:
                last_event_time = current_time
                status.operations += 1
                status.last_event_time = utc_now_iso()

                handler.process_event(event, status)

                if handler.is_completion_event(event):
                    seen_completion = True

                manager.write_status(status)

            # Write to log file
            if log_file:
                log_file.write(line)
                log_file.flush()

        # Wait for process to complete
        exit_code = process.wait()

        # Finalize status
        status.end_time = utc_now_iso()

        if exit_code == 0 and seen_completion:
            status.status = "complete"
        else:
            status.status = "error"
            status.status_reason = f"process_exit_{exit_code}"

        manager.write_status(status)

    except Exception as e:
        if process.poll() is None:
            process.terminate()

        status.status = "error"
        status.status_reason = str(e)
        status.end_time = utc_now_iso()
        manager.write_status(status)

    finally:
        if log_file:
            log_file.close()


def spawn_job(harness: str, assignment: str) -> dict:
    """
    Spawn a new agent job.

    Starts the harness, waits for job ID, then forks to background.
    Parent returns immediately with job info; child continues monitoring.

    Returns dict with job_id, status_path, log_path on success.
    """
    manager = JobManager()

    # Build and start harness command
    cmd = build_harness_command(harness, assignment)

    process = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,  # Detach from TTY to survive fork
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,  # Line buffered
    )

    # Create appropriate event handler
    if harness == "gemini":
        handler = GeminiEventHandler()
    else:
        handler = CodexEventHandler()

    job_id: Optional[str] = None
    status: Optional[JobStatus] = None
    log_file = None
    buffered_lines: list[str] = []  # Lines read after job_id but before fork
    first_lines: list[str] = []  # Capture first few lines for error reporting

    try:
        # Read stdout until we get the job ID
        for line in iter(process.stdout.readline, ""):
            if not line:
                if process.poll() is not None:
                    break
                continue

            # Capture first few lines for debugging if we fail
            if len(first_lines) < 10:
                first_lines.append(line.rstrip())

            # Try to parse as JSON
            event = try_parse_json(line)

            if event and not job_id:
                job_id = handler.extract_job_id(event)

                if job_id:
                    # Initialize job
                    manager.create_job_dir(job_id)
                    log_file = open(manager.get_log_path(job_id), "w")

                    # Write the init line to log
                    log_file.write(line)
                    log_file.flush()

                    status = JobStatus(
                        job_id=job_id,
                        harness=harness,
                        agent_id=job_id,
                        pid=process.pid,
                        logs=str(manager.get_log_path(job_id)),
                        status="running",
                        status_reason="initializing",
                        start_time=utc_now_iso(),
                        last_event_time=utc_now_iso(),
                        operations=1,  # Count the init event
                    )

                    # Write initial status
                    manager.write_status(status)

                    # Build result for parent to return
                    result = {
                        "job_id": job_id,
                        "status_path": str(manager.get_status_path(job_id)),
                        "log_path": str(manager.get_log_path(job_id)),
                    }

                    # Fork: parent returns, child continues monitoring
                    pid = os.fork()

                    if pid > 0:
                        # Parent process - return immediately
                        # Don't close log_file or process handles here;
                        # the child owns them now
                        return result
                    else:
                        # Child process - detach and continue monitoring
                        # Create new session to detach from terminal
                        os.setsid()

                        # Redirect stdin/stdout/stderr to /dev/null
                        # (we communicate via status.json now)
                        devnull = os.open(os.devnull, os.O_RDWR)
                        os.dup2(devnull, sys.stdin.fileno())
                        os.dup2(devnull, sys.stdout.fileno())
                        os.dup2(devnull, sys.stderr.fileno())
                        os.close(devnull)

                        # Run the monitor loop
                        _run_monitor_loop(
                            process=process,
                            handler=handler,
                            manager=manager,
                            harness=harness,
                            job_id=job_id,
                            status=status,
                            log_file=log_file,
                            initial_lines=buffered_lines,
                        )
                        # Exit child process
                        os._exit(0)

            elif job_id:
                # We have a job_id but haven't forked yet - buffer the line
                # (This shouldn't normally happen as we fork immediately after job_id)
                buffered_lines.append(line)

        # If we get here without a job_id, the harness exited early
        if log_file:
            log_file.close()

        return {
            "error": "Failed to extract job ID from harness output",
            "exit_code": process.poll(),
            "output": first_lines,
        }

    except Exception as e:
        # Clean up on error
        if process.poll() is None:
            process.terminate()
        if log_file:
            log_file.close()

        if status:
            status.status = "error"
            status.status_reason = str(e)
            status.end_time = utc_now_iso()
            manager.write_status(status)

        raise


# =============================================================================
# Status Command
# =============================================================================

def get_status(job_id: str) -> dict:
    """Get status for a job with computed fields."""
    manager = JobManager()
    status = manager.read_status(job_id)

    if not status:
        return {"error": f"Job not found: {job_id}"}

    now = datetime.now(timezone.utc)

    # Compute runtime_sec
    runtime_sec = 0.0
    if status.start_time:
        start = parse_iso_time(status.start_time)
        if status.end_time:
            end = parse_iso_time(status.end_time)
        else:
            end = now
        runtime_sec = (end - start).total_seconds()

    # Compute idle_sec
    idle_sec = 0.0
    if status.last_event_time:
        last = parse_iso_time(status.last_event_time)
        idle_sec = (now - last).total_seconds()

    # Build result
    result = {
        "job_id": status.job_id,
        "harness": status.harness,
        "pid": status.pid,
        "logs": status.logs,
        "status": status.status,
        "status_reason": status.status_reason,
        "start_time": status.start_time,
        "last_event_time": status.last_event_time,
        "runtime_sec": round(runtime_sec, 1),
        "operations": status.operations,
    }

    # Only include idle_sec when job is still running
    if status.status == "running":
        result["idle_sec"] = round(idle_sec, 1)

    # Only include end_time and completion when job has finished
    if status.end_time:
        result["end_time"] = status.end_time
        result["completion"] = {
            "messages": status.completion.messages,
            "tokens": {
                "input": status.completion.tokens.input,
                "output": status.completion.tokens.output,
                "total": status.completion.tokens.total,
            },
            "duration_ms": status.completion.duration_ms,
        }

    return result


# =============================================================================
# List Command
# =============================================================================

def list_jobs() -> list[dict]:
    """List all jobs."""
    manager = JobManager()
    return manager.list_jobs()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Agent Job Adapter - Manage file-backed agent jobs"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # spawn command
    spawn_parser = subparsers.add_parser(
        "spawn",
        help="Spawn a new agent job"
    )
    spawn_parser.add_argument(
        "--harness",
        required=True,
        choices=["gemini", "codex"],
        help="Agent harness to use"
    )
    spawn_parser.add_argument(
        "--consultant",
        action="store_true",
        help="Append consultant template (WORKFLOW + TEAMWORK) to assignment"
    )
    spawn_parser.add_argument(
        "assignment",
        nargs=argparse.REMAINDER,
        help="Assignment text (after --)"
    )

    # status command
    status_parser = subparsers.add_parser(
        "status",
        help="Get status of a job"
    )
    status_parser.add_argument(
        "job_id",
        help="Job ID to query"
    )

    # list command
    subparsers.add_parser(
        "list",
        help="List all jobs"
    )

    args = parser.parse_args()

    try:
        if args.command == "spawn":
            # Handle assignment parsing (skip leading --)
            assignment_parts = args.assignment
            if assignment_parts and assignment_parts[0] == "--":
                assignment_parts = assignment_parts[1:]

            if not assignment_parts:
                print(json.dumps({"error": "No assignment provided"}))
                sys.exit(1)

            assignment = " ".join(assignment_parts)

            # Append consultant template if --consultant flag is set
            if args.consultant:
                template = get_consultant_template()
                if template:
                    assignment = assignment + "\n\n" + template

            result = spawn_job(args.harness, assignment)

            if "error" in result:
                print(json.dumps(result, indent=2))
                sys.exit(1)

            # Print user-friendly message with status command
            job_id = result.get("job_id", "")
            script_path = sys.argv[0]
            print(f'Agent running. Check status with: `uv run {script_path} status {job_id}`')
            sys.stdout.flush()

        elif args.command == "status":
            result = get_status(args.job_id)
            print(json.dumps(result, indent=2))

            if "error" in result:
                sys.exit(1)

        elif args.command == "list":
            result = list_jobs()
            print(json.dumps(result, indent=2))

    except KeyboardInterrupt:
        print(json.dumps({"error": "Interrupted"}))
        sys.exit(130)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
