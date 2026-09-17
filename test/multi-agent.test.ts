import './setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
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

describe('Multi-Agent Isolation', () => {
  it('should maintain true simultaneous multi-project isolation for Agent A and Agent B', async () => {
    const dirA = mkdtempSync(join(tmpdir(), 'cg-multi-a-'))
    const dirB = mkdtempSync(join(tmpdir(), 'cg-multi-b-'))

    try {
      // Set up Project A
      writeFileSync(
        join(dirA, 'authService.ts'),
        'export function uniqueSymbolAlpha() {\n  return "SECRET_ALPHA_TOKEN";\n}\n',
      )
      execSync('codegraph init', { cwd: dirA, stdio: 'pipe' })

      // Set up Project B
      writeFileSync(
        join(dirB, 'billingService.ts'),
        'export function uniqueSymbolBeta() {\n  return "INVOICE_BETA_RECORD";\n}\n',
      )
      execSync('codegraph init', { cwd: dirB, stdio: 'pipe' })

      const root = new Context()
      await root.plugin(SystemPrompt)
      await root.plugin(ToolRuntime)
      await root.plugin(MockAgents)

      await root.plugin(DshSimpleCodegraph, {
        command: 'codegraph',
        failOnStartupError: true,
      })

      const agentA = createMockAgent('agent-a', dirA)
      const agentB = createMockAgent('agent-b', dirB)
      root.agents.agents.push(agentA, agentB)

      // Emit creation for both agents
      root.emit('agent/created', { agent: agentA })
      root.emit('agent/created', { agent: agentB })

      // Settle MCP process startup
      await new Promise((r) => setTimeout(r, 1500))

      // Verify tool existence per scope
      const toolsA = root.tools.schemas(agentA as any)
      const toolsB = root.tools.schemas(agentB as any)
      assert.equal(toolsA.length, 1)
      assert.equal(toolsB.length, 1)
      assert.equal(toolsA[0].name, 'mcp__codegraph__codegraph_explore')
      assert.equal(toolsB[0].name, 'mcp__codegraph__codegraph_explore')

      // Global scope must see no CodeGraph tools
      assert.equal(root.tools.schemas().length, 0)

      // Execute concurrent explorations
      const [resA, resB] = await Promise.all([
        root.tools.execute({
          name: 'mcp__codegraph__codegraph_explore',
          arguments: { query: 'uniqueSymbolAlpha' },
          agent: agentA,
          signal: new AbortController().signal,
        }),
        root.tools.execute({
          name: 'mcp__codegraph__codegraph_explore',
          arguments: { query: 'uniqueSymbolBeta' },
          agent: agentB,
          signal: new AbortController().signal,
        }),
      ])

      assert.equal(resA.isError, false)
      assert.equal(resB.isError, false)

      const textA = resA.content.map((c: any) => c.text || '').join('\n')
      const textB = resB.content.map((c: any) => c.text || '').join('\n')

      // Assert Agent A finds only Project A symbols
      assert.ok(textA.includes('uniqueSymbolAlpha'), 'Agent A should find uniqueSymbolAlpha')
      assert.ok(!textA.includes('uniqueSymbolBeta'), 'Agent A should NOT see uniqueSymbolBeta from Project B')
      assert.ok(textA.includes('authService.ts'), 'Agent A should reference authService.ts')

      // Assert Agent B finds only Project B symbols
      assert.ok(textB.includes('uniqueSymbolBeta'), 'Agent B should find uniqueSymbolBeta')
      assert.ok(!textB.includes('uniqueSymbolAlpha'), 'Agent B should NOT see uniqueSymbolAlpha from Project A')
      assert.ok(textB.includes('billingService.ts'), 'Agent B should reference billingService.ts')

      // Now dispose Agent A and verify Agent B remains alive and functional
      root.emit('agent/disposed', { agent: agentA })
      await new Promise((r) => setTimeout(r, 200))

      assert.equal(root.tools.schemas(agentA as any).length, 0)
      assert.equal(root.tools.schemas(agentB as any).length, 1)

      // Query Agent B again after Agent A is disposed
      const resB2 = await root.tools.execute({
        name: 'mcp__codegraph__codegraph_explore',
        arguments: { query: 'uniqueSymbolBeta' },
        agent: agentB,
        signal: new AbortController().signal,
      })
      assert.equal(resB2.isError, false)
      const textB2 = resB2.content.map((c: any) => c.text || '').join('\n')
      assert.ok(textB2.includes('uniqueSymbolBeta'))

      // Clean up Agent B and root
      root.emit('agent/disposed', { agent: agentB })
      await new Promise((r) => setTimeout(r, 200))
      await root.fiber.dispose()
    } finally {
      rmSync(dirA, { recursive: true, force: true })
      rmSync(dirB, { recursive: true, force: true })
    }
  })
})
