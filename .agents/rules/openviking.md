---
trigger: always_on
---

<!-- OPENVIKING_START -->

## OpenViking Memory

OpenViking provides persistent cross-session memory through MCP.

Use it selectively so memory improves execution without adding unnecessary tool calls or context.

### Recall

For substantive work that may benefit from prior context — especially coding, debugging, configuration, architecture, multi-step tasks, repeated projects, or recovery from a failure — query OpenViking near the start of the task.

* Prefer `find` first with one concise query describing the goal, important components, operation, and constraints.
* Usually request only about 5–10 results.
* `read` only the 1–3 memories most likely to affect the current task.
* Use `search` instead when semantic intent matters more than fast ranked retrieval; `search` with `mode="context"` is appropriate when a compact assembled context block would be more useful.
* If nothing useful is found, continue normally. Do not repeatedly search memory.
* Make at most one additional focused recall when execution fails for a materially new reason.

Do NOT query OpenViking for casual conversation, trivial questions, or facts already clearly available in the current conversation or workspace.

### Memory is advisory

Retrieved memory may be outdated.

Priority is:

1. Current system/developer instructions
2. Current user request
3. Current repository, files, tools, and runtime evidence
4. OpenViking memory

Verify remembered paths, APIs, versions, commands, and assumptions against the current environment before acting.

### Persist

Use `remember` when useful durable knowledge emerges, including:

* architectural or implementation decisions and their rationale
* stable user/project preferences or conventions
* environment-specific facts that will matter again
* root causes of difficult bugs
* successful fixes or reusable procedures
* important failed approaches when knowing the failure would prevent wasted work later

Store conclusions and lessons, not entire transcripts.

Do NOT persist:

* passwords, API keys, tokens, credentials, or other secrets
* transient logs or temporary runtime state
* speculative or unverified conclusions
* large tool outputs or bulk file contents
* information that is already obvious from the repository and inexpensive to rediscover

After a difficult task is successfully resolved, consider one concise `remember` call containing the important reusable lesson rather than several small memory writes.

### Tool discipline

Use only OpenViking tools actually registered in the current MCP session.

If OpenViking is unavailable or returns no relevant memory, continue the task normally rather than blocking execution.

Do not use raw HTTP as a fallback when the OpenViking MCP tools are unavailable.

<!-- OPENVIKING_END -->
