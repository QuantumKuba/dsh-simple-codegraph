# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-17

### Added
- **True Per-Agent CodeGraph Isolation**: Native Agent-scoped Cordis child scope (`createScope(ctx, agent)`) mounting an isolated `@deepseek-ai/dsh-mcp-client` stdio process pinned to `agent.session.header.cwd`.
- **Simultaneous Multi-Project Support**: Multiple DSH agents working in separate repositories simultaneously without cross-project state pollution or runtime config mutation.
- **Turn-1 Tool Handshake Guarantee**: Early-stage waterfall listener on `system-prompt/assemble` ensuring the ~300ms MCP stdio handshake completes before Turn 1 prompt assembly.
- **Single-Tool Philosophy for Small Models**: Preserved CodeGraph's single exploration tool (`codegraph_explore` / `mcp__codegraph__codegraph_explore`) by default to minimize tool schema token consumption and eliminate tool selection ambiguity for local ~20B–30B models.
- **Microscopic Routing Hint**: Non-invasive 1-sentence prompt hint steering local models to CodeGraph exploration before raw filesystem tools on indexed repositories.
- **Legacy Global MCP Conflict Detection**: Automatic detection of pre-existing global CodeGraph MCP definitions with clear user warning and graceful non-conflicting fallback.
- **Compaction-Safe Execution**: Explicitly left `CODEGRAPH_EXPLORE_DEDUP` off to prevent stale reference errors when DSH compacts earlier tool results out of context.
- **Native DSH Bundle Packaging**: Full support for zero-config installation via `dsh plugin --profile <name> add dsh-simple-codegraph`.
- **Comprehensive Benchmark & Testing Suite**: Automated test suite covering configuration, lifecycle, legacy conflict detection, single-tool surface contracts, and multi-agent isolation; reproducible benchmark comparing Baseline vs Pure Upstream vs Hinted MCP on local Qwen 27B.
