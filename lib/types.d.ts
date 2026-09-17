import Schema from '@deepseek-ai/schemastery';
/**
 * Public configuration interface for dsh-simple-codegraph.
 */
export interface Config {
    /**
     * Executable name or absolute path for the CodeGraph CLI.
     * Defaults to 'codegraph'.
     */
    command?: string;
    /**
     * Per-tool-call timeout in milliseconds.
     * Defaults to 60,000 (60 seconds).
     */
    toolCallTimeoutMs?: number;
    /**
     * Fail plugin activation if initial server startup fails.
     * Defaults to false so DSH remains completely usable if codegraph is missing.
     */
    failOnStartupError?: boolean;
    /**
     * Whether to provide a microscopic routing hint in system prompt when an indexed
     * repository (.codegraph directory) is detected in the session cwd.
     * Defaults to true.
     */
    routingHint?: boolean;
}
/**
 * Schemastery schema for runtime configuration validation and defaults.
 */
export declare const Config: Schema<Config>;
/**
 * Locate the nearest directory containing a `.codegraph` index at or above `startPath`.
 *
 * @param startPath - Path to start scanning from (typically session cwd).
 * @returns The directory path containing `.codegraph`, or null if not found.
 */
export declare function findCodeGraphRoot(startPath: string): string | null;
/**
 * Check whether a `.codegraph` index exists at or above `startPath`.
 */
export declare function hasCodeGraphIndex(startPath: string): boolean;
//# sourceMappingURL=types.d.ts.map