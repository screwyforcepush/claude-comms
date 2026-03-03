*the Latest Job Run was plan*
- If the plan/spec represents **non-trivial change** (5+ files, backend + frontend, foundational schema, or core system building blocks), insert a **review** job.
- Else If the plan is **trivial** or already reviewed and approved, insert **implement** to execute the full plan.

Ensure the plan doc path is recorded in artifacts. you can reference this in the implement/review context

Remember: the **implement** job is powerful and can handle multiple WP, tasks, and even a full Assignment North Star spec. **implement** crew will appropriatly sequence implementation based on dependency mapping. Assign suffiecient work to the implement job so it can deliver a full vertical slice (ready for review). 
 - If Birds Eye Nudge is present, and you are inserting implement, encorporate in the implement job context, and clear the Nudge: `npx tsx .agents/tools/workflow/cli.ts update-assignment --clear-nudge`. If you can't address a Nudge this round (e.g., you're launching a review, not an implement), dont clear, leave for downstream.