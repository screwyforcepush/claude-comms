import { buildClaudeMcpArgs } from "./claude-runtime.js";

export interface ClaudeForkArgsOptions {
  sessionId: string;
  model?: string;
  /** Host MCP config path; null for none, omit to resolve from the host. */
  mcpConfigPath?: string | null;
}

export function buildClaudeForkArgs(options: ClaudeForkArgsOptions): string[] {
  const args = [
    "--dangerously-skip-permissions",
    "--verbose",
    "--output-format",
    "stream-json",
    "--disable-slash-commands",
    ...buildClaudeMcpArgs(options.mcpConfigPath),
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  // Fork arguments intentionally omit disallowed tools.
  args.push("--resume", options.sessionId, "--fork-session", "-p");
  return args;
}
