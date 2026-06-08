# Cross-Job Postmortem — Resurrecting Agents in a Chain

When a downstream symptom (wrong dispatch, wasted budget, mis-shaped artifact) traces back through multiple agents in an assignment chain, individual reflections only see their own job. The root cause is often a contract drift between two layers — *the way the planner phrased a section* misreading as *the way the PM authored a dispatch*. This procedure walks back up the chain and interrogates each agent in their own session.

## When to run this

- A dispatch outcome is materially wrong (count off, wrong tool, wrong shape) AND the agents involved are still resumable (have `sessionId`).
- A single agent's reflection identifies a *symptom* (e.g. "I was surprised by fan-out") but not the *upstream cause* (what made them author it that way).
- You suspect spec/template language is at fault but want to confirm by asking the consumer how they parsed it.

Don't run this for one-off agent errors with clear local cause — read the reflection and move on.

## Procedure

### 1. Get a fresh dump of reflections

The introspection CLIs write all reflections to a JSON file. Use V2 if the agents in question are recent.

```bash
npx tsx .agents/tools/workflow/introspection/dump-reflections-v2.ts \
  --output /tmp/reflections-v2-dump.json
# Or V1 for older agents:
npx tsx .agents/tools/workflow/introspection/dump-reflections.ts \
  --output /tmp/reflections-v1-dump.json
```

### 2. Find the agent by partial-id and pull metadata

Users typically remember a partial ID (the last 12 chars of the jobId is a good handle) and the token count. Use that to locate the row, then extract scalar fields only:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/reflections-v2-dump.json','utf8'));
  const r=d.find(x=>JSON.stringify(x).includes('<partial-id>'));
  const c={}; for(const k of Object.keys(r)){
    if(typeof r[k]!=='object'||r[k]===null) c[k]=r[k];
  } console.log(JSON.stringify(c,null,2));"
```

You want `sessionId`, `jobType`, `harness`, `totalTokens`, `clientGitSha`, `engineGitSha`. The session ID is what lets you resume.

### 3. Stage a focused prompt as a file

Don't inline the prompt — write it to `/tmp/<role>-interrogation.txt`. The interrogation prompt should:

- Open by naming who they are and which reflection ID surfaced this.
- State the observed downstream symptom in concrete terms (job counts, output shape).
- Quote the specific phrase/section the symptom traces back to.
- Ask 2–3 sharp questions in priority order. Do not ask for apology or rewrite — ask for **honest reconstruction of the reasoning at the moment of authoring/dispatch**.
- Set the response budget ("1–2 paragraphs max", "no apology", "no comprehensive rewrite").

### 4. Resurrect with `claude --resume --fork-session --print`

The fork keeps the original session pristine. `--print` returns a single non-interactive response. Drop `--bare` — it requires explicit auth.

```bash
claude --resume <sessionId> --fork-session --print \
  < /tmp/<role>-interrogation.txt \
  | tee /tmp/<role>-resurrection-output.log
```

The agent answers from inside their original context (north star, artifacts, system reminders, prompt template). They have full memory of what they read and authored. They do not have memory of anything that happened *after* their job ended.

### 5. Walk up the chain

Each resurrected agent's answer typically reveals the *next* upstream contributor. The PM points back at the spec; the planner who wrote the spec points back at the framing they invented or absorbed. Keep walking until you reach an agent whose reasoning was internal (no upstream artifact pinned it) or you've covered the meaningful layers.

### 6. Cross-reference quoted language

Whenever an agent cites a doc, verify the quote. The PM cited "spec §7" — checking the actual `workflow-engine-spec.md` showed no such section, which itself was signal. The phase spec did contain §7 and the misleading notation. Trust the agents' reconstruction of intent, but verify the text they're reconstructing from.

## Failure modes to watch for

- **Satisfaction-of-search.** The first plausible root cause (e.g. "the PM template is too vague") is rarely the deepest one. Keep one question in mind: *did this agent originate the bad pattern, or inherit it from upstream?* Don't stop at the first agent that explains the symptom — only stop when an agent's reasoning is fully self-originated.
- **Premature fix proposals.** Postmortems get derailed by jumping to "we should change the template". Hold the trajectory until all relevant layers have spoken; the fix often shifts from where you first proposed it.
- **Agent fabrication under interrogation.** Resurrected agents can confabulate plausible reasoning post-hoc. Cross-reference any cited doc, file, line. The PM admitted fabricating "looking at typical patterns" — they would not have flagged that without a direct ask.
- **Cost.** Each resurrection adds 2–10k tokens to an already-large session. Three resurrections at ~150k input each is non-trivial. Stage prompts tightly; cap response length explicitly.

## Output

A postmortem note that names each layer's contribution, with verbatim quotes from each resurrected agent. The user decides whether to file fixes — the postmortem itself is the deliverable. Do not propose changes to spent phase docs; spec/template/CLI changes are forward-facing decisions.
