# North Star Lifecycle — How the Chain Consumes What You Author

**Audience:** the Steward (`.agents/tools/workflow/templates/product-owner.md`), authoring a north star in cook mode and signing off at the tail.

**Read this twice:** once **before** authoring a north star — to know which passages the consumers downstream actually weight — and once **at the tail**, reading the completion message — to know which alignment checks structurally *could* have fired and which never do.

## Why this guide exists

The north star is the only artifact that persists **verbatim** to every downstream job, and the only translation of user intent that is checked against **the user** rather than against another artifact. You author it in jam with the user. From that moment on, every downstream gate — plan, review, uat, PM adjudication — checks alignment against the *north star*, not against the user. So:

> A north star that is subtly wrong is delivered faithfully, and every gate passes.

The failure mode the user named: not a north star that conflicts with the mental model or contradicts itself (those get caught), but a **slight scope variation** — something you scoped *out* with the user, then widened by a hair to include something adjacent, and the assignment blew out. This guide is not a rule set for avoiding that. It is a map of *who reads the north star and what they are told to do with it*, so your choice of verbatim passages and acceptance criteria — and your tail sign-off — are made from evidence rather than instinct.

The user was explicit that this is exploratory: *"I don't want to get prescriptive... As long as they keep it read only + doc it won't harm and we might learn something."* Treat the map below as ground truth (it is read straight from the templates) and the evidence section as one honest trace, not a law.

---

## How the north star reaches a job (the plumbing)

The north star lives as one string field, `assignment.northStar`. Two facts govern everything else:

1. **Injection is verbatim and untruncated.** `buildPrompt` (`.agents/tools/workflow/lib/prompts.ts:300`) does a global string replace of `{{NORTH_STAR}}` with `assignment.northStar` — no truncation, no summarisation, no reshaping. Whatever you author is what every `{{NORTH_STAR}}` consumer sees, byte for byte.

2. **Amendments are concatenated into the same string.** `update-assignment --append-northstar` (`.agents/tools/workflow/cli.ts:639-647`) reads the current north star and sets `northStar = "<current>\n\n<amendment>"`. There is no separate amendment field — an amendment *becomes* the north star for every consumer from that point on. (Mental model calls this the North Star Amendment lever; the Outcome Navigator prefixes `Amendment N:` for tracking. It is append-only: a wayward amendment cannot delete the original scope, only add to it.)

Consequence for you: the north star is a **single flat blob** read identically by everyone who reads it. There is no per-consumer view, no "reviewers get the acceptance criteria, planners get the rationale" routing. If it is in the string, everyone gets all of it; if it is not, no one does.

### Which consumers get the north star, and in what form

| Consumer | Template | Form received |
|---|---|---|
| plan | `plan.md` | full verbatim (`{{NORTH_STAR}}`) |
| implement | `implement.md` | full verbatim, **and re-broadcast verbatim to each engineer sub-agent** |
| review | `review.md` | full verbatim |
| uat | `uat.md` | full verbatim |
| document | `document.md` | full verbatim |
| pm | `pm.md` | full verbatim (PM modules ride inside this one injection) |
| reflect | `reflect.md` | **first 200 chars only**, as a scope *hint* |
| notify | `notify.md` | **not received at all** |
| product-owner (Steward) | `product-owner.md` | **not re-injected** — you authored it; you work from session memory |

The last three are the structurally interesting ones and are covered under "Where the north star is NOT checked".

---

## Consumer map — what each is told to do with the north star

For each consumer: **what it is instructed to do** with the north star, **whether it can block/misalign**, and **whether it quotes/restates it back**. Instructing lines quoted briefly so you can verify against the file.

### plan (`plan.md`)
- **Instructed to:** "execute on Your Assignment while ensuring allignment with the ⭐North Star⭐" (line 2); create a spec doc with a "descriptive filename tied to the north star" (line 44); produce "Assignment-Level Success Criteria" and "Recommend Job Sequence"; and "**Identify Ambiguities** or decisions needed; call out questions explicitly" (line 56).
- **Can block?** No. Plan surfaces ambiguities and questions as *output for the PM*. It cannot change assignment status. Its questions are an input, not a gate.
- **Quotes back?** No verbatim reproduction. It restates the north star as spec purpose and success criteria — a *translation* into a spec, which is where a slight scope-widening first gets a foothold and hardens into a plan.

