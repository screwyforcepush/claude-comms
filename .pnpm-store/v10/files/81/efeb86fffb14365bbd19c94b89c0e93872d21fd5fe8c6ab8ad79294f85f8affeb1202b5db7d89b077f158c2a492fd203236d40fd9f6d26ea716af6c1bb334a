# annotated-feedback-mcp

Model Context Protocol (MCP) server that exposes Annotated Feedback data to AI agents. The server runs as a standalone stdio process so tools like **Claude Code** can triage, inspect, and update feedback collected by the universal widget without depending on any monolithic web application.

> **Status:** Package scaffolding is in place. Placeholder tool handlers are registered while full Convex integrations are implemented in subsequent work packages.

## Features
- Stdio-based MCP server compatible with Claude Code and other MCP-capable hosts.
- Convex HTTP client wrapper (`ConvexClient`) with first-class error handling and optional `AGENT_SECRET` authentication.
- Strict TypeScript configuration targeting modern Node.js runtimes.
- Executable binary entry point published as `feedback-mcp`.

## Requirements
- Node.js 20 or later
- pnpm 9+
- Access to a Convex deployment that hosts the `feedback` functions described in the universal feedback specification.

## Installation

```bash
cd packages/feedback-mcp
pnpm install
```

This installs the MCP SDK and development dependencies required to build the server locally.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm build` | Compile TypeScript to `dist/` (ESM output). |
| `pnpm start` | Run the compiled MCP server (`node dist/server.js`). |
| `pnpm dev` | Watch & recompile TypeScript sources (handy alongside a separate `pnpm start`). |

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `CONVEX_URL` | ✅ | Base URL of the Convex deployment (e.g. `https://<deployment>.convex.cloud`). |
| `AGENT_SECRET` | ⬜️ | Optional bearer token validated by Convex HTTP endpoints for agent access. |
| `CONVEX_TIMEOUT` | ⬜️ | Request timeout in milliseconds (defaults to 30000). |

The placeholder tool handlers validate `CONVEX_URL` on startup so configuration issues surface immediately.

## Claude Code Integration

Claude Code desktop exposes a CLI helper for registering MCP servers. Add Annotated Feedback with the required environment variables:

```bash
claude mcp add annotated-feedback \
  --scope user \
  -- env \
    CONVEX_URL="https://your-deployment.convex.cloud" \
    PROJECT="storybook" \
  npx -y annotated-feedback
```

Tips:
- Swap in your Convex deployment URL and, if needed, change or remove the optional `PROJECT` scoping variable.
- Include `AGENT_SECRET="shared-secret"` in the env block when your Convex HTTP endpoints expect authenticated access.
- For local development, run `pnpm --dir ./mcp dev` in another terminal to rebuild automatically and register the server with `pnpm --dir ./mcp start` instead of the `npx` command.

## Tool Surface

| Tool | Purpose | Notes |
| --- | --- | --- |
| `list` | List feedback entries filtered by status. | Uses `feedback:list` or `feedback:listByStatus` depending on the filter. |
| `get` | Retrieve a single feedback record including screenshot data. | Falls back to `feedback:list` when `feedback:get` is unavailable. |
| `update` | Transition a feedback item through the state machine. | Invokes `feedback:updateStatus` in Convex. |

Each tool will live under `src/tools/` with JSON Schema input definitions and structured outputs so Claude Code can render results intelligently.

### Tool Output Payloads

To keep the MCP surface minimal, tool responses intentionally expose only a subset of the underlying Convex document:

- `list` returns an array of `{ _id, createdAt, updatedAt, url, note, status }`.
- `get` returns the same metadata plus an inline screenshot (base64-encoded PNG) when one is available.
- `update` returns a confirmation object containing `success` and `message`.

Fields such as `project`, `route`, `flags`, `priority`, and `assignedTo` are currently **not** included in the MCP payloads by design. When additional context is required, prefer navigating to the full Annotated Feedback triage UI or your internal workflow tooling.

## Development Notes
- TypeScript uses strict mode with NodeNext module resolution (`tsconfig.json`).
- The package exports a `feedback-mcp` binary so downstream tooling can reference it directly once published.
- Commit any spec-aligned changes to `docs/project/phases/07-UniversalFeedbackMCP/` to keep the phase documentation current.

## Next Steps
- Implement the list/get/update tool handlers using the shared `ConvexClient`.
- Add Vitest coverage for MCP tool behavior and Convex error scenarios.
- Flesh out README with troubleshooting guidance once the tools are feature-complete.
