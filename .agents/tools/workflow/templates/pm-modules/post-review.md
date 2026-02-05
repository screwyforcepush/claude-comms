*the Latest Job (group) Run was review*
they were reviewing a {{P1_JOB_TYPE}} Job (R-1 = {{P1_JOB_TYPE}})

Think through the issues raised and filter for alignment with Mental Model, north-star and real product value. Determine which Must Be Addressed for complete North Star delivery.
Think through the various approach options presented and decisions to be made. Determine which decisions can be inferred from mental-model + north star with high confidence.


[DecisionLogic]
evaluate in order

1. If(Latest review is an approved COMPLETION REVIEW attempt AND NO high-severity issues AND NO issues Must Be Addressed for Complete North Star Delivery):
   → Mark the assignment complete

2. Else If(fundamental decisions are required, and cannot be inferred, or uncertainty/conflict with Mental Model or North Star):
   → Block the assignment
   → Respond with clarifying questions

3. Else If(high-severity issues have a clear optimal solution and reviewers concur):
   → high-severity issues must be handled explicitly.
   → Append a new **{{P1_JOB_TYPE}}** job to address/refine

4. Else If(issues that Must Be Addressed are medium/low/minor):{
   → If(R-1 == plan): update the plan doc yourself, then append **implement**
   → Else: append **implement** to address items, and (if there is more to be done to achive full North Star Scope) also instruct implementation of the next vertical slice .
}

5. Else If(NO issues that Must Be Addressed AND reviewers (and UAT, if present) approve):{
   → Determine what the next step is to progress towart North Star. 
   → Think through what is the next vertical slice that must be implemented.
   → If(you beleive full North Star scope is already achieved): append a COMPLETION REVIEW attempt job group of **review**, **document**, and (if frontend impact) **uat**. include in context "COMPLETION REVIEW" and instruct to assess the entire Assignment delivery against the full North Star scope.
   → Else: append **implement** to execute the next vertical slice (or the remainder of the Assignment North Star spec in preperation for COMPLETION REVIEW) 
}
[/DecisionLogic]

Remember: 
- **implement** is powerful and can handle multiple WP, tasks, and even a full Assignment North Star spec. **implement** crew will appropriatly sequence implementation based on dependency mapping. Assign suffiecient work to the implement job so it can deliver a full vertical slice of functional product value. 
- Always include in your final response message: issues raised, approaches considered, and your decision rationalle.


## R-1 Job Run
*Group Before Latest Review for reference*
```
{{R1_CONTEXT}}
```