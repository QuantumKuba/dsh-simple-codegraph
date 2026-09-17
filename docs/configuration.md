# Configuration Reference

`dsh-simple-codegraph` works out-of-the-box with zero configuration. For advanced requirements, you can customize its behavior in your DSH profile's `cordis.patch.yml`.

---

## Configuration Schema

Add or adjust the `dsh-simple-codegraph` entry under your profile's `cordis.patch.yml` (located at `~/.dsh/profiles/<profile>/cordis.patch.yml` or repo-level `cordis.patch.yml`):

```yaml
- id: dsh-simple-codegraph
  config:
    # Executable name or absolute path for CodeGraph CLI (default: 'codegraph')
    command: codegraph

    # Tool call execution timeout in milliseconds (default: 60000)
    toolCallTimeoutMs: 60000

    # Fail agent activation if CodeGraph MCP server fails to launch (default: false)
    failOnStartupError: false

    # Inject a microscopic routing hint into the system prompt when indexed (default: true)
    routingHint: true
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `command` | `string` | `'codegraph'` | Executable name or absolute path to the CodeGraph CLI binary. |
| `toolCallTimeoutMs` | `number` | `60000` | Per-tool-call execution timeout in milliseconds (minimum: `1`). |
| `failOnStartupError` | `boolean` | `false` | When `false`, startup errors are logged as warnings and agent boot continues without CodeGraph. When `true`, startup errors abort agent activation. |
| `routingHint` | `boolean` | `true` | Injects a compact, 1-sentence hint into `system-prompt/assemble` when a valid `.codegraph` index is detected, guiding the LLM to use CodeGraph over raw grep/read. |

---

## Common Use Cases

### Custom Binary Path

If `codegraph` was installed via Cargo or a custom package manager to a path not available in your standard system environment:

```yaml
- id: dsh-simple-codegraph
  config:
    command: /Users/username/.cargo/bin/codegraph
```

### High-Latency or Massive Codebases

For massive mono-repositories or complex query explorations where tree traversals may exceed 60 seconds:

```yaml
- id: dsh-simple-codegraph
  config:
    toolCallTimeoutMs: 120000 # 2 minutes
```

### Strict / Fail-Fast Mode

In automated benchmark harnesses or CI evaluation pipelines where you want tests to fail immediately if CodeGraph fails to launch:

```yaml
- id: dsh-simple-codegraph
  config:
    failOnStartupError: true
```

### Disabling the System Prompt Routing Hint

If you manage agent prompts and system instructions manually (e.g. through specialized agent rule files):

```yaml
- id: dsh-simple-codegraph
  config:
    routingHint: false
```

---

## Repository Discovery Behavior

`dsh-simple-codegraph` uses upward directory traversal starting from `agent.session.header.cwd` to detect `.codegraph/`.

- If your agent starts in a subfolder (e.g., `/my-project/packages/api`), the plugin will traverse upward to `/my-project` and pin the MCP instance to `/my-project`.
- If no `.codegraph/` directory is found in the directory hierarchy, CodeGraph is skipped cleanly for that agent session.
