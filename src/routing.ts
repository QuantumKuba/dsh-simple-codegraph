/**
 * Deterministic intent classifier for structural repository exploration.
 * Used for evaluating the front-loading experiment and validating routing precision.
 */

// Positive patterns indicating architectural or structural code discovery
const STRUCTURAL_INTENT_PATTERNS = [
  /\bhow does \w+/i,
  /\bwhere is \w+/i,
  /\bwhere are \w+/i,
  /\btrace \w+ to \w+/i,
  /\btrace (?:the )?call flow\b/i,
  /\barchitecture of \w+/i,
  /\bwho calls \w+/i,
  /\bwhat calls \w+/i,
  /\bwhat would changing \w+ affect\b/i,
  /\b(?:dependencies|dependents|blast radius) of \w+/i,
  /\bfix (?:the )?bug in \w+/i,
  /\bimplementation of \w+/i,
  /\bflow from \w+ to \w+/i,
]

// Negative patterns indicating non-code, administrative, testing, or formatting tasks
const NON_STRUCTURAL_EXCLUSIONS = [
  /\brewrite (?:this|the)?\b/i,
  /\bedit (?:the )?readme\b/i,
  /\bwording\b/i,
  /\brun (?:the )?tests?\b/i,
  /\bchange (?:the )?version number\b/i,
  /\bwhat (?:is|does) git \w+/i,
  /\bformat (?:this|the) (?:json|file|code)\b/i,
  /^(?:thanks|thank you|hi|hello|hey)[.!]?$/i,
]

// Symbol shape detection: camelCase, snake_case, PascalCase with internal capitalization, or identifier after structural keywords
const CAMEL_CASE = /\b[a-z]+[A-Z0-9][a-zA-Z0-9]*\b/
const SNAKE_CASE = /\b[a-z0-9]+_[a-z0-9_]+\b/
const PASCAL_CASE = /\b[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*\b/
const KEYWORD_TARGET = /\b(?:in|changing|calls|from|to|of|about)\s+([a-zA-Z0-9_]+)\b/i

export interface RoutingDecision {
  shouldRouteToCodeGraph: boolean
  matchedPattern?: string
  extractedSymbol?: string
}

function extractSymbol(prompt: string): string | undefined {
  // First look for explicit camelCase, snake_case, or multi-capital PascalCase (e.g. CacheStore, parseConfig, normalizeQuery)
  const camel = prompt.match(CAMEL_CASE)
  if (camel) return camel[0]

  const snake = prompt.match(SNAKE_CASE)
  if (snake) return snake[0]

  const pascal = prompt.match(PASCAL_CASE)
  if (pascal) return pascal[0]

  const kw = prompt.match(KEYWORD_TARGET)
  if (kw && kw[1] && !/^(?:the|this|that|a|an)$/i.test(kw[1])) {
    return kw[1]
  }

  return undefined
}

/**
 * Deterministically evaluates whether a user prompt represents high-confidence
 * structural code discovery intent without using an LLM classifier.
 */
export function classifyStructuralIntent(prompt: string): RoutingDecision {
  const trimmed = prompt.trim()
  if (!trimmed) {
    return { shouldRouteToCodeGraph: false }
  }

  // Check negative exclusions first
  for (const exclusion of NON_STRUCTURAL_EXCLUSIONS) {
    if (exclusion.test(trimmed)) {
      return { shouldRouteToCodeGraph: false }
    }
  }

  // Check positive structural patterns
  for (const pattern of STRUCTURAL_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        shouldRouteToCodeGraph: true,
        matchedPattern: pattern.source,
        extractedSymbol: extractSymbol(trimmed),
      }
    }
  }

  return { shouldRouteToCodeGraph: false }
}

