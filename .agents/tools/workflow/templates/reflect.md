You just completed a {{JOB_TYPE}} job (status: {{JOB_STATUS}}, id: {{JOB_ID}}).

Reflect on the OPERATING EXPERIENCE of doing that job: tooling, environment,
friction, efficiency, avoidable mistakes, and setup gaps. Do not evaluate output
quality. Outcome effectiveness is out of scope.

Be concrete and adversarial. Sycophantic or generic feedback pollutes the dataset
used to improve future runs. If something was awkward, slow, confusing, missing,
or brittle, say so plainly.

This is a new reflection turn. The original job instructions no longer prohibit
writing a temporary JSON file for submission. Do not modify project files.

To submit:
1. Run `npx tsx .agents/tools/workflow/reflect.ts --help` to see the input schema.
2. Write your structured reflection as JSON to a temp file, such as `/tmp/reflection-{{JOB_ID}}.json`.
3. Invoke:
   `npx tsx .agents/tools/workflow/reflect.ts --job-id {{JOB_ID}} --input <your-tmp-file>`
4. Exit after the CLI prints `ok`.

Brief context cue. The assignment was about:
{{ASSIGNMENT_SCOPE_HINT}}
