import Schema from '@deepseek-ai/schemastery';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
/**
 * Schemastery schema for runtime configuration validation and defaults.
 */
export const Config = Schema.object({
    command: Schema.string().default('codegraph').description('CodeGraph CLI command name or absolute path'),
    toolCallTimeoutMs: Schema.number().min(1).default(60_000).description('Timeout in milliseconds for tool calls'),
    failOnStartupError: Schema.boolean().default(false).description('Whether to fail on startup connection errors'),
    routingHint: Schema.boolean().default(true).description('Inject microscopic routing hint into system prompt when index is present'),
});
/**
 * Locate the nearest directory containing a `.codegraph` index at or above `startPath`.
 *
 * @param startPath - Path to start scanning from (typically session cwd).
 * @returns The directory path containing `.codegraph`, or null if not found.
 */
export function findCodeGraphRoot(startPath) {
    try {
        let current = resolve(startPath);
        while (true) {
            const candidate = join(current, '.codegraph');
            if (existsSync(candidate)) {
                try {
                    if (statSync(candidate).isDirectory()) {
                        return current;
                    }
                }
                catch {
                    // ignore permission errors on traversal
                }
            }
            const parent = dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
    }
    catch {
        // ignore resolution failures
    }
    return null;
}
/**
 * Check whether a `.codegraph` index exists at or above `startPath`.
 */
export function hasCodeGraphIndex(startPath) {
    return findCodeGraphRoot(startPath) !== null;
}
//# sourceMappingURL=types.js.map