### implement (`implement.md`)
- **Instructed to:** orchestrate engineers "while ensuring allignment with the ⭐North Star⭐" (line 2); "**Focus** on Your Assignment and North Star alignment" (line 119).
- **Can block?** No. It reports what it built and its decisions ("X over Y, because Z", line 122) for the PM to harvest.
- **Quotes back?** **Yes — uniquely.** The engineer-tasking template embeds `<North Star VERBATIM>` in every sub-agent prompt (lines 93-97): "The successful delivery of your assigned task, contributes to the high level Objective: `<North Star VERBATIM>`". This is the one place the north star is *re-broadcast verbatim* to a layer the workflow engine never sees. A subtly-wrong north star propagates one level deeper here, to agents with even less context than the orchestrator.

### review (`review.md`)
- **Instructed to:** "Assess the work against: **Spec adherence** (North Star, spec docs, requirements)" (line 35), plus architecture, best practices, guide compliance, risk. Response format includes "**Decision Notes** — Any decisions that PM must make" (line 58).
- **Can block?** No. Review gives an overall Pass/Concern/Fail verdict and raises issues + decision notes, but "You do **not** modify code" and it cannot change assignment status. Its verdict is a *claim the PM adjudicates*, not a gate.
- **Quotes back?** No. It checks work *against* the north star and reports deviations. This is the chain's primary alignment check on delivered work — but note it checks against the north star (and spec), which is itself downstream of the user.

### uat (`uat.md`)
- **Instructed to:** "Validate against the **north star** and any explicit acceptance criteria" (line 34), through runtime behaviour only.
- **Can block?** No — with a nuance. It can mark its own *report* "**Blocked**" when flows "cannot be tested due to missing info" (line 76), which is a report status requesting inputs, not an assignment block. A critical UAT blocker must be resolved (per `post-review.md`), but resolution is the PM's decision.
- **Quotes back?** No. It exercises the north star's acceptance criteria as user flows — so the **acceptance criteria you write are the part uat actually operationalises**. Vague criteria give uat nothing concrete to validate against.

### document (`document.md`)
- **Instructed to:** update docs "while ensuring allignment with the ⭐North Star⭐" (line 2); update guide docs "where changes can be **confidently inferred**" (line 39).
- **Can block?** No.
- **Quotes back?** No. It captures current state; it does not re-assert the north star.

### pm (`pm.md`) — the only gate
- **Instructed to:** "critically assess Allignment of the latest Job Run against the north star and Mental Model" (line 15); the north star is "your guiding light" (line 25); complete "ONLY when the enite scope of the north star is fully achieved" (line 109); block on "fundamental decisions... that can not be inferred from mental-model and north star with high confidence and without conflict" (line 115).
- **Can block?** **Yes — and it is the only crew-side layer that can.** Block and Complete are both PM-only exit commands. Everything the crew produces funnels here.
- **Quotes back?** Not *instructed* to quote verbatim, but in practice it restates the north star as a "Bearings" line each cycle (see evidence). The block-reason field is free text and often paraphrases the conflicting scope.

### PM decision modules (`pm-modules/*.md`)
These are concatenated into `pm.md` at `{{PM_MODULES}}` — they have **no separate north-star injection**; they instruct the PM on how to act on the one copy already in `pm.md`.
- **`post-plan.md`:** routes plan → review or implement based purely on *change size/triviality* (5+ files, backend+frontend, foundational schema). **No north-star comparison at this hop** — it is a structural routing rule.
- **`post-implement.md`:** "Assess the latest implementation... against the North Star and spec" (line 2); routes to review; introduces the COMPLETION REVIEW concept.
- **`post-review.md`:** the DecisionLogic (lines 8-33). This is where alignment filtering concentrates: filter issues "for alignment with Mental Model, north-star and real product value"; complete only on an "approved COMPLETION REVIEW attempt" with no must-fix issues; **block** on "fundamental decisions... cannot be inferred, or uncertainty/conflict with Mental Model or North Star".
- **`post-document.md`:** "assess for allignment with the north star and capture current state" (line 2); routes to a completion review or the next job.

---

## Where the north star is NOT checked (structural)

Derived from the templates, not from samples. These are points where nothing compares work against the north star:

