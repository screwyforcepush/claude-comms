export interface ClaudeForkArgsOptions {
  sessionId: string;
  model?: string;
}

export function buildClaudeForkArgs(options: ClaudeForkArgsOptions): string[] {
  const args = [
    "--dangerously-skip-permissions",
    "--verbose",
    "--output-format",
    "stream-json",
    "--disable-slash-commands",
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  // fork-args intentionally omits disallowed tools; notify-spawn adds its own.
  args.push("--resume", options.sessionId, "--fork-session", "-p");
  return args;
}
