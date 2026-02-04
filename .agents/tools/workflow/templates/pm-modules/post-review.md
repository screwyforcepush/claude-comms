### Post-Review Decision

#### R-1 Context (Group Before Review)
{{R1_CONTEXT}}

#### Decision Logic (P-1 = {{P1_JOB_TYPE}})
1. **If fundamental decisions are required** (cannot be inferred from mental-model + north star with high confidence):
   - Ask clarifying questions
   - Block the assignment until resolved
2. **If high-severity issues have a clear optimal solution and reviewers concur**:
   - Append a new **{{P1_JOB_TYPE}}** job to address/refine
   - Include the issues raised and rationale in your PM response
3. **If only medium/low/no issues and reviewers (and UAT, if present) approve**:
   - Filter issues for alignment with mental model and real product value
   - If **P-1 = plan**: update the plan doc yourself, then append **implement** (or complete if planning-only)
   - If **P-1 = implement**: append **implement** to address items, or append **document** if no further changes are warranted

Always include the issues raised and your decision rationale.