- **Reflect never checks it.** `reflect.md` is outcome-blind by mandate — "Do not evaluate output quality — outcome effectiveness is out of scope" (line 4). It receives only `northStar.slice(0, 200)` as a "brief context cue" (`reflect-spawn.ts:176`), not the full text. Reflection is an ergonomics instrument; it is structurally incapable of catching north-star drift and should never be relied on to.
- **Notify never sees it.** `notify.md` renders the previous assistant message into a listenable form and has no north-star reference. Correct by design — it is an audio-surface transform, not a gate.
- **The tail sign-off does not re-inject the north star.** When the assignment completes, the Steward's COMPLETION_SUMMARY prompt (`product-owner.md` lines 249-265) receives `{{LATEST_MESSAGE}}` (the final PM message) — **not** a fresh copy of the north star. `buildChatPrompt` (`prompts.ts:368`) has no `{{NORTH_STAR}}` substitution at all. So at sign-off you are checking the PM's closing claim against *your own session memory* of what you authored, not against a re-presented north star. If your memory of the north star has drifted, nothing in the prompt corrects it. **This is the moment to re-read the north star string yourself.**
- **The crew cannot gate on misalignment.** plan, implement, review, uat and document all *receive* the north star and are told to "align" — but none can change assignment status. Per the mental model: their "claims are inputs to the PM, never verdicts." A crew member that spots the north star is subtly wrong has no lever except to write it into a report and hope the PM acts on it.
- **The PM is stateless and single-run.** It sees only the latest job run plus north star, mental model, artifacts and decisions — never the full chain. It "cannot be the layer that notices a *pattern* of failure or drift" (mental model). So drift that only shows up *across* cycles is invisible to every individual PM.
- **`post-plan` routing is a north-star-free hop.** The plan→review/implement decision is made on change size alone. Nothing re-checks the plan against the north star at that specific hop (the *review* it may route to does, later).
- **The one layer that checks against the user is optional and reads reports, not the user.** The Steward in guardian mode (`product-owner.md` GUARDIAN_MODE) is the only layer with user-side memory and the only one framed to catch "*intent drift*... conflicting with the Mental Model, or quietly redefining scope." But (a) it is only active if the user toggled guardian mode on, (b) it evaluates the **PM's progress report** (`{{LATEST_MESSAGE}}`), not a fresh read of the user's original intent, and (c) it too can be fooled by a subtly-wrong north star if that star matches its own understanding. Guardian is the backstop, not a guarantee.

Net: the only defences against a subtly-wrong north star are **you at authoring time**, the **guardian** (optional, report-based), and **you again at the tail** (working from memory, not a re-injected star). Every gate in between faithfully checks work against the star you wrote.

---

## What the PM's alignment/block decision is anchored on

Derived from `pm.md` and the pm-modules. The PM's alignment and block signal is anchored on a **combination**, in this order of weight:

1. **The north star** — the "guiding light" (`pm.md:25`); completion is defined as "the enite scope of the north star... fully achieved" (line 109).
2. **`mental-model.md`** — the PM is told to "Read `docs/project/spec/mental-model.md` to align decisions" (line 29) and to check "are there conflicts between what has been done and Mental Model?" (line 18). Block fires when a decision "can not be inferred from mental-model and north star with high confidence and without conflict" (line 115). **Both** north star and mental model are load-bearing for the block condition.
3. **Internal consistency of Artifacts / Decisions** — the Decisions log is "settled choices that future jobs must honor or knowingly overturn" (line 47). A PM can push back on a stale decision by appending a superseding entry. Scope rulings ("out of North Star boundary") are recorded here.

What the PM is **not** anchored on: the user directly. There is no `{{USER_INTENT}}` or conversation transcript in `pm.md`. The PM's entire notion of user intent *is* the north star plus the mental model. This is exactly why a north star that is subtly wrong but internally consistent and mental-model-compatible sails through: the PM has nothing else to check it against, and its block condition is about what it *cannot infer with confidence*, not about latent scope error it has no way to detect.

---

## Evidence — one real chain traced end to end

Traced assignment (claude-comms namespace): the **config-driven `validate` CLI** feature. Chain, in order:

`plan → pm → review×3 → pm → plan → pm → implement → pm → review×3 → uat → document → pm → implement → pm → review×3 → document → pm`

This is a rich chain: a fan-out review of the spec, a re-plan, an implement, a completion-review group with uat, and a final fix+document loop. What the trace shows about where the north star surfaced:

**The PM restates the north star every cycle.** Each PM "Bearings" section opens with a north-star line — e.g. *"North Star: ship a config-driven `validate` CLI... replacing the hand-rolled `nohup`+pid-poll recipe."* It is a paraphrase-restatement, not a verbatim quote, and it visibly steers the PM's routing. So the "does the PM quote it back?" answer, empirically: it **restates**, consistently, near the top of every message.

