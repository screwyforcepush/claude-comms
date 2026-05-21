#!/usr/bin/env python3
"""
PTY bridge for interactive Claude Code.

Reads the full prompt from stdin, spawns the provided Claude command under a
PTY, injects the prompt with bracketed paste, then drains the PTY until killed
or until Claude exits. Hook JSONL handling stays in the TypeScript executor.
"""
from __future__ import annotations

import argparse
import fcntl
import os
import pty
import select
import signal
import struct
import sys
import termios
import time

SPAWN_SETTLE_SECONDS = 3.0

child_pid: int | None = None
master_fd: int | None = None
terminating = False


def set_winsize(fd: int, rows: int = 40, cols: int = 120) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


def drain_pty(fd: int) -> None:
    try:
        while True:
            ready, _, _ = select.select([fd], [], [], 0)
            if not ready:
                return
            try:
                data = os.read(fd, 65536)
                if not data:
                    return
            except OSError:
                return
    except Exception:
        return


def inject_prompt(fd: int, prompt: str) -> None:
    os.write(fd, b"\x1b[200~")
    os.write(fd, prompt.encode("utf-8"))
    os.write(fd, b"\x1b[201~")
    time.sleep(0.3)
    os.write(fd, b"\r")


def terminate(signum: int, _frame: object) -> None:
    global terminating
    terminating = True
    if child_pid:
        try:
            os.kill(child_pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        time.sleep(0.5)
        try:
            os.kill(child_pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if master_fd is not None:
        try:
            os.close(master_fd)
        except OSError:
            pass
    raise SystemExit(128 + signum)


def main() -> int:
    global child_pid, master_fd

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--settle-seconds",
        type=float,
        default=SPAWN_SETTLE_SECONDS,
        help="Seconds to wait for Claude's TUI before injecting the prompt",
    )
    parser.add_argument("claude_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    claude_args = args.claude_args
    if claude_args and claude_args[0] == "--":
        claude_args = claude_args[1:]
    if not claude_args:
        print("missing Claude command", file=sys.stderr, flush=True)
        return 2

    prompt = sys.stdin.read()

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)

    pid, fd = pty.fork()
    if pid == 0:
        try:
            os.execvp(claude_args[0], claude_args)
        except FileNotFoundError:
            print(f"{claude_args[0]} binary not found", file=sys.stderr, flush=True)
            os._exit(127)

    child_pid = pid
    master_fd = fd
    set_winsize(fd)

    deadline = time.time() + args.settle_seconds
    while time.time() < deadline:
        drain_pty(fd)
        time.sleep(0.1)

    inject_prompt(fd, prompt)

    while not terminating:
        drain_pty(fd)
        try:
            wpid, status = os.waitpid(pid, os.WNOHANG)
            if wpid:
                if os.WIFEXITED(status):
                    return os.WEXITSTATUS(status)
                if os.WIFSIGNALED(status):
                    return 128 + os.WTERMSIG(status)
                return 1
        except ChildProcessError:
            return 0
        time.sleep(0.1)

    return 143


if __name__ == "__main__":
    raise SystemExit(main())
