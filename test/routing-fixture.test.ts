import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyStructuralIntent } from '../src/routing.js'

describe('False-Positive Routing and Adoption Fixture (Section 37)', () => {
  const SHOULD_USE_CODEGRAPH = [
    'How does login work?',
    'Where is parseConfig implemented?',
    'Trace requestHandler to saveRecord.',
    'What calls buildIndex?',
    'What would changing CacheStore affect?',
    'Fix the bug in normalizeQuery.',
  ]

  const SHOULD_NOT_USE_CODEGRAPH = [
    'Rewrite this README sentence.',
    'Run the test suite.',
    'Change the version number.',
    'What does git rebase do?',
    'Format this JSON file.',
    'Thanks.',
  ]

  it('should correctly classify all positive structural discovery prompts', () => {
    for (const prompt of SHOULD_USE_CODEGRAPH) {
      const result = classifyStructuralIntent(prompt)
      assert.equal(
        result.shouldRouteToCodeGraph,
        true,
        `Expected "${prompt}" to be classified as structural discovery`,
      )
    }
  })

  it('should reject all non-structural / negative control prompts with 0% false positives', () => {
    for (const prompt of SHOULD_NOT_USE_CODEGRAPH) {
      const result = classifyStructuralIntent(prompt)
      assert.equal(
        result.shouldRouteToCodeGraph,
        false,
        `Expected "${prompt}" to NOT be routed to CodeGraph`,
      )
    }
  })

  it('should extract relevant symbols when present', () => {
    const r1 = classifyStructuralIntent('Where is parseConfig implemented?')
    assert.equal(r1.extractedSymbol, 'parseConfig')

    const r2 = classifyStructuralIntent('What would changing CacheStore affect?')
    assert.equal(r2.extractedSymbol, 'CacheStore')

    const r3 = classifyStructuralIntent('Fix the bug in normalizeQuery.')
    assert.equal(r3.extractedSymbol, 'normalizeQuery')
  })
})
