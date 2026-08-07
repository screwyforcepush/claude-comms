import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export interface EngineIdentity {
  engineVersion?: string;
  engineGitSha?: string;
  source: "manifest" | "source-repo" | "unknown";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "..", "..", "..", "engine-manifest.json");
const setupPackagePath = join(__dirname, "..", "..", "..", "..", "packages", "setup-installer", "package.json");
const workflowDir = join(__dirname, "..");

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}

function gitSha(cwd: string): string | undefined {
  try {
    const result = spawnSync("git", ["-C", cwd, "rev-parse", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0) return undefined;
    const sha = result.stdout.trim();
    return sha || undefined;
  } catch {
    return undefined;
  }
}

export function getEngineIdentity(): EngineIdentity {
  const manifest = readJson(manifestPath);
  if (typeof manifest?.engineVersion === "string") {
    return {
      engineVersion: manifest.engineVersion,
      engineGitSha: typeof manifest.engineGitSha === "string" ? manifest.engineGitSha : undefined,
      source: "manifest",
    };
  }

  const setupPackage = readJson(setupPackagePath);
  const engineVersion = typeof setupPackage?.version === "string" ? setupPackage.version : undefined;
  const engineGitSha = gitSha(workflowDir);
  if (engineVersion !== undefined || engineGitSha !== undefined) {
    return { engineVersion, engineGitSha, source: "source-repo" };
  }

  return { source: "unknown" };
}
