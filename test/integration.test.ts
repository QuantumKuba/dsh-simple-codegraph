import './setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as DshSimpleCodegraph from '../src/index.js'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

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

function createMockAgent(id: string, cwd: string, root?: Context): Agent {
  const agentCtx = root ? root.extend() : new Context()
  return {
    id,
    ctx: agentCtx,
    session: {
      id,
      header: { cwd },
    },
  } as unknown as Agent
}

describe('CodeGraph Integration and Surface Contracts', () => {
  it('should strictly expose ONLY the single exploration tool by default', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-surface-'))

    try {
      writeFileSync(join(dir, 'math.ts'), 'export function add(a: number, b: number) { return a + b; }\n')
      execSync('codegraph init', { cwd: dir, stdio: 'pipe' })

      const root = new Context()
      await root.plugin(SystemPrompt)
      await root.plugin(ToolRuntime)
      await root.plugin(MockAgents)

      await root.plugin(DshSimpleCodegraph, {
        command: 'codegraph',
        failOnStartupError: true,
        routingHint: true,
      })

      const agent = createMockAgent('agent-surface', dir, root)
      root.agents.agents.push(agent)
      root.emit('agent/created', { agent })

      await new Promise((r) => setTimeout(r, 1200))

      const schemas = root.tools.schemas(agent as any)

      // Only exactly one CodeGraph tool must be visible
      const codegraphTools = schemas.filter((s) => s.name.startsWith('mcp__codegraph__'))
      assert.equal(codegraphTools.length, 1)
      assert.equal(codegraphTools[0].name, 'mcp__codegraph__codegraph_explore')

      // Disallowed tools must NOT be present
      const disallowed = [
        'mcp__codegraph__codegraph_node',
        'mcp__codegraph__codegraph_search',
        'mcp__codegraph__codegraph_callers',
        'mcp__codegraph__codegraph_callees',
        'mcp__codegraph__codegraph_impact',
        'mcp__codegraph__codegraph_files',
        'mcp__codegraph__codegraph_status',
      ]
      for (const name of disallowed) {
        assert.equal(
          schemas.some((s) => s.name === name),
          false,
          `Tool ${name} must NOT be visible by default`,
        )
      }

      // Verify system prompt routing hint when index is present and routingHint: true
      const assembly = await root.systemPrompt.assemble({ agent, scope: agent as any })
      const rendered = renderPrompt(assembly)
      assert.ok(
        rendered.includes('mcp__codegraph__codegraph_explore'),
        'System prompt should include microscopic routing hint for indexed repository',
      )

      // Dispose agent cleanly
      root.emit('agent/disposed', { agent })
      await new Promise((r) => setTimeout(r, 100))
      await root.fiber.dispose()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('should NOT inject routing hint when routingHint is false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-nohint-'))

    try {
      writeFileSync(join(dir, 'math.ts'), 'export function mul(a: number, b: number) { return a * b; }\n')
      execSync('codegraph init', { cwd: dir, stdio: 'pipe' })

      const root = new Context()
      await root.plugin(SystemPrompt)
      await root.plugin(ToolRuntime)
      await root.plugin(MockAgents)

      await root.plugin(DshSimpleCodegraph, {
        command: 'codegraph',
        failOnStartupError: true,
        routingHint: false,
      })

      const agent = createMockAgent('agent-nohint', dir, root)
      root.agents.agents.push(agent)
      root.emit('agent/created', { agent })

      await new Promise((r) => setTimeout(r, 1200))

      const assembly = await root.systemPrompt.assemble({ agent, scope: agent as any })
      const rendered = renderPrompt(assembly)
      assert.ok(
        !rendered.includes('mcp__codegraph__codegraph_explore'),
        'System prompt should NOT include routing hint when routingHint: false',
      )

      await root.fiber.dispose()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
