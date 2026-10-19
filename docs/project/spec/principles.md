# PRINCIPLES of context wizzardry in agentic systems:
RULE NUMBER 1: every agent gets ONLY the context they need.
 - everything they need
 - nothing they dont

What do I mean by this?
They need to understand the area within which they are working, they need to know why, they need to understand the broader implications to an extent so they dont mistakenly break stuff.
in practice:
- Primary ⚙️Orchestrator doesnt read many files, doesnt change code, only deligates
- subagents get a fresh context window, they are temperary
- even understanding bigger orchestration scope is offloaded to agent-orchestrator advisor
- perplexity ask is a subagent too for web research so the deep-research agent doesnt stuff its context with web scraping crud
- parallel agents can communicate so they get relevant context for common objectives eg. shared dependency changes.
- hooks dont eat context, mcp tools do. minimise tool availability to the essential.



There is no rule number 2. this is First Principle for everything else

Value/Token Ratio. signal to noise. Give the model FOCUS.

## Tips and tricks:
- Draw 🤖 attention using IMPORTANT key words and symbols ✅ 
- Why waste token say lot word when few word do trick?
- Leverage vocab for maximal compression while remaining unambiguous to the model.
- Feedback loops. agents need internal feedback loops, orchestrators need agentic feedback loops
- CLAUDE.md is more of a reference file, in context but not always followed organically. The commands are the true prompts and can linkback to CLAUDE.md with attention mechanisms.


# Performance at Scale
A lot of agentic harness engineering is figuring out how to throw more autonomous compute at a problem, while being performant at scale.

**Problem Context**
For a large assignment/feature/project A human can sequentially prompt a single agent to completion. This is heavy on human in the loop. low autonomous compute.
Prompting an agent with a large project leads to poor results, the context fills before it can complete. Agents get dumber as their context fills past 50k tokens. Dont trust an agent past 100k tokens in context. 
Give the orchestrator autonomy, to act on your behalf, and employ ephemeral subagents. load minimal context they need for their thin slice of the assignment scope.

**Batch Concurrent Parallelisation**
Speed multiplier at scale. Paralellise as much as possible.
- Tool uses: agent can call multiple tools at once. Low risk. A bit of basic prompt engineer for parrelisation decision logic. eg. parallelise multiple reads, sequence read then write
- Agents: Teams of agents can be employed at the same time. High risk. requires significant agentic harness engineering.
- Recursive Orchestration: Exponential scaling. Shows some merrit but experimental and unproven. Observability and in turn emprical evidence has not been addressed

## Intent based Outcomes 
Problem: The orchestrator agent assigns tasks to subagents. great. but I cant trust the orchestrator to distill the original intent enough so the subagent understands why. It needs to understand the why, the purpose, the north star. Otherwise it will "do the job assigned" but leave loose ends out of scope, rough edges at integration points, gaps between subagents that were not explicity assigned.
Approach: I have the orchestrator include the original user prompt within the subagent prompt, framed as the high level epic objective. so the subagent understands they are a part of a bigger picture and will work in better allignment.

## Parallel agent collaboration
Problem: Orchestrating multiple parallel subagents concurrently can lead to each subagent going its own way and the missalignment from a wholistic system. What if they pick a different lib, duplicate an existing service, or have write conflicts on common files?
Approach: The agents communicate with each other as they work. call out discoveries, decisions, and provide feedback to each other. They work as a team. Some subagents are added to the team with the sole purpose of supporting/advising other agents!

## Agent Model Diversity
Just like the various subagent types, Anthropic's Claude Code, OpenAI's Codex, and Google's Gemini agent have strengths and weaknesses inherent in the models+harness.
Dont pick one, use claude, codex, and gemini!. I've built "consultant" subagents which are claude, and all it does is spin up a headless codex/gemini agent instance and wait for it to finish. 
- the codex and gemini agents can communicate with any parallel claude, codex, or gemini agents. after execution the agent final response bubbles up through the consultant proxy back to the orchestrator.
- The orchestrator doesnt know that the consultant is doing this, it doesnt need to know. All it knows is that it assigns a task to consultant, it gets executed on, and it gets a response back.
- The orchestrator gets the agents to check each others work to gap fill weaknesses in individual models. Claude checks Codex's work, Codex checks Gemini's work, Gemini checks Claudes work.
- When planning/architecting, the orchestrator get one of each to independently analyse, research, plan. then the orchestrator merges to get the best of both perspectives.

