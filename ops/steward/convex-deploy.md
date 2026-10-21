# Convex deploy

Steward-only recipe. The crew never deploys; the Steward does, from this container.

## Deploy to production

```bash
CONVEX_DEPLOYMENT=prod:utmost-vulture-618 npx convex deploy
```

Production is `prod:utmost-vulture-618` at `https://utmost-vulture-618.convex.cloud`. The admin password is the `ADMIN_PASSWORD` env var on the Convex server.

## Traps

- **The CLI resolves `convex/` from the monorepo root, not the cwd.** The root symlink `convex -> workflow-engine/convex` is required. Never remove it or replace it with a real directory. Root `package.json` must keep `convex` as a devDependency so the CLI resolves.
- **Empty functions plus schema validation is data loss.** Before deploying, confirm the bundle lists functions. A deploy that ships zero functions against a validated schema wipes data.
- **Readback defaults to dev.** `convex run` and `convex function-spec` target the dev deployment (`capable-roadrunner-863`) even with `CONVEX_DEPLOYMENT` set to prod. Pass `--prod` to read production, or a successful deploy looks like "Could not find function".

```bash
npx convex function-spec --prod
npx convex run --prod <module>:<fn> '<args-json>'
```

- **`--prod` refuses without the env var.** Some commands want both `--prod` and `CONVEX_DEPLOYMENT=prod:utmost-vulture-618` exported.
