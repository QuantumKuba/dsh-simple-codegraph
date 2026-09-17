# Setup & Installation Guide

This guide covers prerequisites, installation options, and environment verification for `dsh-simple-codegraph`.

---

## 1. Prerequisites

### CodeGraph CLI

`dsh-simple-codegraph` connects DeepSeek Harness to the local [CodeGraph CLI](https://github.com/colbymchenry/codegraph). Ensure the `codegraph` binary is installed and accessible on your `PATH`:

```bash
codegraph --version
```

If `codegraph` is installed in a custom location not on your default `PATH`, you can specify its explicit path in your [configuration](configuration.md#custom-binary-path).

### Indexing Repositories

Each project codebase that agents work in must have a `.codegraph/` index. Run the initialization command once at the root of your repository:

```bash
cd /path/to/my-project
codegraph init
```

> [!NOTE]
> If a repository does not contain a `.codegraph/` index, `dsh-simple-codegraph` automatically skips initializing CodeGraph for that session. This prevents hallucinated or out-of-scope context in unindexed directories.

---

## 2. Plugin Installation

`dsh-simple-codegraph` is distributed as a DeepSeek Harness bundle plugin. You can install it directly using the `dsh plugin` CLI.

### Installing to Default Profile

```bash
dsh plugin add dsh-simple-codegraph
```

### Installing to a Specific Profile

If you use profile-specific configurations (such as `web`, `coding`, or `headless`), install the plugin with the `--profile` flag:

```bash
# Install to the web profile
dsh plugin --profile web add dsh-simple-codegraph

# Install to the coding profile
dsh plugin --profile coding add dsh-simple-codegraph
```

---

## 3. Running DeepSeek Harness

Once installed, navigate to any indexed repository and launch DSH:

```bash
cd /path/to/my-project
dsh --profile web
```

The plugin automatically:
1. Detects `agent.session.header.cwd`.
2. Verifies the presence of `.codegraph/`.
3. Launches a dedicated `codegraph serve --mcp` stdio process pinned to that directory.
4. Exposes `mcp__codegraph__codegraph_explore` to the agent on Turn 1.

---

## 4. Multi-Project Workflows

`dsh-simple-codegraph` natively supports simultaneous multi-project workflows without manual switching:

- When Agent A opens `/workspace/frontend`, an MCP instance boots rooted in `/workspace/frontend`.
- When Agent B opens `/workspace/backend`, a separate MCP instance boots rooted in `/workspace/backend`.
- There is no shared global process or cross-project state leakage.

For technical details on how agent isolation is achieved, see the [Architecture Guide](architecture.md).
