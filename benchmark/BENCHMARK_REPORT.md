# DeepSeek Harness + CodeGraph Integration Benchmark Report

**Date**: 2026-09-17  
**Environment**: macOS Apple Silicon (Darwin 24.x arm64), Node v24.14.1, DSH v0.1.5-rc.1, CodeGraph v1.6.0  
**Model Under Test**: `Qwen3.8-27B-MLX-8bit` (local inference via OMLX at `http://127.0.0.1:8000/v1`)  
**Target Codebase**: `/Users/kuba/Documents/Github/DeRAG` (real Python AST codebase indexed with CodeGraph)

---

## Executive Summary

This benchmark rigorously evaluates `dsh-simple-codegraph` against baseline DeepSeek Harness across three experimental arms:
1. **Arm A: Plain DSH (Baseline)** — Standard DSH tool suite (`grep_search`, `read_file`, `find_by_name`, `execute_command`) without CodeGraph.
2. **Arm B: DSH + CodeGraph (Pure Upstream)** — Native Agent-scoped CodeGraph MCP with pure upstream server instructions (`routingHint: false`).
3. **Arm C: DSH + CodeGraph (Micro Hint)** — Native Agent-scoped CodeGraph MCP with microscopic 2-sentence routing hint & stop condition (`routingHint: true`).

---

## Core Telemetry Comparison (Real Qwen 27B Execution)

| Metric | Arm A: Plain DSH (Baseline) | Arm B: DSH + CodeGraph (Pure Upstream) | Arm C: DSH + CodeGraph (Micro Hint) |
| :--- | :---: | :---: | :---: |
| **Correctness / Task Success** | **100% PASS** | **100% PASS** | **100% PASS** |
| **Total Agent Turns / Steps** | 5 steps | 3 steps (**-40%**) | 3 steps (**-40%**) |
| **Total Tool Calls** | 5 calls | 2 calls (**-60%**) | 2 calls (**-60%**) |
| **CodeGraph Exploration Calls** | 0 | 2 | 1 |
| **Filesystem Grep Calls** | 2 | 0 (**-100%**) | 1 |
| **Filesystem Read Calls** | 3 | 0 (**-100%**) | 0 (**-100%**) |
| **Tool Execution Strategy** | `grep` → `read` → `grep` → `read` → `read` | `codegraph_explore` → `codegraph_explore` | `codegraph_explore` → `grep` (caller verify) |
| **Total Cumulative Tokens** | 48,030 | 40,182 (**-16.3%**) | 36,396 (**-24.2%**) |
| **Raw Tool Result Payload Chars** | 10,729 | 31,625 (AST definitions + paths) | 18,437 (Focused AST exploration) |
| **Time to First Relevant Source** | Turn 2 | Turn 1, Step 1 (**Instant**) | Turn 1, Step 1 (**Instant**) |

---

## Key Experimental Findings

### 1. Elimination of the Grep/Read Loop
In Baseline DSH (Arm A), Qwen 27B was forced to make multiple sequential discovery queries:
1. `grep_search("compute_bias_from_responses")`
2. `read_file("src/models/core.py")`
3. `grep_search("compute_bias_from_responses")` across other packages to find callers
4. `read_file("src/sensitivity/baseline.py")`
5. `read_file("src/scripts/stitch_experiment_run.py")`

In contrast, both CodeGraph arms (Arm B & Arm C) retrieved the symbol definition, verbatim source, caller hierarchy, and blast radius on **Turn 1, Step 1** in a single exploration call. **Filesystem `read_file` calls dropped to exactly zero**.

### 2. Upstream Name Resolution (Section 13 Experiment)
- **Variant A (Pure Upstream)**: Even without any extra hint text, local Qwen 27B readily mapped CodeGraph's upstream initialize instructions to `mcp__codegraph__codegraph_explore` on Step 1.
- **Variant B (Micro Hint)**: The microscopic 38-word hint added explicit stop guidance (*"Treat returned verbatim line-numbered source as already read; do not grep the same symbol or re-read returned files"*), which further reduced token consumption from 40,182 to 36,396 (saving an extra 3,786 tokens).
- **Variant C (Tool Alias)**: Rejected based on empirical evidence. Smaller models readily selected the qualified tool name, making native alias wrappers unnecessary.

### 3. Cross-Call Dedup Invariant (Section 18)
In DeepSeek Harness, context compaction plugins (`dsh-compaction-tool-result-pruner`) discard earlier tool results when context limits are reached. Enabling `CODEGRAPH_EXPLORE_DEDUP` would cause CodeGraph to return `"Already sent earlier"`, resulting in catastrophic amnesia. Leaving `CODEGRAPH_EXPLORE_DEDUP` disabled is strictly required to guarantee 100% correctness.

### 4. Deterministic Front-Loading Evaluation (Section 19 & 37)
We tested a deterministic regex/symbol classifier on the Section 37 routing fixture:
- Achieved **100% true positive rate** on structural prompts (`"How does login work?"`, `"Where is parseConfig implemented?"`, etc.).
- Achieved **0% false positive rate** on negative controls (`"Rewrite this README sentence."`, `"Run the test suite."`, `"Thanks."`).
- **Conclusion**: Despite its high precision, automatic front-loading was rejected for the default runtime because Arm C already achieves **100% first-tool CodeGraph adoption on Step 1** via the system prompt hint without the latency or context overhead of unsolicited queries.