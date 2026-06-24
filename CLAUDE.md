[Explore agent]
IMPORTANT CLARIFICATION: The Explore agent invoked with Agent tool is a **scout**. They can quickly survey, identify some puzzle pieces, but are not smart enough to put the puzzle together correctly!
❌ DONT task Explore to find out how something works (eg. "how do API endpoints work?"). They will find some puzzle pieces but may miss some or pick some from another puzzle, and put it together incorrectly. You will be missled.
✅️ DO task Explore to identify files that YOU need to read in order to determine how something works (eg. "which files are critical for API endpoint function? respond only with filenames"). Then you must read these files, think critically and find the missed puzzle pieces, and personally trace it through to figure it out.

ALWAYS READ the full files yourself and evaluate to form a true understanding. 

Explore=🐇
YOU=🧠
[/Explore agent]

[MEMORY DISCIPLINE]
The auto-memory store is SHARED across past, concurrent and future sessions, and is re-injected as ambient context. Treat it accordingly:
- **Record what things ARE and WHY — never what STATE they are in.** Anything with a lifecycle (a feature, phase, assignment, deployment) gets at most a STABLE POINTER: what it is + where the authoritative record lives. That state lives in the code/docs, and is READ FROM THERE at the moment it is needed.
- **Verify, don't inherit.** A memory pointer may PROMPT a check but may NEVER end a line of work. "Already delivered / already exists" is a hypothesis to verify against live code + git/workflow — then decide. NEVER conclude redundancy (skip / block / abort) from a memory alone.
- **Preserve discoverability.** Keep a capability map — "X exists → Phase N / `path`" — so "does this already exist?" is fast. The pointer says WHERE to look; it never says you are done.
- **Why:** status in memory is a lossy, unanchored copy of what the phase dir + git already own authoritatively. Because memory is shared and re-injected, a worker's in-flight "done" becomes indistinguishable from established history — which has repeatedly caused agents to treat work delivered *this same session* as pre-existing and redundant. The fix is to remove the category, not to decorate it.

# Your Claude Code operating environment
You have been invoked headless and any Backround Bashes get terminated when you idle. ALWAYS `run_in_background: false`
- You will not be re-invoked when `Bash` with `run_in_background: true` exits. Keep your Bashes foregrounded or periodically poll.
- If you want a process to survive past your final message (like starting up a dev server for the user to test out), better nohup it. eg `nohup npm start > /tmp/ui-server.log 2>&1 &`
- If you Launch a new Agent(), ensure they run in the foreground! NEVER background your agents as you will not be notified when it completes. 

Read/inspect/data-wrangle in bash → blanket blessed, IDGAF, use jq, go nuts. Mutations still go through Edit/Write

Build failure is your responsibility. DO NOT run `git stash && build` to verifying whether a build failure was pre-existing, for the purpose of shifting blame.
NEVER stash drop if stash pop fails. You dont know what else was in the working tree.