**Reviewers check against it explicitly.** Review verdicts reference it directly — *"the spec aligns with the mental-model mandate"*, *"North Star met"*. The alignment check on delivered work is real and visible in the review output.

**A subtly-wrong north star was found and corrected — without a block.** This is the headline finding. The north star asserted the work would leave `AGENTS.md` untouched (a "no AGENTS.md edit" premise). A reviewer discovered that `AGENTS.md:52-54` actually embedded the obsolete `nohup` recipe the CLI was meant to replace — so the premise was **false**. The chain did **not** block or escalate to the user. Instead the PM ratified a superseding decision:

> D7: AGENTS.md ADDED as authorized 4th scope surface... **North Star 'no AGENTS.md edit' premise falsified by review**... Minimal surgical trim serving North Star intent.

This is precisely the mental-model scenario, observed live: a north star that was *slightly wrong on a factual premise* was handled faithfully by the machine — corrected via an appended Decision that the PM judged "serving North Star intent" — rather than surfaced to the user as a scope question. It worked out here because the error was a factual premise a reviewer could falsify against the repo. A scope-widening error (the user's actual worry) has no repo to falsify it against, and would have propagated the same silent way.

**No block occurred and the alignment field stayed null.** The whole chain completed; `alignmentStatus` on the assignment is `null`. That means no guardian alignment write ever landed on this assignment — we **cannot tell from the record** whether guardian mode was off, or was on and silently stayed green. Which is the core honesty caveat:

> **A silently-passed alignment check is indistinguishable from no check at all.** The absence of a north-star quote, an `alignmentStatus`, or a block reason in the record is *not* evidence that alignment was not checked. A green guardian writes little; an absent guardian writes nothing; they look the same downstream. The trace can prove where the north star *did* surface (PM bearings, review verdicts, the D7 correction); it cannot prove where it was *not* consulted.

What the trace could **not** establish: whether any consumer weighted a *specific passage* of the north star (e.g. the acceptance criteria vs the rationale) more than another. The north star surfaces as a whole or is restated in summary; per-passage weighting is not observable from job results.

---

## What this means for authoring a north star

Grounded in the map above — not in guesses about model internals:

- **Everything is read as one flat blob by everyone.** There is no per-consumer routing. Length is a shared tax: every `{{NORTH_STAR}}` consumer pays for every word, and implement pays twice (it re-broadcasts verbatim to sub-agents). Carry verbatim what the consumers *act on*; keep the rest tight.
- **Acceptance criteria are the part uat operationalises and the PM completes against.** uat validates "against the north star and any explicit acceptance criteria"; the PM completes only when "the enite scope of the north star is fully achieved." Vague or missing criteria give uat nothing to exercise and give the PM no crisp completion test. This is the highest-leverage passage to make concrete and testable.
- **The rationale / user-perspective passage is what plan translates into a spec and what the PM weighs in its bearings.** It is where a slight scope-widening first hardens. State what is *out* of scope as explicitly as what is in — the D7 story shows the chain will expand scope to "serve North Star intent" when it reads intent as permission.
- **Anything you want the PM to be able to *block* on must be inferable-or-conflicting against the north star + mental model.** The PM blocks on what it "can not infer with high confidence, without conflict." A concern you leave implicit is a concern the PM will resolve locally rather than surface. If a decision must come back to the user, the north star has to make its non-inferability explicit.
- **Nothing checks the star against the user after you author it — and the tail does not re-show it to you.** The chain checks work against the star; only you and the (optional) guardian check the star against intent. At sign-off you are working from memory, so **re-read the north star string against the user's original ask before you sign off** — the completion prompt will not do it for you.
- **Amendments are permanent and universal.** `--append-northstar` concatenates into the same blob every future job and PM reads verbatim. Use it for genuine scope change under explicit user instruction; use a PM nudge (consumed once, next PM only) for tactical course-correction that should not persist.

---

*Read-only companion:* this guide traces consumption structurally and from one chain; it does not modify any template. For the template/placeholder map see [`prompt-architecture.md`](prompt-architecture.md); for the operating-loop roles (Steward / PM / crew / guardian and what each lacks) see [`system-diagram.md`](system-diagram.md) and `docs/project/spec/mental-model.md` §"The Machine".