## Harness Leakage
Problem: AI is bad at prompting AI. If I ask an AI to write the prompt for my UAT agent, it will absolutely tell the UAT agent what happens next. A PM spawns, decides implement or refine or close out. UAT doesnt need to know any of that. It needs to run the dev server, drive the browser, report what it finds. Thats it.
I call it harness leakage: the surrounding deterministic/workflow infrastructure (what happens next, what happens to the output afterward) leaking into the unit level prompt.
It is not just noise. Telling the model about future states it cant measure and doesnt control creates anxiety. It starts handling things that are not its to handle, or reaches into the next stage. An early PM that was told about job insertion started inserting jobs itself.
Leaks I keep catching:
- "when you hit the limit your tool results get compacted into this shape". It will see the compacted shape when it happens. Knowing in advance changes nothing except its nerves.
- voice agent: "if the customer is disqualified, hang up". The harness hangs up. The agent collects the info. It doesnt even need to know there IS a disqualifier, thats the harness's decision.
- tool description: "loads the artifact from the database without metadata". The consuming agent doesnt need to know storage metadata exists.
- tool described in the system prompt AND in the tool def. Now the prompt drifts from the tool.
Approach: the agent is a unit. Separation of concerns. It gets the why (north star), the area it works in, how to do the thing, how to report back. Nothing downstream of its output. The fix is omission: purpose stays, machinery goes.
- Error messages are the point of disclosure. Query limit, permission scope: it hits the wall, reads the error, learns. Progressive Disclosure again.
- Dont patch a leak with scolding ("Do NOT leak between contexts"). Thats whack-a-mole on the symptom, and models follow positive direction better than dont. Cut the line that leaks.
- I let the AI draft prompts, then hand-refine. The prompt is the one artifact I dont delegate. Write it from the perspective of the agent that consumes it, an agent inside the harness. Ironically the AI is bad at this even though it IS an agent inside the harness.

## Memory
Auto-memory (harness memory that persists across sessions) is the Steward's alone. Crew get the north star, Artifacts/Decisions, and the repo. That is everything they need, nothing they dont. Memory in a crew prompt is the Steward's surroundings leaking into the unit: who I am, what else is in flight, what other jams settled. A crew read is a context tax. A crew write is unsupervised churn.
What goes in memory is whats left after the other homes:
- product why → `mental-model.md`
- harness bad habits → `CLAUDE.md`
- anything a crew needs → repo guides
- the residual → memory. The context AROUND the repo: people, businesses, entities, relationships, my vocab and stances with no repo home yet, rejected paths, what a jam settled that landed nowhere else.
Record what things ARE and WHY. Never STATE. State lives in code, git, assignment records and gets read from there when it is needed. A memory pointer prompts a check, it never ends a line of work.

## Progressive Disclosure
Loading up all important context all the time, chokes the model's context and confuses it. The agents can pull in what they need when they need it. Just provide them an index of resources and when to consume/use them.
This is why you will find pointers to docs, scripts, prompts in key locations in the codebase.
Simply put: instruct the agents how and when to get the context it may need SOMETIMES. Feed it context that it needs ALWAYS directly. 

## Visual Feedback
Problem: When building a product with a front end, code review is not enough. e2e tests help but sometimes the agents fail to hit all the critical user flows. Also, what if it just looks like shit? An element selector wont pick up ugly UX. Ive tried A11y but thats so overbearing and noisy. What is needed is a user's perspective.

### Human loop
I built `annotated-feedback`. its a widget + mcp package. widget goes in the app, mcp is for the agent. Inside the app, the widget is used to provide text feedback on any page, and provides an excallidraw canvas overlay for annotations/diagram/watever. Feedback is submitted by the human, Agent picks its up via mcp: screenshot of the page with canvas overlay, text feedback, url/route.
This is a highly detailed and unambiguous prompting medium. Less context switching for the human as they submit feedback as they use the app!
To keep the annotated-feedback MCP surface minimal, tool responses intentionally expose only a subset of the underlying Convex document:
- `list` returns an array of `{ _id, createdAt, updatedAt, url, note, status }`.
- `get` returns the same metadata plus an inline screenshot (base64-encoded PNG) when one is available.
- `update` returns a confirmation object containing `success` and `message`.

### Agent loop
UAT agent that is part of the validation/approval batch, uses chrome devtools mcp to navigate theh running dev server UI, perform the user flows, screenshot and visually inspect at checkpoints, give feedback, raise issues, provide browser console logs, etc. They act as the user.
Problem: Here is the thing with that chrome devtools MCP. When installed, it floods the context of all agents with a LOT of tool defs, usage examples, etc. It has 26+ tools in it! is not a light weight MCP like perplexity-ask (1 tool). This fat context dump gets injected into every instance of every agent, includeing the orchestrator, even when it is not needed for the current assignment. 
Approach: uninstall the MCP, and wrap it in a script. Sprinkle in some agentic harness engineering. And we have the same outcome at half the context cost (A/B tested mcp vs script wrapper). Not only is it half the context cost for a UAT task, it also cuts the context bloat out of the agents who DO NOT need to use it. Progressive Disclosure: agents can learn how to use the script only when they need to, using --help.