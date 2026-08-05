
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

## Design
Applies to any change that renders UI. Design serves the task. The bar is earned familiarity:
a user fluent in Linear/Notion/Stripe trusts it instantly. The failure mode is strangeness
without purpose — not plainness. Consistency > surprise.

*Prime rule: adopt the primitive*
- Before hand-rolling ANY interactive control, find and use the repo's shared primitive/design-system component. Bespoke only when no primitive fits — then you own its full contract: interaction states + ARIA + keyboard, documented at the component.

*Universal defects*
- Missing interaction states (default/hover/focus/active/disabled/loading/error/success, as applicable). Hover with no focus equivalent — keyboard users never see hover. Invisible keyboard focus.
- Placeholder as the only label; errors not tied to their field; disabled actions with no visible reason.
- Modal as first thought — exhaust inline/progressive disclosure first. Dialogs without trap/Esc/restore. Dropdowns clipped by their overflow container.
- Confirm where Undo would do; destructive copy that doesn't name what is destroyed.
- RussianDoll UX: components-in-components is code abstraction; cards-in-cards-in-cards is that abstraction leaking into the design. Minimise visual nesting; flatten nested padding/borders when the boundary means nothing to the user.

*Repo register*
- The repo design guide (`docs/project/guides/design-system.md` or equivalent) owns the specifics — tokens, focus/ring treatment, motion, loading vocabulary — and extends or overrides this section.
- House-style allowlist patterns are intentional; never flag them.


## PRE Deployment
`vercel build --yes` must pass otherwise CI/CD will FAIL!
