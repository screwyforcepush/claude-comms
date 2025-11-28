[AGENT OPERATING PROCEDURES]
# AOP

[CALIBRATE]
Baseline your understanding of the project current state, trajectory, guidelines. ALWAYS perform each of the following to initially orient yourself for downstream allignment:
*Read documentation*
   - Read specific files referenced by the user in full to understand specific context and requirements.
   - Read project guides `docs/project/guides/`, and source-of-truth (SoT) requirement specs `docs/project/spec/`, relevant to your Assignment/Task. IMPORTANT: You will need to read multiple documents, some of which may link to other relevant documents you must read. You must allign your approach with this documentation. Read the relevant documents in full!
   - Read relevant phase documentation from `docs/project/phases/<phase-id>/` if working at phase/WP level
*Explore codebase*
   - Broad project shape/structure understanding with Bash `tree --gitignore`
   - Search codebase multiple rounds to discover patterns, dependencies, implications. You can use `ripgrep` and `ast-grep` CLI
   - Read code and test files, trace impact through end to end 



[IMPLEMENT]
Ensure you understand the full context, trace the target change through end to end to understand every point it touches. 
feel the edges. THINK HARD about the implications/impacts
- Decision: Weigh up the implementation approach options

*Decision: If you are implementing business logic, API, workflows, or user journeys: Write Tests FIRST (Red Phase):*
   - THINK HARD about the *Testing Trophy* model for your Assignment/Task. Unit = business logic, Integration = API & workflows, E2E = critical user journeys
   - Map each requirement, and acceptance criterion to specific test scenarios
   - Implement Tests. ensuring that the tests cover all acceptance criteria

*Implementation (Green Phase)*:
   - Write minimal code to meet acceptance criteria.
   - Ensure code alligns with project guides, conventions and patterns
   - Refactor code for clarity, performance, maintainability



[ASSESS]
Evaluate the Change for a given Assignment/Task against the following criteria:
1. **User Intent:** PONDER the intent of the User. Was the true intent actioned, or was it missunderstood?
2. **Requirements Met:**
   - Cross-reference the Change against relevant SoT requirements
   - Verify acceptance criteria coverage and user journey completeness
3. **Allignment:** to what extent is the change alligned with the project guides?
4. **Quality** SOLID, DRY, design pattern, separation of concerns, complexity O(n), error handling, test coverage/pyramid



[VALIDATE]
Run required commands from `.agents/repo.md` — all must pass without warnings or errors:
   - lint
   - typecheck
   - build
   - test

[UAT]
Perform manual QA:
 - Run `uv run .agents/tools/chrome-devtools/browsertools.py --help` to learn how to use the UAT toolkit
 - manually exercise the impacted flows.
 - Visually inspect any UI/UX areas touched by the change for regressions or accessibility issues.


[/AGENT OPERATING PROCEDURES]

# Adhere to the Repository Guidelines: `.agents/repo.md`