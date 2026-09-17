import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
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

function createMockAgent(id: string, cwd?: string): Agent {
  const agentCtx = new Context()
  return {
    id,
    ctx: agentCtx,
    session: {
      id,
      header: cwd !== undefined ? { cwd } : {},
    },
  } as unknown as Agent
}

describe('Plugin Lifecycle', () => {
  it('should skip mounting when agent has no session cwd', async () => {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(MockAgents)

    const agentNoCwd = createMockAgent('agent-no-cwd', undefined)
    root.agents.agents.push(agentNoCwd)

    await root.plugin(DshSimpleCodegraph, {
      command: 'codegraph',
    })

    // No tool should be registered for agentNoCwd
    const tools = root.tools.schemas(agentNoCwd as any)
    assert.equal(tools.length, 0)

    await root.fiber.dispose()
  })

  it('should mount CodeGraph MCP on agent/created and unmount on agent/disposed', async () => {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(MockAgents)

    await root.plugin(DshSimpleCodegraph, {
      command: 'codegraph',
      failOnStartupError: false,
    })

    const agent = createMockAgent('agent-1', process.cwd())
    root.agents.agents.push(agent)

    // Emit agent/created
    root.emit('agent/created', { agent })

    // Give asynchronous MCP startup a moment to settle
    await new Promise((r) => setTimeout(r, 1200))

    const agentTools = root.tools.schemas(agent as any)
    assert.equal(agentTools.length, 1)
    assert.equal(agentTools[0].name, 'mcp__codegraph__codegraph_explore')

    // Global view should NOT see the agent-scoped tool
    const globalTools = root.tools.schemas()
    assert.equal(globalTools.some((t) => t.name === 'mcp__codegraph__codegraph_explore'), false)

    // Emit agent/disposed
    root.emit('agent/disposed', { agent })
    await new Promise((r) => setTimeout(r, 300))

    // Tools for agent should now be gone
    const toolsAfterDispose = root.tools.schemas(agent as any)
    assert.equal(toolsAfterDispose.length, 0)

    await root.fiber.dispose()
  })

  it('should clean up all active agent MCP sessions when root plugin is disposed', async () => {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(MockAgents)

    const agent = createMockAgent('agent-cleanup', process.cwd())
    root.agents.agents.push(agent)

    const pluginFiber = await root.plugin(DshSimpleCodegraph, {
      command: 'codegraph',
      failOnStartupError: false,
    })

    await new Promise((r) => setTimeout(r, 1200))

    const agentTools = root.tools.schemas(agent as any)
    assert.equal(agentTools.length, 1)

    // Disposing the plugin should clean up child MCP processes
    await pluginFiber.dispose()
    await new Promise((r) => setTimeout(r, 200))

    // Tools should be gone
    const toolsAfterPluginDispose = root.tools.schemas(agent as any)
    assert.equal(toolsAfterPluginDispose.length, 0)

    await root.fiber.dispose()
  })

  it('should handle startup error gracefully when failOnStartupError is false', async () => {
    const root = new Context()
    await root.plugin(SystemPrompt)
    await root.plugin(ToolRuntime)
    await root.plugin(MockAgents)

    const agent = createMockAgent('agent-err', process.cwd())
    root.agents.agents.push(agent)

    // Use a non-existent command with failOnStartupError: false
    await root.plugin(DshSimpleCodegraph, {
      command: 'non_existent_codegraph_binary_xyz_123',
      failOnStartupError: false,
    })

    await new Promise((r) => setTimeout(r, 600))

    // Does not throw, DSH remains completely usable
    const agentTools = root.tools.schemas(agent as any)
    assert.equal(agentTools.length, 0)

    await root.fiber.dispose()
  })
})
