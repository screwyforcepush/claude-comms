/**
 * Harness Defaults — Shared parsing, validation, and resolution utilities
 *
 * Defines the shape of namespace-scoped harness+model configuration,
 * stored as a JSON string on namespace records in Convex.
 *
 * IMPORTANT: A copy of this logic lives in workflow-engine/convex/lib/harnessDefaults.ts
 * for use inside Convex functions (which can't import from outside convex/).
 * Keep both files in sync.
 */

export type Harness = "claude" | "codex" | "gemini";

export interface HarnessModelEntry {
  harness: Harness;
  model?: string; // Optional — omit to use harness default
}

export interface HarnessDefaults {
  default: HarnessModelEntry;
  [jobType: string]: HarnessModelEntry | HarnessModelEntry[]; // Array = fan-out
}

const VALID_HARNESSES: ReadonlySet<string> = new Set(["claude", "codex", "gemini"]);

/**
 * Default config that matches current behavior exactly.
 * Only Gemini gets an explicit model because buildCommand currently hardcodes auto-gemini-3.
 */
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

/**
 * Validate a HarnessDefaults object. Returns an array of error strings (empty = valid).
 */
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

/**
 * Parse a JSON string into a validated HarnessDefaults object.
 * Throws on invalid JSON or validation errors.
 */
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

/**
 * Resolve a job type to its harness+model config.
 * Resolution order: exact jobType key -> "default" key -> throws.
 * Returns a single entry or array (for fan-out).
 */
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
