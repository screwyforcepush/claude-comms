# Prompt Architecture

This document describes how prompts are constructed and selected within the workflow engine, and how the PM uses modular decision logic.

## Overview
- Prompts are assembled from templates in `.agents/tools/workflow/templates/`.
- Each job type maps to a template file with placeholders.
- A shared **Context Primer** appears near the top of each job template to ensure alignment with:
  - `docs/project/spec/mental-model.md` (the user's conceptual model)
  - `docs/project/guides/architecture-guide.md`
  - `docs/project/guides/design-system-guide.md`
  - Other relevant guides (when applicable)

## Job Types → Templates

| Job Type | Template | Purpose |
|----------|----------|---------|
| `plan` | `plan.md` | Create spec doc + work-package breakdown with UAT-oriented slices |
| `implement` | `implement.md` | Orchestrate batches of engineers to complete implementation |
| `review` | `review.md` | Read-only engineering review vs spec, architecture, and guides |
| `uat` | `uat.md` | User-perspective testing with browser toolkit + logs |
| `document` | `document.md` | Update docs, then auto-complete assignment |
| `pm` | `pm.md` | Decision gate for next job(s) |
| `product-owner` / `chat` | `product-owner.md` | PO chat behavior + guardian evaluation |

## Core Template Inputs

Templates use placeholders that are replaced at runtime:

- `{{NORTH_STAR}}` — assignment goal
- `{{ARTIFACTS}}` — running artifacts list
- `{{DECISIONS}}` — decision log
- `{{CONTEXT}}` — job-specific instructions
- `{{PREVIOUS_RESULT}}` — accumulated results since last PM
- `{{ASSIGNMENT_ID}}`, `{{GROUP_ID}}`, `{{CURRENT_JOB_ID}}` — identifiers

PM templates also receive:
- `{{PM_MODULES}}` — dynamically assembled decision modules based on accumulated results

## Accumulated Results (Group-Aware)

The scheduler accumulates job results at the **group** level and passes them to the prompt builder:
- Each result is tagged with `groupId` and `groupIndex`.
- PM sees a formatted aggregation of results since the last PM group.
- Multiple results of the same job type are labeled with A/B/C suffixes.

This allows PM to:
- See full context for multi-agent reviews.
- Reference the **group prior to the review** (R-1) when applying post-review logic.

## PM Modular Logic

PM prompt behavior is modular and depends on which job types appear in accumulated results:

### After Plan
- If change is non-trivial: append `review`.
- If trivial or already reviewed: append `implement`.

### After Implement
- Append `review` for quality assessment.
- Include `uat` in the same group if UX is impacted.

### After Review (with R-1 context)
- Use the prior group (R-1) to infer **P-1** (plan vs implement).
- Decision logic:
  1. **Fundamental decisions required** → ask clarifying questions + block assignment.
  2. **High-severity issues with clear solution** → append new **P-1** job to refine.
  3. **Only medium/low/no issues and approval** →
     - If P-1 = plan: update plan doc, then append implement (or complete if planning-only).
     - If P-1 = implement: append implement or append document to finalize.

PM must always include issues raised and decision rationale in its response.

## Document Auto-Completion

`document` jobs update project documentation and then **auto-complete** the assignment when the group finishes.

## Product Owner Prompting

The PO prompt enforces stewardship of:
- `docs/project/spec/mental-model.md` as the evolving user perspective

The PO is responsible for:
- Updating the mental model after new user insights
- Asking clarifying questions if new info conflicts with existing mental model
- Creating assignments with a **verbose** north star (user perspective + success criteria)

## Chat Prompt Modes

Chat prompting uses **differential prompting** based on session state:
- **full**: new session with full `product-owner.md`
- **mode_activation**: mode changed (jam ↔ cook)
- **minimal**: same mode resume
- **guardian_eval**: PO evaluation of PM report

These are determined in `.agents/tools/workflow/lib/prompts.ts`.
