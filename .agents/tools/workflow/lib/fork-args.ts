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

  // Fork arguments intentionally omit disallowed tools.
  args.push("--resume", options.sessionId, "--fork-session", "-p");
  return args;
}
