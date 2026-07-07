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

Accepted v1 residual: if a live owner's lock is externally yanked or misclassified stale before heartbeat support exists, another invocation may start a second run. This is self-limiting because gates are idempotent, each run writes immutable `runs/<runId>/` artifacts, and each CLI exits from the result it returned. D10 heartbeat support is the planned close.

If lock infrastructure itself is unavailable because the lock directory cannot be created or written (`EACCES`, `EPERM`, or `EROFS`), the tool warns and runs un-latched in a pid-isolated run directory. Ordinary contention does not use this fallback.

## Gate Sequencing

By default every gate runs in one concurrent batch. A gate that mutates shared
build artifacts can corrupt a peer that reads them — e.g. `next build`
regenerates `.next/types/**` while `ts:check` (`tsc`) is reading those same
files, producing spurious `TS6053: File ... not found` errors.

Give such a gate a `sequence` field to pull it out of the concurrent batch into
its own serial phase:

```json
{ "name": "build", "command": "pnpm build", "sequence": "before" }
```

- `"before"` — runs serially before the concurrent batch (gives later gates a fresh build)
- `"after"`  — runs serially after the concurrent batch
- omitted    — runs in the concurrent batch (default)

Phases execute in order `before → concurrent → after`; gates within a serial
phase run one at a time. Wall-clock is unchanged versus all-concurrent when a
single heavy gate is sequenced (it would have been the long pole either way),
but the artifact race is eliminated.

**This repo's gates are intentionally left unsequenced.** Our `build` gate
(`check-deploy-shape.mjs`) and `ts:check` (`tsc -p convex/tsconfig.json`) share
no generated artifacts, so there is no race to isolate. If you add or change a
gate such that one mutates build output another reads (e.g. a Next.js `build`
regenerating `.next/types/**` while `tsc` reads it), give the mutating gate a
`sequence` to pull it out of the concurrent batch.

## Default Gates

This repo's committed config uses:

- `lint`: `npm --prefix packages/setup-installer run lint`
- `ts:check`: `cd workflow-engine && npx tsc --noEmit -p convex/tsconfig.json`
- `test`: `npx tsx --test .agents/tools/validate/*.test.ts`
- `build`: static UI deploy-shape fallback: recursively syntax-check every `.js` file under `workflow-engine/ui/js/` plus `workflow-engine/ui/sw.js`, parse `vercel.json` and `manifest.json`, and verify required static files and the module entry.

The intended deploy-parity command is:

```bash
cd workflow-engine/ui && npx vercel build --yes
```

In this container that command fails before build with `The specified token is not valid. Use vercel login to generate a new token.` The committed `build` gate therefore uses the closest runnable static UI fallback instead of silently shipping an always-red default. Replace it with the Vercel command when the project is linked and a valid token is available.
