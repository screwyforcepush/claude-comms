#!/usr/bin/env npx tsx
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readStatus, runValidate, type GateProgress, type ValidateConfig } from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.json");

interface ParsedArgs {
  help: boolean;
  status: boolean;
  gates?: string[];
}

function loadConfig(): ValidateConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as ValidateConfig;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { help: false, status: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--status") {
      parsed.status = true;
    } else if (arg === "--gates") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error("--gates requires a comma-separated gate list");
      }
      parsed.gates = value.split(",").map((name) => name.trim()).filter(Boolean);
      if (parsed.gates.length === 0) {
        throw new Error("--gates requires at least one gate name");
      }
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  return parsed;
}

function help(config: ValidateConfig): string {
  const gates = config.gates.map((gate) => `  - ${gate.name}: ${gate.command}`).join("\n");
  return `Validate configured repository quality gates.

Usage:
  npx tsx .agents/tools/validate/cli.ts
  npx tsx .agents/tools/validate/cli.ts --gates lint,test
  npx tsx .agents/tools/validate/cli.ts --status
  npx tsx .agents/tools/validate/cli.ts --help

Options:
  --gates <list>  Run only the exact comma-separated gate subset.
  --status        Emit the latest result JSON without running gates.
  --help, -h      Show this help.

Configured gates:
${gates || "  (none)"}
`;
}

function validateRequestedGates(config: ValidateConfig, requested?: string[]): void {
  if (!requested) return;
  const known = new Set(config.gates.map((gate) => gate.name));
  const unknown = requested.filter((gate) => !known.has(gate));
  if (unknown.length > 0) {
    throw new Error(`unknown gate(s): ${unknown.join(", ")}`);
  }
}

function progressLine(progress: GateProgress): string {
  const seconds = (progress.durationMs / 1_000).toFixed(1);
  if (progress.status === "passed") {
    return `pass ${progress.gate} (${seconds}s)`;
  }
  const reason = progress.signal ? `signal ${progress.signal}` : `exit ${progress.exitCode}`;
  return `fail ${progress.gate} (${reason}, ${seconds}s)`;
}

async function main(argv: string[]): Promise<number> {
  const config = loadConfig();
  const args = parseArgs(argv);

  if (args.help) {
    process.stderr.write(help(config));
    return 0;
  }

  if (args.status) {
    process.stdout.write(`${JSON.stringify(readStatus(config), null, 2)}\n`);
    return 0;
  }

  validateRequestedGates(config, args.gates);

  const repoRoot = resolve(__dirname, "../../..");
  const result = await runValidate(config, {
    gates: args.gates,
    repoRoot,
    onProgress: (progress) => {
      process.stderr.write(`${progressLine(progress)}\n`);
    },
    onWarning: (message) => {
      process.stderr.write(`warning: ${message}\n`);
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => {
    process.exit(code);
  }).catch((error) => {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
