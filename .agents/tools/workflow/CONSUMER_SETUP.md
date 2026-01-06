# Consumer Repo Setup

This document describes how to set up the workflow engine in repos that consume the `.agents/` directory.

## Current Architecture

```
.agents/tools/workflow/
├── workflow-engine -> ../../../workflow-engine  (symlink)
├── cli.ts
├── runner.ts
├── config.json
└── templates/
```

The CLI and runner import from `./workflow-engine/convex/_generated/api.js`, which resolves through the symlink to the actual `workflow-engine/` directory containing the Convex schema and generated types.

## Problem

When copying `.agents/` to a consumer repo, the symlink points to `../../../workflow-engine` which won't exist in the consumer repo's directory structure.

## Options

### Option 1: Copy workflow-engine alongside .agents

```bash
# In consumer repo
cp -r /path/to/workflow-engine ./workflow-engine
# Symlink already points to ../../../workflow-engine, adjust if needed
```

Pros: Simple, self-contained
Cons: Duplicated code, manual updates

### Option 2: Publish workflow-engine to npm

```bash
# Publish
cd workflow-engine && npm publish

# In consumer repo
npm install @yourorg/workflow-engine

# Update symlink
cd .agents/tools/workflow
rm workflow-engine
ln -s ../../../node_modules/@yourorg/workflow-engine workflow-engine
```

Pros: Clean dependency management, versioned
Cons: Requires npm publishing workflow

### Option 3: Git submodule

```bash
# In consumer repo
git submodule add <workflow-engine-repo-url> workflow-engine

# Symlink points to it
cd .agents/tools/workflow
ln -s ../../../workflow-engine workflow-engine
```

Pros: Always up to date with upstream
Cons: Submodule complexity

### Option 4: Monorepo with shared packages

If using a monorepo (turborepo, nx, etc.), workflow-engine can be a workspace package that .agents/tools/workflow depends on.

## Config Per Repo

Each consumer repo needs its own `config.json`:

```json
{
  "convexUrl": "https://your-project-123.convex.cloud",
  "namespace": "consumer-repo-name",
  "defaultHarness": "claude",
  "timeoutMs": 600000,
  "pmHarness": "claude"
}
```

The `namespace` field isolates assignments/jobs per repo in the shared Convex backend.

## TODO

- [ ] Decide on distribution strategy (npm publish vs git submodule vs copy)
- [ ] Automate consumer repo setup script
- [ ] Consider generating standalone client without symlink dependency
