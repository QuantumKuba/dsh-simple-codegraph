# Troubleshooting Guide

Common issues, symptoms, and solutions when using `dsh-simple-codegraph`.

---

## 1. `codegraph` Not Found on PATH

### Symptom
DeepSeek Harness boots normally, but `mcp__codegraph__codegraph_explore` does not appear in the agent's available tools.

### Cause
The `codegraph` executable is not present in the system `PATH` inherited by the DeepSeek Harness environment (frequent with GUI launches or custom package manager locations like `~/.cargo/bin`).

### Solution
1. Verify `codegraph` is installed:
   ```bash
   which codegraph
   ```
2. If `which codegraph` outputs a path (for example, `/Users/username/.cargo/bin/codegraph`), configure the explicit path in your `cordis.patch.yml`:
   ```yaml
   - id: dsh-simple-codegraph
     config:
       command: /Users/username/.cargo/bin/codegraph
   ```

---

## 2. Repository Not Indexed

### Symptom
`mcp__codegraph__codegraph_explore` is available in some projects, but not in another.

### Cause
`dsh-simple-codegraph` inspects the directory hierarchy above the agent's working directory (`agent.session.header.cwd`) for a `.codegraph/` folder. If no index exists, CodeGraph is skipped to prevent hallucinated context or errors.

### Solution
Navigate to the root of the target project and initialize the CodeGraph index:

```bash
cd /path/to/my-project
codegraph init
```

Once initialized, new agent sessions in that project will automatically connect to CodeGraph.

---

## 3. Pre-Existing Global MCP Conflict

### Symptom
The console logs the following warning during agent initialization:

```text
[dsh-simple-codegraph] Warning: existing global CodeGraph MCP integration detected (mcp__codegraph__codegraph_explore). Remove the legacy global CodeGraph MCP row from cordis.patch.yml to enable per-Agent project routing.
```

### Cause
A global MCP client configuration for CodeGraph is still defined in `cordis.patch.yml`. When present, the global tool occupies the `mcp__codegraph__codegraph_explore` namespace, preventing per-agent scoped isolation.

### Solution
Open your `cordis.patch.yml` (either in `~/.dsh/profiles/<profile>/cordis.patch.yml` or repo root) and delete the global entry:

```yaml
# DELETE THIS BLOCK:
- id: mcp-client-codegraph
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: codegraph
    command: codegraph
    args: ['serve', '--mcp']
```

Then restart DeepSeek Harness.

---

## 4. Enabling Debug Logs

To see detailed mounting and lifecycle logs from `dsh-simple-codegraph`:

Run DSH with debug logging enabled:

```bash
DEBUG=dsh-simple-codegraph* dsh --profile web
```

Or configure the Cordis logger in your profile settings to output debug-level messages for `dsh-simple-codegraph`.
