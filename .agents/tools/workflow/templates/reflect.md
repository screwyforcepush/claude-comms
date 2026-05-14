You just completed a {{JOB_TYPE}} job (status: {{JOB_STATUS}}, id: {{JOB_ID}}).

Reflect on the OPERATING EXPERIENCE of doing that job: tooling, environment,
friction, efficiency, context gaps, intent conflicts, ergonomics. Do not
evaluate output quality — outcome effectiveness is out of scope.

Be concrete and adversarial. Sycophantic or generic feedback pollutes the
dataset used to improve future runs. If something was awkward, slow, confusing,
missing, or brittle, say so plainly. "Tooling was noisy" is not useful;
"TodoWrite system-reminders fired three times mid-tool-call, each consuming
~500 tokens of unrelated context" is useful.

---

Your reflection has three layers:

## 1. Rubric (yes/no presence flags)

Fixed questions about operating patterns. Run through them once — cheap to
fill. If a question does not apply to this job (e.g. you spawned no sub-agents,
so the sub-agent question has no answer), omit it. Omission is itself signal.

Run `npx tsx .agents/tools/workflow/reflect.ts --help` to see the full list
of rubric question keys with their phrasings.

## 2. Narrative (one prose block)

Tell the story of the job: what was hard, what surprised you, what you would
say if you sat down with the system designer for two minutes. This is the
rationale and context layer.

## 3. Items (3–5 specific frictions)

Each item is a concrete friction with:
- **keywords** — friction THEMES, not locator tags
- **painPoint** — what specifically went wrong
- **suggestion** — a concrete remedy

### Keywords guidance (critical)

Keywords name the FRICTION, not your location in the workflow.

Good (theme-naming):
  - tool-output-noise
  - parallel-dispatch-missed
  - intent-conflict-aop-vs-northstar
  - cli-shell-escaping
  - context-bloat

Bad (locator-only, not a friction theme):
  - phase-6 (which phase you were on does not describe the friction)
  - review-job (job type is not a friction)
  - this-task (no information content)
  - claude-comms (project name, not a theme)

### Good item vs bad item

Good:
  {
    "keywords": ["todowrite-noise", "system-reminder-injection"],
    "painPoint": "TodoWrite system-reminders fired three times mid-tool-call, each interrupting an active batch and consuming ~500 tokens of unrelated context.",
    "suggestion": "Suppress TodoWrite reminders inside an active parallel tool batch; resume them only at decision points."
  }

Bad:
  {
    "keywords": ["this-task", "tooling"],
    "painPoint": "Tooling was noisy.",
    "suggestion": "Make it less noisy."
  }

---

## Submission

This is a new reflection turn. The original job instructions no longer prohibit
writing a temporary JSON file for submission. Do not modify project files.

To submit:
1. Run `npx tsx .agents/tools/workflow/reflect.ts --help` to see the V2 input
   schema and the full list of rubric question keys with phrasings.
2. Write your structured reflection as JSON to a temp file:
   `/tmp/reflection-{{JOB_ID}}.json`
3. Invoke:
   `npx tsx .agents/tools/workflow/reflect.ts --job-id {{JOB_ID}} --input /tmp/reflection-{{JOB_ID}}.json`
4. Exit after the CLI prints `ok`.

---

Brief context cue. The assignment was about:
{{ASSIGNMENT_SCOPE_HINT}}
