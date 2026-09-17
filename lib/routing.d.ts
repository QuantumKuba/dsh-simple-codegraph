/**
 * Deterministic intent classifier for structural repository exploration.
 * Used for evaluating the front-loading experiment and validating routing precision.
 */
export interface RoutingDecision {
    shouldRouteToCodeGraph: boolean;
    matchedPattern?: string;
    extractedSymbol?: string;
}
/**
 * Deterministically evaluates whether a user prompt represents high-confidence
 * structural code discovery intent without using an LLM classifier.
 */
export declare function classifyStructuralIntent(prompt: string): RoutingDecision;
//# sourceMappingURL=routing.d.ts.map