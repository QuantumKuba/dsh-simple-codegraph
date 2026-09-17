import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Config, findCodeGraphRoot, hasCodeGraphIndex } from '../src/types.js'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('Config and Helpers', () => {
  it('should provide expected default configuration values', () => {
    const parsed = Config({})
    assert.equal(parsed.command, 'codegraph')
    assert.equal(parsed.toolCallTimeoutMs, 60_000)
    assert.equal(parsed.failOnStartupError, false)
    assert.equal(parsed.routingHint, true)
  })

  it('should accept custom valid configuration values', () => {
    const parsed = Config({
      command: '/custom/bin/codegraph',
      toolCallTimeoutMs: 120_000,
      failOnStartupError: true,
      routingHint: false,
    })
    assert.equal(parsed.command, '/custom/bin/codegraph')
    assert.equal(parsed.toolCallTimeoutMs, 120_000)
    assert.equal(parsed.failOnStartupError, true)
    assert.equal(parsed.routingHint, false)
  })

  it('should detect .codegraph index at or above path', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'cg-test-'))
    try {
      const subDir = join(tempDir, 'nested', 'deep')
      mkdirSync(subDir, { recursive: true })

      // Initially no index
      assert.equal(hasCodeGraphIndex(subDir), false)
      assert.equal(findCodeGraphRoot(subDir), null)

      // Create .codegraph at root
      const cgDir = join(tempDir, '.codegraph')
      mkdirSync(cgDir)

      assert.equal(hasCodeGraphIndex(subDir), true)
      assert.equal(findCodeGraphRoot(subDir), tempDir)
      assert.equal(hasCodeGraphIndex(tempDir), true)
      assert.equal(findCodeGraphRoot(tempDir), tempDir)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
