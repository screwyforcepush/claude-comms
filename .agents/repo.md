
# Repository Guidelines
VALIDATE by running the blocking validate CLI — all gates must pass without warnings or errors:
   - `npx tsx .agents/tools/validate/cli.ts`

Read the stdout JSON `ok` field for the verdict. If `ok` is `false`, open only the `log` paths for gates whose JSON `status` is `failed`; do not grep stdout or logs for the verdict.


## Dev server
You can start the workflow engine UI server with `cd workflow-engine/ui && nohup npm start > /tmp/ui-server.log 2>&1 &` but it may already running in the background. check the `ui-server.log` file. Avoid starting up a new instance as it will bump the port.
you can access the client on `http://localhost:3000/` using the UAT toolkit
if you are experiencing issues with the workflow engine ui server. kill the old one and restart.

## Documentation Protocol
Guard the doc hierarchy: specs in `docs/project/spec/` remain the source of truth (Businesslogic, data dictionary, data flows, tech guide, industry references); guides in `docs/project/guides/` capture evolving process; phase folders (`docs/project/phases/XX-Name/`) store live work packages and notes. Update whichever doc you rely on as soon as the code diverges.

## PRE Deployment
`vercel build --yes` must pass otherwise CI/CD will FAIL!
