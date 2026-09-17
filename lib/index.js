import * as McpClient from '@deepseek-ai/dsh-mcp-client';
import { createScope } from '@deepseek-ai/dsh-scope';
import { hasCodeGraphIndex } from './types.js';
export * from './types.js';
/** Plugin name recognized by the Cordis loader. */
export const name = 'dsh-simple-codegraph';
/** Hard service dependencies required before plugin activation. */
export const inject = ['agents', 'tools'];
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
export function apply(ctx, config) {
    const activeSessions = new Map();
    /**
     * Mount an isolated CodeGraph MCP client for one live Agent.
     */
    async function install(agent) {
        if (activeSessions.has(agent)) {
            return;
        }
        const cwd = agent.session?.header?.cwd;
        if (!cwd || typeof cwd !== 'string') {
            // Never silently bind an agent to an arbitrary fallback directory.
            ctx.logger.debug?.('dsh-simple-codegraph: agent "%s" has no usable session cwd; skipping CodeGraph mount', agent.id);
            return;
        }
        // Check for pre-existing global CodeGraph MCP conflict
        const globalTool = ctx.tools.get('mcp__codegraph__codegraph_explore');
        if (globalTool !== undefined) {
            ctx.logger.warn('dsh-simple-codegraph: existing global CodeGraph MCP integration detected (mcp__codegraph__codegraph_explore). ' +
                'Remove the legacy global CodeGraph MCP row from cordis.patch.yml to enable per-Agent project routing.');
            return;
        }
        const scope = createScope(ctx, agent);
        let disposing;
        const dispose = () => (disposing ??= scope.dispose());
        // Tie lifecycle to agent context disposal
        if (agent.ctx?.effect) {
            agent.ctx.effect(() => () => dispose(), 'codegraph.session');
        }
        const ready = (async () => {
            try {
                await scope.ctx.plugin(McpClient, McpClient.Config({
                    transport: 'stdio',
                    serverName: 'codegraph',
                    command: config.command ?? 'codegraph',
                    args: ['serve', '--mcp'],
                    cwd,
                    toolCallTimeoutMs: config.toolCallTimeoutMs ?? 60_000,
                    failOnStartupError: config.failOnStartupError ?? false,
                }));
            }
            catch (error) {
                await dispose();
                activeSessions.delete(agent);
                if (config.failOnStartupError) {
                    throw error;
                }
                ctx.logger.warn(`dsh-simple-codegraph: failed to start CodeGraph MCP for agent "${agent.id}": ${String(error)}`);
                throw error;
            }
        })();
        const handle = { dispose, ready };
        activeSessions.set(agent, handle);
        // Optional microscopic routing hint for indexed repositories
        if (config.routingHint && hasCodeGraphIndex(cwd)) {
            try {
                agent.ctx?.inject?.(['systemPrompt'], (promptScope) => {
                    promptScope.systemPrompt.section({
                        name: 'codegraph:routing',
                        order: 2000,
                        text: () => "For repository discovery, CodeGraph's `codegraph_explore` is exposed in DSH as `mcp__codegraph__codegraph_explore`. " +
                            "Use it before grep/read for indexed source. Treat returned verbatim line-numbered source as already read; " +
                            "do not grep the same symbol or re-read returned files unless CodeGraph marks them stale.",
                    });
                });
            }
            catch (hintErr) {
                ctx.logger.debug?.('dsh-simple-codegraph: systemPrompt injection skipped: %s', hintErr);
            }
        }
    }
    // Ensure prompt assembly on turn 1 / step 1 awaits the MCP connection and carries the schema
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const agent = context.agent;
        if (agent) {
            const session = activeSessions.get(agent);
            if (session?.ready) {
                try {
                    await session.ready;
                }
                catch {
                    // Handled in install()
                }
            }
        }
        const assembled = await next();
        if (agent) {
            const cgSchemas = ctx.tools.schemas(agent).filter((s) => s.name.startsWith('mcp__codegraph__'));
            for (const s of cgSchemas) {
                if (!assembled.tools.some((t) => t.name === s.name)) {
                    assembled.tools.push(s);
                }
            }
        }
        return assembled;
    }, { prepend: true });
    // Handle live agents that already exist when the plugin is mounted
    if (ctx.agents?.list) {
        for (const existingAgent of ctx.agents.list()) {
            void install(existingAgent);
        }
    }
    // Handle newly created agents
    ctx.on('agent/created', ({ agent }) => {
        void install(agent);
    });
    // Handle explicit agent disposal
    ctx.on('agent/disposed', ({ agent }) => {
        const session = activeSessions.get(agent);
        if (session) {
            activeSessions.delete(agent);
            void session.dispose();
        }
    });
    // Ensure all agent MCP processes are terminated when the plugin itself is unloaded or HMR reloaded
    ctx.effect(() => {
        return async () => {
            const sessions = Array.from(activeSessions.values());
            activeSessions.clear();
            await Promise.allSettled(sessions.map((s) => s.dispose()));
        };
    }, 'dsh-simple-codegraph.cleanup');
}
//# sourceMappingURL=index.js.map