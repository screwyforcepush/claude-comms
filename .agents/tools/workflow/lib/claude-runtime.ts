/**
 * Claude Code runtime levers for headless runs.
 *
 * Every Claude process the runner spawns is unattended: there is no later turn
 * after a backgrounded command, nobody to answer a prompt, no terminal to title.
 * Where the harness exposes a switch for one of those affordances, the runner
 * flips it here so the affordance leaves the model's tool surface entirely,
 * instead of CLAUDE.md arguing with the harness's own tool text.
 *
 * The set is the same for chat and crew jobs because what it corrects is the
 * runtime, not the role. The only per-job difference is retry posture.
 *
 * @see docs/project/spec/mental-model.md#mm-headless-runtime-levers
 */

/** Gap the runner's idle timer keeps above the harness Bash ceiling. */
export const BASH_CEILING_IDLE_MARGIN_MS = 60_000;

export interface ClaudeHeadlessEnvOptions {
  /**
   * Foreground Bash ceiling. Emitted as both the default and the max so one
   * blocking call can run the whole validate without the harness moving it
   * aside. Omit to leave the harness defaults in place (reflection forks).
   */
  bashTimeoutMs?: number;
  /**
   * Enables the harness's in-process retry on transient provider errors
   * (429/529) up to this bound. Crews set it: an interrupted crew job is work
   * lost. Chat jobs omit it: the user is the retry, and a silent thread is
   * worse than a failed one.
   */
  retryWatchdogMaxWaitMs?: number;
}

/**
 * Build the env vars applied to every headless Claude spawn.
 */
export function buildClaudeHeadlessEnv(
  options: ClaudeHeadlessEnvOptions = {}
): Record<string, string> {
  const env: Record<string, string> = {
    // Removes run_in_background from Bash and Agent, auto-backgrounding on
    // timeout, and the "foreground sleep is blocked; use Monitor" prompt text.
    // A command that outruns its timeout now stops with a legible "timed out".
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
    // A self-scheduled wakeup is another way a job says "I'll check later".
    CLAUDE_CODE_DISABLE_CRON: "1",
    // Auto-update landing mid-job on a runner host is a silent behaviour change.
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    // Skips the small-model request that names a terminal nobody is looking at.
    CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
  };

  if (options.bashTimeoutMs !== undefined) {
    const ms = String(options.bashTimeoutMs);
    env.BASH_DEFAULT_TIMEOUT_MS = ms;
    env.BASH_MAX_TIMEOUT_MS = ms;
  }

  if (options.retryWatchdogMaxWaitMs !== undefined) {
    env.CLAUDE_CODE_RETRY_WATCHDOG = "1";
    env.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS = String(options.retryWatchdogMaxWaitMs);
  }

  return env;
}

export interface BashCeilingConfig {
  idleTimeoutMs?: number;
  claudeBashTimeoutMs?: number;
}

/**
 * Resolve the harness Bash ceiling against the runner's idle timer.
 *
 * The two are guards on the same wedge (a command that never exits). The
 * runner's must sit above the harness's so the command dies at the harness
 * with "timed out" rather than at the runner as "stalled". An explicit ceiling
 * that is not below the idle timer is a config error and refuses to start,
 * because a drifted pair silently reintroduces the mute stall. When no ceiling
 * is configured it is derived as idle minus a margin, so existing installs
 * keep working without a config edit. With neither configured, the harness
 * defaults stand.
 */
export function resolveClaudeBashTimeoutMs(config: BashCeilingConfig): number | undefined {
  const { idleTimeoutMs, claudeBashTimeoutMs } = config;

  if (claudeBashTimeoutMs !== undefined) {
    if (!(claudeBashTimeoutMs > 0)) {
      throw new Error(`claudeBashTimeoutMs must be a positive number, got ${claudeBashTimeoutMs}`);
    }
    if (idleTimeoutMs !== undefined && claudeBashTimeoutMs >= idleTimeoutMs) {
      throw new Error(
        `claudeBashTimeoutMs (${claudeBashTimeoutMs}) must be below idleTimeoutMs (${idleTimeoutMs}): ` +
          "a Bash call that outlives the idle timer is killed by the runner as a stall instead of by the harness as a timeout"
      );
    }
    return claudeBashTimeoutMs;
  }

  if (idleTimeoutMs !== undefined && idleTimeoutMs > BASH_CEILING_IDLE_MARGIN_MS) {
    return idleTimeoutMs - BASH_CEILING_IDLE_MARGIN_MS;
  }

  return undefined;
}
