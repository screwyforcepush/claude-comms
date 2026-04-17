/**
 * Harness Defaults — Convex-side copy of parsing/validation utilities
 *
 * Convex functions can't import from outside the convex/ directory,
 * so this is a manual sync of .agents/tools/workflow/lib/harness-defaults.ts.
 * Keep both files in sync.
 */

export type Harness = "claude" | "codex" | "gemini";

export interface HarnessModelEntry {
  harness: Harness;
  model?: string;
}

export interface HarnessDefaults {
  default: HarnessModelEntry;
  [jobType: string]: HarnessModelEntry | HarnessModelEntry[];
}

const VALID_HARNESSES: ReadonlySet<string> = new Set(["claude", "codex", "gemini"]);

export const DEFAULT_HARNESS_DEFAULTS: HarnessDefaults = {
  default: { harness: "claude" },
  implement: { harness: "claude" },
  review: [
    { harness: "claude" },
    { harness: "codex" },
    { harness: "gemini", model: "auto-gemini-3" },
  ],
  pm: { harness: "claude" },
  chat: { harness: "claude" },
};

export function validateHarnessDefaults(defaults: unknown): string[] {
  const errors: string[] = [];

  if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
    errors.push("harnessDefaults must be a non-null object");
    return errors;
  }

  const obj = defaults as Record<string, unknown>;

  if (!("default" in obj)) {
    errors.push('Missing required "default" key');
  }

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        errors.push(`"${key}": fan-out array must not be empty`);
        continue;
      }
      for (let i = 0; i < value.length; i++) {
        const entryErrors = validateEntry(value[i], `${key}[${i}]`);
        errors.push(...entryErrors);
      }
    } else {
      const entryErrors = validateEntry(value, key);
      errors.push(...entryErrors);
    }
  }

  return errors;
}

function validateEntry(entry: unknown, path: string): string[] {
  const errors: string[] = [];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    errors.push(`"${path}": must be an object with { harness, model? }`);
    return errors;
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.harness !== "string" || !VALID_HARNESSES.has(e.harness)) {
    errors.push(`"${path}": harness must be one of: claude, codex, gemini`);
  }
  if (e.model !== undefined && typeof e.model !== "string") {
    errors.push(`"${path}": model must be a string if provided`);
  }
  return errors;
}

export function parseHarnessDefaults(json: string): HarnessDefaults {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid harnessDefaults JSON: ${json.slice(0, 100)}`);
  }

  const errors = validateHarnessDefaults(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid harnessDefaults: ${errors.join("; ")}`);
  }

  return parsed as HarnessDefaults;
}

export function resolveJobType(
  defaults: HarnessDefaults,
  jobType: string
): HarnessModelEntry | HarnessModelEntry[] {
  if (jobType in defaults && jobType !== "default") {
    return defaults[jobType];
  }
  if ("default" in defaults) {
    return defaults.default;
  }
  throw new Error(`No config for job type "${jobType}" and no default defined`);
}
