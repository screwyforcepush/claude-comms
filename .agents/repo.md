
# Repository Guidelines
VALIDATE by Running required commands — all must pass without warnings or errors:
   - `pnpm lint`
   - `pnpm ts:check`
   - `pnpm test:all`
   - `pnpm build`


## Dev server
`pnpm dev | tee -a dev.log` is already running in the background. check the `dev.log` file. Avoid starting up a new instance as it will bump the port.
you can access the client on `http://localhost:3000/` using the UAT toolkit

## Documentation Protocol
Guard the doc hierarchy: specs in `docs/project/spec/` remain the source of truth (Businesslogic, data dictionary, data flows, tech guide, industry references); guides in `docs/project/guides/` capture evolving process; phase folders (`docs/project/phases/XX-Name/`) store live work packages and notes. Update whichever doc you rely on as soon as the code diverges.

## PRE Deployment
`vercel build --yes` must pass otherwise CI/CD will FAIL!