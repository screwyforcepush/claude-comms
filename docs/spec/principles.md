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