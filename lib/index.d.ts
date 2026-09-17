import type { Context } from '@deepseek-ai/cordis';
import { Config } from './types.js';
export * from './types.js';
/** Plugin name recognized by the Cordis loader. */
export declare const name = "dsh-simple-codegraph";
/** Hard service dependencies required before plugin activation. */
export declare const inject: string[];
/**
 * Apply the dsh-simple-codegraph plugin to the Cordis context.
 *
 * Implements per-Agent CodeGraph MCP stdio connection lifecycle:
 * - Each live Agent receives an isolated CodeGraph MCP process.
 * - The process uses the Agent's session cwd as its working directory.
 * - Multi-project concurrency is supported without global cwd mutation.
 * - Agent disposal cleanly closes its MCP process.
 * - Plugin unload / HMR cleanly closes all active MCP processes.
 *
 * @param ctx - Host Cordis context carrying `agents` and `tools` services.
 * @param config - Resolved configuration options.
 */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map