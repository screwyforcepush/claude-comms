#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Agent Job Monitor - TUI for monitoring agent jobs.

Real-time display of all agent jobs with status indicators.
Similar to `top` but for agent jobs.

Usage:
    uv run agent_monitor.py [--interval SECONDS]
"""

import argparse
import curses
import json
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


@dataclass
class JobInfo:
    job_id: str
    harness: str
    status: str
    status_reason: Optional[str]
    runtime_sec: float
    idle_sec: Optional[float]
    operations: int
    start_time: Optional[str]
    logs: Optional[str] = None
    pid: Optional[int] = None


def get_jobs() -> list[JobInfo]:
    """Fetch current job list via agent_job.py"""
    script_dir = Path(__file__).parent
    agent_job = script_dir / "agent_job.py"

    try:
        result = subprocess.run(
            ["uv", "run", str(agent_job), "list"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return []

        jobs_data = json.loads(result.stdout)
        jobs = []
        for job in jobs_data:
            jobs.append(JobInfo(
                job_id=job.get("job_id", ""),
                harness=job.get("harness", ""),
                status=job.get("status", "unknown"),
                status_reason=job.get("status_reason"),
                runtime_sec=job.get("runtime_sec", 0),
                idle_sec=job.get("idle_sec"),
                operations=job.get("operations", 0),
                start_time=job.get("start_time"),
                logs=job.get("logs"),
                pid=job.get("pid"),
            ))
        return jobs
    except Exception:
        return []


def read_log_file(log_path: str) -> list[str]:
    """Read log file and return lines"""
    try:
        with open(log_path, "r") as f:
            return f.readlines()
    except Exception:
        return ["(Unable to read log file)"]


def get_job_status(job_id: str) -> Optional[dict]:
    """Fetch detailed status for a single job"""
    script_dir = Path(__file__).parent
    agent_job = script_dir / "agent_job.py"

    try:
        result = subprocess.run(
            ["uv", "run", str(agent_job), "status", job_id],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except Exception:
        return None


def kill_job(pid: int) -> bool:
    """Kill a job by PID. Returns True if successful."""
    if not pid:
        return False
    try:
        os.kill(pid, signal.SIGTERM)
        # Give it a moment, then force kill if still running
        time.sleep(0.5)
        try:
            os.kill(pid, 0)  # Check if still running
            os.kill(pid, signal.SIGKILL)  # Force kill
        except ProcessLookupError:
            pass  # Already dead
        return True
    except ProcessLookupError:
        return True  # Already dead
    except PermissionError:
        return False
    except Exception:
        return False


def format_duration(seconds: float) -> str:
    """Format seconds as human-readable duration"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m{secs:02d}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h{mins:02d}m"


def format_time_ago(iso_time: Optional[str]) -> str:
    """Format ISO time as 'X ago'"""
    if not iso_time:
        return "?"

    try:
        if iso_time.endswith("Z"):
            iso_time = iso_time[:-1] + "+00:00"
        dt = datetime.fromisoformat(iso_time)
        now = datetime.now(timezone.utc)
        delta = (now - dt).total_seconds()
        return format_duration(delta) + " ago"
    except Exception:
        return "?"


def truncate(s: str, max_len: int) -> str:
    """Truncate string with ellipsis if too long"""
    if len(s) <= max_len:
        return s
    return s[:max_len-1] + "…"


def wrap_line(line: str, width: int, max_lines: int = 5) -> list[str]:
    """Wrap a line to fit within width, max number of wrapped lines.

    Returns a list of display lines. If content exceeds max_lines,
    the last line is truncated with ellipsis.
    """
    line = line.rstrip('\n\r')
    if not line:
        return [""]

    if len(line) <= width:
        return [line]

    wrapped = []
    remaining = line

    while remaining and len(wrapped) < max_lines:
        if len(remaining) <= width:
            wrapped.append(remaining)
            remaining = ""
        else:
            # Check if this will be the last allowed line
            if len(wrapped) == max_lines - 1:
                # Truncate with ellipsis
                wrapped.append(remaining[:width-1] + "…")
                remaining = ""
            else:
                wrapped.append(remaining[:width])
                remaining = remaining[width:]

    return wrapped if wrapped else [""]


