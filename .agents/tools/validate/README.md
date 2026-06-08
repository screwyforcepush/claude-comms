# Validate CLI

Runs configured repository quality gates concurrently and returns one machine-readable JSON result.

## Usage

```bash
npx tsx .agents/tools/validate/cli.ts
npx tsx .agents/tools/validate/cli.ts --gates lint,test
npx tsx .agents/tools/validate/cli.ts --status
npx tsx .agents/tools/validate/cli.ts --help
```

Default execution runs every gate from `config.json`, blocks until the slowest gate finishes, writes progress to stderr, and writes exactly one JSON document to stdout. The process exits `0` only when every selected gate exits `0`.

`--status` reads `/tmp/claude-comms-validate/result.json` and does not run gates or take the lock. If no prior result exists it emits:

```json
{ "status": "none" }
```

## Result Shape

```json
{
  "ok": false,
  "runId": "1733664000000-7af3c1",
  "gateKey": "build,lint,test,ts:check",
  "head": "ff7fffa7",
  "dirty": true,
  "latched": false,
  "startedAt": 1733664000000,
  "finishedAt": 1733664042000,
  "gates": {
    "build": {
      "status": "failed",
      "exitCode": 1,
      "signal": null,
      "log": "/tmp/claude-comms-validate/runs/1733664000000-7af3c1/build.log"
    }
  }
}
```

Verdicts come only from child process exit codes. Gate stdout and stderr are written to the gate log and are never parsed for pass/fail.

## Single-Flight Behavior

The tool creates an atomic lock in `logDir/lock`. A second invocation with the exact same selected gate set latches onto the in-flight run and returns the same stamped result with `latched: true`. A different gate set waits for its own run instead of reusing a subset or superset result.

Run artifacts are immutable under:

```text
/tmp/claude-comms-validate/runs/<runId>/
  result.json
  <gate>.log
```

The top-level `result.json` is only the latest-result pointer for `--status`.

## Default Gates

This repo's committed config uses:

- `lint`: `npm --prefix packages/setup-installer run lint`
- `ts:check`: `cd workflow-engine && npx tsc --noEmit -p convex/tsconfig.json`
- `test`: `npx tsx --test .agents/tools/validate/*.test.ts`
- `build`: static UI deploy-shape fallback: syntax-check `js/main.js`, `js/api.js`, and `sw.js`, parse `vercel.json` and `manifest.json`, and verify required static files and the module entry.

The intended deploy-parity command is:

```bash
cd workflow-engine/ui && npx vercel build --yes
```

In this container that command fails before build with `The specified token is not valid. Use vercel login to generate a new token.` The committed `build` gate therefore uses the closest runnable static UI fallback instead of silently shipping an always-red default. Replace it with the Vercel command when the project is linked and a valid token is available.
