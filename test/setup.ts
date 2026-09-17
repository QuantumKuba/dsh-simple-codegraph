import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { join, delimiter } from 'node:path'
import { tmpdir } from 'node:os'

export function ensureCodeGraphCLI() {
  try {
    execSync(process.platform === 'win32' ? 'where codegraph' : 'which codegraph', { stdio: 'ignore' })
    return
  } catch {
    // codegraph not installed on system, provision test mock
  }

  const mockDir = join(tmpdir(), 'mock-cg-bin')
  mkdirSync(mockDir, { recursive: true })

  const mockJs = join(mockDir, 'codegraph-mock.mjs')
  writeFileSync(mockJs, `import readline from 'node:readline'
import { mkdirSync, readdirSync } from 'node:fs'

const args = process.argv.slice(2)
if (args[0] === 'init') {
  mkdirSync('.codegraph', { recursive: true })
  process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  if (!line.trim()) return
  try {
    const req = JSON.parse(line)
    if (req.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'codegraph', version: '1.6.0' }
        }
      }) + '\\n')
    } else if (req.method === 'tools/list') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          tools: [
            {
              name: 'codegraph_explore',
              description: 'Explore codebase',
              inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query']
              }
            }
          ]
        }
      }) + '\\n')
    } else if (req.method === 'tools/call') {
      const q = req.params?.arguments?.query || ''
      let text = 'Exploration results for ' + q
      try {
        const files = readdirSync(process.cwd()).filter(f => f.endsWith('.ts'))
        if (files.length > 0) {
          text += ' in files: ' + files.join(', ') + ' symbol: ' + q
        }
      } catch {}
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{ type: 'text', text }]
        }
      }) + '\\n')
    } else if (req.id !== undefined) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\\n')
    }
  } catch {}
})
`)

  if (process.platform === 'win32') {
    const bat = join(mockDir, 'codegraph.cmd')
    writeFileSync(bat, `@echo off\r\nnode "${mockJs}" %*\r\n`)
  } else {
    const sh = join(mockDir, 'codegraph')
    writeFileSync(sh, `#!/bin/sh\nexec node "${mockJs}" "$@"\n`)
    chmodSync(sh, 0o755)
  }

  process.env.PATH = `${mockDir}${delimiter}${process.env.PATH}`
}

ensureCodeGraphCLI()
