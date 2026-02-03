# North Star: Workflow Engine Test

## Assignment (Exact)

Run a test with:
- One assignment
- One head job (research job type)
- No harness specified

The research job should:
1. **pwd** - get current working directory
2. **Write** the result to a new `.md` file
3. **Delete** that file
4. Do this with **multi-step reasoning** to properly exercise the harness JSON stream

## Context

This is a minimal test case to validate:
1. Assignment creation with minimal configuration works
2. Research job type executes without a harness
3. The workflow engine handles single-job assignments correctly
4. The harness JSON event streaming works across multiple steps

## Job Prompt (Exact)

"plan and execute: pwd then write it to a new .md file, then delete the file. this is just a test your harness json stream, so make it multi step with reasoning even though its a basic assignment"
