# Migration Guide

This guide helps you transition from legacy CodeGraph implementations to `dsh-simple-codegraph`.

---

## Migrating from PR #1591 Global MCP Configuration

In earlier approaches (such as DeepSeek Harness PR #1591), a single global MCP client was defined in `cordis.patch.yml`. This caused CodeGraph to run globally, locking all agents to whatever directory the DSH host process started in.

### Step 1: Remove Global Entry from `cordis.patch.yml`

Check `~/.dsh/cordis.patch.yml` or `~/.dsh/profiles/<profile>/cordis.patch.yml` and delete the legacy global block:

```diff
- - id: mcp-client-codegraph
-   name: '@deepseek-ai/dsh-mcp-client'
-   config:
-     serverName: codegraph
-     command: codegraph
-     args: ['serve', '--mcp']
```

### Step 2: Install `dsh-simple-codegraph`

```bash
dsh plugin --profile <profile> add dsh-simple-codegraph
```

Now each agent session automatically spawns an isolated CodeGraph process scoped to its repository root.

---

## Migrating from `@hyzyn/dsh-codegraph`

The `@hyzyn/dsh-codegraph` plugin maintained a single shared global MCP process and attempted to switch repositories dynamically by modifying configuration on UI tab changes.

### Step 1: Uninstall `@hyzyn/dsh-codegraph`

```bash
dsh plugin --profile <profile> remove @hyzyn/dsh-codegraph
```

### Step 2: Install `dsh-simple-codegraph`

```bash
dsh plugin --profile <profile> add dsh-simple-codegraph
```

### Differences You Will Notice
- No more configuration file mutations when switching between open tabs.
- Multi-project agents can now run simultaneously without interfering with one another.

---

## Migrating from `jiangzhenguo/dsh-codegraph`

The `jiangzhenguo/dsh-codegraph` plugin unpacked the CodeGraph CLI into 13 separate native DSH tools (`node`, `callers`, `callees`, `impact`, `files`, `status`, etc.).

### Step 1: Uninstall `dsh-codegraph`

```bash
dsh plugin --profile <profile> remove dsh-codegraph
```

### Step 2: Install `dsh-simple-codegraph`

```bash
dsh plugin --profile <profile> add dsh-simple-codegraph
```

### Why Migrate?
- **Lower Schema Overhead**: Reduces prompt token consumption by ~1,000 tokens per turn.
- **Better Small-Model Performance**: Prevents 20B–30B local models from getting stuck in tool-selection loops.
- **Upstream Alignment**: Matches the single-tool design recommended by CodeGraph.
