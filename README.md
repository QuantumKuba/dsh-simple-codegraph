# CodeGraph for DeepSeek Harness (`dsh-simple-codegraph`)

[![CI](https://github.com/deepseek-ai/dsh-simple-codegraph/actions/workflows/ci.yml/badge.svg)](https://github.com/deepseek-ai/dsh-simple-codegraph/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Bundle-blueviolet.svg)](https://github.com/deepseek-ai/deepseek-harness)

Production-grade DeepSeek Harness (DSH) integration for [CodeGraph](https://github.com/colbymchenry/codegraph).

Provides each DSH Agent with an isolated, project-scoped CodeGraph MCP connection. Instead of spending dozens of costly `grep`, `glob`, and `read_file` calls attempting to reconstruct a codebase AST, agents retrieve relevant verbatim source, call hierarchies, and blast-radius impact in a single focused exploration call.

Particularly optimized for **local 20B–30B models** (e.g., Qwen 2.5/3.x 27B/32B, DeepSeek local distillations) running in resource-constrained environments where tool schemas consume precious context, repeated file reads are slow, and unnecessary agent loops cause drift.

---

## Key Highlights

- **Genuine Per-Agent Isolation**: Every live Agent receives its own scoped CodeGraph MCP stdio process pinned to `agent.session.header.cwd`.
- **True Simultaneous Multi-Project Support**: Agent A working in `/repo-a` and Agent B working in `/repo-b` operate simultaneously with zero cross-project leakage or global config mutation.
- **Zero-Config Bundle Installation**: Installs natively via `dsh plugin add` with zero manual YAML editing, no manual `projectPath` maintenance, and no background daemons to manage.
- **One-Tool Philosophy for Small Models**: Exposes only `mcp__codegraph__codegraph_explore` by default. Minimizes schema tokens and eliminates tool-selection ambiguity for local models.
- **Compaction-Safe Architecture**: Keeps `CODEGRAPH_EXPLORE_DEDUP` disabled so DSH context pruning does not invalidate subsequent model queries.
- **Turn-1 Handshake Guarantee**: Pre-assembles prompt tools to ensure the MCP stdio handshake completes before Turn 1 prompt dispatch.

---

## Installation & Quick Start

### 1. Prerequisites

Ensure [CodeGraph CLI](https://github.com/colbymchenry/codegraph) is installed on your system:

```bash
codegraph --version
```

Index your project repository (one-time setup):

```bash
cd /path/to/my-project
codegraph init
```

### 2. Install Plugin

Add the bundle to your desired DSH profile (e.g., `web`, `headless`, `coding`):

```bash
dsh plugin --profile web add dsh-simple-codegraph
```

### 3. Run DeepSeek Harness

Run DSH inside your indexed repository:

```bash
cd /path/to/my-project
dsh --profile web
```

That is all. The CodeGraph MCP server boots automatically for each agent session, attaches to the repository root, and exposes the exploration tool to the agent.

---

## Architecture

Unlike implementations that mount a single global MCP process and rewrite `cordis.patch.yml` whenever the active UI tab changes, `dsh-simple-codegraph` establishes genuine agent-level encapsulation:

```
DeepSeek Harness Core
│
├── Agent A (cwd: /project-a)
│   └── Agent-Scoped Cordis Scope
│       └── @deepseek-ai/dsh-mcp-client
│           └── codegraph serve --mcp (pid: 1042, cwd: /project-a)
│
├── Agent B (cwd: /project-b)
│   └── Agent-Scoped Cordis Scope
│       └── @deepseek-ai/dsh-mcp-client
│           └── codegraph serve --mcp (pid: 1043, cwd: /project-b)
│
└── Agent C (unindexed or no cwd)
    └── CodeGraph MCP skipped cleanly (no hallucinated / wrong-codebase context)
```

### Lifecycle Guarantees

1. **Agent Created**: A child Cordis context is spawned (`createScope(ctx, agent)`). If `agent.session.header.cwd` contains a valid `.codegraph` index, the MCP client spawns `codegraph serve --mcp` with that cwd.
2. **Turn 1 Synchronization**: An early `system-prompt/assemble` waterfall listener blocks prompt assembly until the MCP handshake completes (~300ms), ensuring `mcp__codegraph__codegraph_explore` is immediately visible on Step 1.
3. **Agent Disposed**: Closing or aborting the agent cleanly terminates the child stdio process without orphan processes.
4. **Plugin Unloaded**: Disposing the root plugin cleanly terminates all active agent MCP child processes.

---

## Small-Model Optimization Design

### The One-Tool Philosophy

Local 20B–30B models have constrained attention and higher susceptibility to tool-selection confusion. When presented with 8+ overlapping tools (`node`, `callers`, `callees`, `impact`, `files`, `status`, etc.), small models often:
- Waste context tokens on unused schemas.
- Pick the wrong tool (e.g., calling `node` or `files` when they need AST call paths).
- Fall back to familiar tools (`grep`, `read_file`) because the schema space is cluttered.

`dsh-simple-codegraph` preserves CodeGraph's upstream design by exposing **only** `codegraph_explore` (namespace `mcp__codegraph__codegraph_explore`). A single query yields AST relationships, blast radius, and verbatim line-numbered source.

### Context Compaction & Cross-Call Dedup

CodeGraph provides an optional `CODEGRAPH_EXPLORE_DEDUP` flag. However, in DeepSeek Harness, compaction plugins (`dsh-compaction-tool-result-pruner` and `dsh-compaction-basic`) aggressively prune or summarize earlier tool results when the context window fills up.

If dedup were enabled, CodeGraph would reply with `"Already sent earlier"`, but the model would no longer have the source in its pruned context! Therefore, **`CODEGRAPH_EXPLORE_DEDUP` is intentionally kept disabled**. Correctness is strictly prioritized over marginal token savings.

### Microscopic Routing Hint

Rather than injecting thousands of tokens of duplicate CodeGraph documentation into every turn's system prompt, `dsh-simple-codegraph` injects a microscopic 1-sentence routing hint only when working in an indexed repository:

> *"CodeGraph is active for this repository. For code discovery, architecture, call flows, symbol locations, and blast-radius exploration, prefer `mcp__codegraph__codegraph_explore` over raw grep or file reads. Verbatim line-numbered source returned by CodeGraph is already read."*

---

## Configuration

In most cases, default configuration is ideal. If needed, settings can be customized in your profile's `cordis.patch.yml`:

```yaml
- id: dsh-simple-codegraph
  config:
    # Command to run CodeGraph (default: 'codegraph')
    command: codegraph

    # Tool execution timeout in milliseconds (default: 60000)
    toolCallTimeoutMs: 60000

    # Whether to fail startup if CodeGraph fails to launch (default: false)
    failOnStartupError: false

    # Inject microscopic routing hint into system prompt (default: true)
    routingHint: true
```

---

## Migration Guide

### Migrating from PR #1591 Style Global MCP Configuration

If you previously added a global CodeGraph MCP entry to `~/.dsh/cordis.patch.yml` or `~/.dsh/profiles/<profile>/cordis.patch.yml`:

1. Remove the legacy global entry from `cordis.patch.yml`:
   ```diff
   - - id: mcp-client-codegraph
   -   name: '@deepseek-ai/dsh-mcp-client'
   -   config:
   -     serverName: codegraph
   -     command: codegraph
   -     args: ['serve', '--mcp']
   ```
2. Install `dsh-simple-codegraph`:
   ```bash
   dsh plugin --profile <profile> add dsh-simple-codegraph
   ```

### Migrating from `@hyzyn/dsh-codegraph`

`@hyzyn/dsh-codegraph` managed a shared global MCP process and modified configuration on project switches.
To migrate:
1. Uninstall `@hyzyn/dsh-codegraph`:
   ```bash
   dsh plugin --profile <profile> remove @hyzyn/dsh-codegraph
   ```
2. Install `dsh-simple-codegraph`:
   ```bash
   dsh plugin --profile <profile> add dsh-simple-codegraph
   ```

### Migrating from `jiangzhenguo/dsh-codegraph`

`jiangzhenguo/dsh-codegraph` reimplemented CodeGraph CLI commands as 13 native DSH tools.
To migrate:
1. Uninstall `jiangzhenguo/dsh-codegraph`:
   ```bash
   dsh plugin --profile <profile> remove dsh-codegraph
   ```
2. Install `dsh-simple-codegraph`:
   ```bash
   dsh plugin --profile <profile> add dsh-simple-codegraph
   ```

---

## Troubleshooting

### `codegraph` Not Found on PATH
- **Symptom**: Agent boots normally, but `mcp__codegraph__codegraph_explore` is not available.
- **Fix**: Verify `which codegraph` works in your shell. If installed in a non-standard path, configure `command: "/full/path/to/codegraph"` in `cordis.patch.yml`.

### Repository Not Indexed
- **Symptom**: Tool does not appear for a specific workspace.
- **Fix**: Run `codegraph init` in that repository. The plugin requires a valid `.codegraph` directory to avoid silently running against an unindexed or wrong directory.

### Legacy Global MCP Detected
- **Symptom**: Console outputs: `[dsh-simple-codegraph] Warning: Pre-existing global CodeGraph MCP tool detected...`
- **Fix**: Remove the global CodeGraph MCP configuration from your `cordis.patch.yml` to enable per-agent isolation.

---

## Development & Testing

```bash
# Install dependencies
pnpm install

# Compile TypeScript
pnpm run build

# Run unit and lifecycle tests
pnpm test

# Run benchmark suite
pnpm run bench
```

## License

MIT © 2026 DeepSeek Harness Community
