# Ops debt register

- [phase-23] Chain deletion is unchunked: `assignments.remove` and the `chatThreads.remove` cascade read every job and `jobPrompts` row of the chain in one mutation, so a chain of ~140+ started jobs (~110 KB prompts) hits Convex's 16 MiB per-query read limit and cannot be deleted. The 192-job assignment that triggered phase 23 is such a chain. Fix would be a chunked delete. See `docs/project/spec/convex-bandwidth-optimization.md` §6d.