class Monitor:
    def __init__(self, stdscr, interval: float = 2.0):
        self.stdscr = stdscr
        self.interval = interval
        self.jobs: list[JobInfo] = []
        self.selected_idx = 0
        self.scroll_offset = 0
        self.show_log = False
        self.log_job: Optional[JobInfo] = None
        self.log_lines: list[str] = []
        self.log_scroll = 0
        self.log_display_line_count = 0  # Cached count of wrapped display lines

        # Setup colors
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_GREEN, -1)   # complete
        curses.init_pair(2, curses.COLOR_YELLOW, -1)  # running
        curses.init_pair(3, curses.COLOR_RED, -1)     # error/timeout
        curses.init_pair(4, curses.COLOR_CYAN, -1)    # header
        curses.init_pair(5, curses.COLOR_MAGENTA, -1) # selected
        curses.init_pair(6, curses.COLOR_WHITE, -1)   # normal

        # Hide cursor
        curses.curs_set(0)

        # Non-blocking input
        self.stdscr.nodelay(True)
        self.stdscr.keypad(True)

    def get_status_color(self, status: str) -> int:
        """Get color pair for status"""
        if status == "complete":
            return curses.color_pair(1)
        elif status == "running":
            return curses.color_pair(2)
        elif status in ("error", "timeout"):
            return curses.color_pair(3)
        return curses.color_pair(6)

    def get_status_indicator(self, status: str) -> str:
        """Get status indicator symbol"""
        if status == "complete":
            return "✓"
        elif status == "running":
            return "●"
        elif status == "error":
            return "✗"
        elif status == "timeout":
            return "⏱"
        return "?"

    def draw_header(self):
        """Draw the header bar"""
        height, width = self.stdscr.getmaxyx()

        # Title
        title = " Agent Job Monitor "
        now = datetime.now().strftime("%H:%M:%S")
        header = f"{'─' * 2}{title}{'─' * (width - len(title) - len(now) - 6)} {now} ─"

        self.stdscr.attron(curses.color_pair(4) | curses.A_BOLD)
        self.stdscr.addnstr(0, 0, header, width - 1)
        self.stdscr.attroff(curses.color_pair(4) | curses.A_BOLD)

    def draw_column_headers(self, y: int):
        """Draw column headers"""
        height, width = self.stdscr.getmaxyx()

        # Column layout
        headers = f"{'ST':<3} {'HARNESS':<7} {'PID':<7} {'JOB ID':<20} {'STATUS':<26} {'STARTED':<10} {'RUNTIME':<8} {'OPS':<4}"

        self.stdscr.attron(curses.color_pair(4) | curses.A_REVERSE)
        self.stdscr.addnstr(y, 0, headers.ljust(width - 1), width - 1)
        self.stdscr.attroff(curses.color_pair(4) | curses.A_REVERSE)

    def draw_job_row(self, y: int, job: JobInfo, selected: bool):
        """Draw a single job row"""
        height, width = self.stdscr.getmaxyx()

        indicator = self.get_status_indicator(job.status)
        color = self.get_status_color(job.status)

        # Build status reason display
        reason = job.status_reason or job.status
        if job.status == "running" and job.idle_sec is not None:
            reason = f"{reason} (idle {format_duration(job.idle_sec)})"

        # Format start time as HH:MM:SS
        start_display = "?"
        if job.start_time:
            try:
                # Parse ISO time and format as local time
                ts = job.start_time
                if ts.endswith("Z"):
                    ts = ts[:-1] + "+00:00"
                dt = datetime.fromisoformat(ts)
                start_display = dt.strftime("%H:%M:%S")
            except Exception:
                start_display = "?"

        # Format PID
        pid_display = str(job.pid) if job.pid else "?"

        # Format row
        job_id_short = job.job_id[:18] if len(job.job_id) > 18 else job.job_id
        row = f" {indicator}  {job.harness:<7} {pid_display:<7} {job_id_short:<20} {truncate(reason, 24):<26} {start_display:<10} {format_duration(job.runtime_sec):<8} {job.operations:<4}"

        if selected:
            self.stdscr.attron(curses.color_pair(5) | curses.A_REVERSE)
            self.stdscr.addnstr(y, 0, row.ljust(width - 1), width - 1)
            self.stdscr.attroff(curses.color_pair(5) | curses.A_REVERSE)
        else:
            self.stdscr.attron(color)
            self.stdscr.addnstr(y, 0, row.ljust(width - 1), width - 1)
            self.stdscr.attroff(color)

    def draw_job_list(self):
        """Draw the job list"""
        height, width = self.stdscr.getmaxyx()

        # Draw column headers
        self.draw_column_headers(2)

        # Calculate visible area
        list_start = 3
        list_height = height - 5  # Leave room for header, columns, and footer

        # Adjust scroll offset
        if self.selected_idx < self.scroll_offset:
            self.scroll_offset = self.selected_idx
        elif self.selected_idx >= self.scroll_offset + list_height:
            self.scroll_offset = self.selected_idx - list_height + 1

        # Draw visible jobs
        for i, job in enumerate(self.jobs[self.scroll_offset:self.scroll_offset + list_height]):
            actual_idx = i + self.scroll_offset
            y = list_start + i
            if y >= height - 2:
                break
            self.draw_job_row(y, job, actual_idx == self.selected_idx)

        # Show if more items above/below
        if self.scroll_offset > 0:
            self.stdscr.addstr(list_start, width - 3, "▲")
        if self.scroll_offset + list_height < len(self.jobs):
            self.stdscr.addstr(min(list_start + list_height - 1, height - 3), width - 3, "▼")

    def draw_log_view(self):
        """Draw scrollable log view for selected job"""
        if not self.log_job:
            return

        height, width = self.stdscr.getmaxyx()

        # Header with job info
        job = self.log_job
        indicator = self.get_status_indicator(job.status)
        color = self.get_status_color(job.status)

        # Job header line
        self.stdscr.attron(curses.A_BOLD)
        header = f" {indicator} {job.harness} | {job.job_id} | {job.status_reason or job.status} | {format_duration(job.runtime_sec)}"
        self.stdscr.addnstr(2, 0, header, width - 1)
        self.stdscr.attroff(curses.A_BOLD)

        # Log file path
        self.stdscr.attron(curses.color_pair(4))
        self.stdscr.addnstr(3, 0, f" Log: {job.logs or '?'}", width - 1)
        self.stdscr.attroff(curses.color_pair(4))

        # Separator
        self.stdscr.addnstr(4, 0, "─" * (width - 1), width - 1)

        # Log content area
        log_start = 5
        log_height = height - log_start - 2
        content_width = width - 4  # Leave margin for wrap indicator

        # Build display lines (wrapped) from source lines
        display_lines = []
        for source_line in self.log_lines:
            wrapped = wrap_line(source_line, content_width, max_lines=5)
            display_lines.extend(wrapped)

        # Cache display line count for scroll handling
        self.log_display_line_count = len(display_lines)

        # Clamp scroll to display lines
        max_scroll = max(0, len(display_lines) - log_height)
        self.log_scroll = max(0, min(self.log_scroll, max_scroll))

        # Draw display lines
        visible_lines = display_lines[self.log_scroll:self.log_scroll + log_height]
        for i, line in enumerate(visible_lines):
            y = log_start + i
            if y >= height - 2:
                break
            self.stdscr.addnstr(y, 1, line, width - 2)

        # Scroll indicators
        if self.log_scroll > 0:
            self.stdscr.attron(curses.color_pair(4))
            self.stdscr.addstr(log_start, width - 2, "▲")
            self.stdscr.attroff(curses.color_pair(4))
        if self.log_scroll + log_height < len(display_lines):
            self.stdscr.attron(curses.color_pair(4))
            self.stdscr.addstr(min(log_start + log_height - 1, height - 3), width - 2, "▼")
            self.stdscr.attroff(curses.color_pair(4))

        # Line count
        total = len(display_lines)
        showing = f"Lines {self.log_scroll + 1}-{min(self.log_scroll + log_height, total)} of {total}"
        self.stdscr.attron(curses.color_pair(4))
        self.stdscr.addnstr(height - 2, width - len(showing) - 2, showing, len(showing))
        self.stdscr.attroff(curses.color_pair(4))

    def draw_footer(self):
        """Draw the footer with help"""
        height, width = self.stdscr.getmaxyx()

        # Summary
        running = sum(1 for j in self.jobs if j.status == "running")
        complete = sum(1 for j in self.jobs if j.status == "complete")
        failed = sum(1 for j in self.jobs if j.status in ("error", "timeout"))

        summary = f" Jobs: {len(self.jobs)} total, {running} running, {complete} complete, {failed} failed "

        # Help
        if self.show_log:
            help_text = " [↑↓/PgUp/PgDn] Scroll  [r] Reload  [ESC] Back  [q] Quit "
        else:
            help_text = " [↑↓] Select  [Enter] Log  [x] Kill  [r] Refresh  [q] Quit "

        # Draw footer bar
        footer = f"{summary}{'─' * (width - len(summary) - len(help_text) - 2)}{help_text}"

        self.stdscr.attron(curses.color_pair(4))
        self.stdscr.addnstr(height - 1, 0, footer, width - 1)
        self.stdscr.attroff(curses.color_pair(4))

    def draw(self):
        """Draw the full screen"""
        self.stdscr.clear()

        self.draw_header()

        if self.show_log:
            self.draw_log_view()
        else:
            self.draw_job_list()

        self.draw_footer()

        self.stdscr.refresh()

    def handle_input(self) -> bool:
        """Handle keyboard input. Returns False to quit."""
        try:
            key = self.stdscr.getch()
        except Exception:
            return True

        if key == -1:
            return True

        if key == ord('q') or key == ord('Q'):
            return False

        if self.show_log:
            # Log view controls
            height, _ = self.stdscr.getmaxyx()
            log_height = height - 7  # Visible log lines

            if key == 27 or key == curses.KEY_BACKSPACE:  # ESC or Backspace
                self.show_log = False
                self.log_job = None
                self.log_lines = []
                self.log_scroll = 0
            elif key == curses.KEY_UP or key == ord('k'):
                self.log_scroll = max(0, self.log_scroll - 1)
            elif key == curses.KEY_DOWN or key == ord('j'):
                self.log_scroll += 1
            elif key == curses.KEY_PPAGE:  # Page Up
                self.log_scroll = max(0, self.log_scroll - log_height)
            elif key == curses.KEY_NPAGE:  # Page Down
                self.log_scroll += log_height
            elif key == curses.KEY_HOME:
                self.log_scroll = 0
            elif key == curses.KEY_END:
                self.log_scroll = max(0, self.log_display_line_count - log_height)
            elif key == ord('r') or key == ord('R'):
                # Reload log file
                if self.log_job and self.log_job.logs:
                    self.log_lines = read_log_file(self.log_job.logs)
        else:
            # Job list controls
            if key == curses.KEY_UP or key == ord('k'):
                self.selected_idx = max(0, self.selected_idx - 1)
            elif key == curses.KEY_DOWN or key == ord('j'):
                if self.selected_idx < len(self.jobs) - 1:
                    self.selected_idx += 1
            elif key == ord('\n') or key == curses.KEY_ENTER:
                if self.jobs and 0 <= self.selected_idx < len(self.jobs):
                    job = self.jobs[self.selected_idx]
                    self.show_log = True
                    self.log_job = job
                    self.log_scroll = 0
                    if job.logs:
                        self.log_lines = read_log_file(job.logs)
                    else:
                        self.log_lines = ["(No log file available)"]
            elif key == ord('r') or key == ord('R'):
                self.jobs = get_jobs()
            elif key == ord('x') or key == ord('X'):
                # Kill selected job
                if self.jobs and 0 <= self.selected_idx < len(self.jobs):
                    job = self.jobs[self.selected_idx]
                    if job.pid and job.status == "running":
                        kill_job(job.pid)
                        # Refresh job list after kill
                        time.sleep(0.2)
                        self.jobs = get_jobs()
            elif key == curses.KEY_HOME:
                self.selected_idx = 0
            elif key == curses.KEY_END:
                self.selected_idx = max(0, len(self.jobs) - 1)

        return True

    def run(self):
        """Main loop"""
        last_refresh = 0

        while True:
            # Refresh data periodically
            now = time.time()
            if now - last_refresh >= self.interval:
                self.jobs = get_jobs()
                # Clamp selected index
                if self.jobs:
                    self.selected_idx = min(self.selected_idx, len(self.jobs) - 1)
                else:
                    self.selected_idx = 0
                last_refresh = now

            # Draw
            self.draw()

            # Handle input
            if not self.handle_input():
                break

            # Small sleep to reduce CPU usage
            time.sleep(0.05)


def main(stdscr, interval: float):
    """Main entry point for curses"""
    monitor = Monitor(stdscr, interval)
    monitor.run()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent Job Monitor TUI")
    parser.add_argument(
        "--interval", "-i",
        type=float,
        default=2.0,
        help="Refresh interval in seconds (default: 2.0)"
    )
    args = parser.parse_args()

    try:
        curses.wrapper(lambda stdscr: main(stdscr, args.interval))
    except KeyboardInterrupt:
        pass
