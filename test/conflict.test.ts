import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as DshSimpleCodegraph from '../src/index.js'

class MockAgents extends Service {
  public agents: Agent[] = []
  constructor(ctx: Context) {
    super(ctx, 'agents')
  }
  list() {
    return this.agents
  }
  get(id: string) {
    return this.agents.find((a) => a.id === id)
  }
}

function createMockAgent(id: string, cwd: string): Agent {
  const agentCtx = new Context()
  return {
    id,
    ctx: agentCtx,
    session: {
      id,
      header: { cwd },
    },
  } as unknown as Agent
}

describe('Legacy MCP Conflict Handling', () => {
  it('should detect pre-existing global CodeGraph MCP tool, warn, and gracefully avoid duplication', async () => {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(MockAgents)

    // Pre-register a global tool simulating a legacy ~/.dsh/cordis.patch.yml global MCP row
    root.tools.register(
      defineTool({
        name: 'mcp__codegraph__codegraph_explore',
        description: 'Legacy global CodeGraph MCP tool',
        parameters: { query: { type: 'string', required: true } },
        output: {
          schema: { type: 'string' },
          render(_a, v) {
            return [{ type: 'text', text: String(v) }]
          },
        },
        async execute() {
          return 'legacy'
        },
      }),
    )

    // Capture warning logs
    const warnings: string[] = []
    root.on('internal/warning', (format, ...args) => {
      warnings.push(String(format))
    })

    const agent = createMockAgent('agent-conflict', process.cwd())
    root.agents.agents.push(agent)

    await root.plugin(DshSimpleCodegraph, {
      command: 'codegraph',
    })

    // Give asynchronous startup time
    await new Promise((r) => setTimeout(r, 400))

    // The legacy global tool must still exist and not be clobbered
    assert.ok(root.tools.get('mcp__codegraph__codegraph_explore'))

    // Agent view sees the inherited global tool without conflicting duplicate definitions
    const agentTools = root.tools.schemas(agent as any)
    assert.equal(agentTools.filter((t) => t.name === 'mcp__codegraph__codegraph_explore').length, 1)

    await root.fiber.dispose()
  })
})
