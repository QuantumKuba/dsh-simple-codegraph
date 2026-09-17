import * as fs from 'node:fs'
import * as path from 'node:path'
import { BENCHMARK_TASKS, type BenchmarkTask } from './tasks.js'
import { runBenchmarkTask, type BenchmarkResult } from './harness.js'

interface ArmConfig {
  label: string
  profile: string
}

const DEFAULT_ARMS: ArmConfig[] = [
  { label: 'Arm A: Plain DSH (Baseline)', profile: 'benchmark-baseline' },
  { label: 'Arm B: DSH + CodeGraph (Pure Upstream)', profile: 'benchmark-codegraph-nohint' },
  { label: 'Arm C: DSH + CodeGraph (Micro Hint)', profile: 'benchmark-codegraph' },
]

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const half = Math.floor(sorted.length / 2)
  if (sorted.length % 2 !== 0) return sorted[half]
  return (sorted[half - 1] + sorted[half]) / 2
}

async function main() {
  console.log('='.repeat(80))
  console.log('DeepSeek Harness + CodeGraph Benchmark Suite')
  console.log('='.repeat(80))

  const taskFilter = process.env.DSH_CODEGRAPH_BENCH_TASKS
  const selectedTasks = taskFilter && taskFilter !== 'all'
    ? BENCHMARK_TASKS.filter(t => taskFilter.split(',').map(s => s.trim()).includes(t.id))
    : BENCHMARK_TASKS

  const profileEnv = process.env.DSH_CODEGRAPH_BENCH_PROFILE
  const selectedArms = profileEnv
    ? profileEnv.split(',').map(p => {
        const trimmed = p.trim()
        const existing = DEFAULT_ARMS.find(a => a.profile === trimmed)
        return existing || { label: trimmed, profile: trimmed }
      })
    : DEFAULT_ARMS

  const repeats = parseInt(process.env.DSH_CODEGRAPH_BENCH_REPEATS || '1', 10)

  console.log(`Tasks to evaluate: ${selectedTasks.length}`)
  for (const t of selectedTasks) {
    console.log(`  - [${t.category}] ${t.id}: ${t.name}`)
  }
  console.log(`Arms to evaluate: ${selectedArms.length}`)
  for (const a of selectedArms) {
    console.log(`  - ${a.label} (${a.profile})`)
  }
  console.log(`Repeats per condition: ${repeats}`)
  console.log('='.repeat(80))

  const allResults: BenchmarkResult[] = []

  for (const task of selectedTasks) {
    console.log(`\n>>> TASK: ${task.name} (${task.id})`)
    console.log(`    Prompt: "${task.prompt}"`)
    console.log(`    Cwd: ${task.cwd}`)

    for (const arm of selectedArms) {
      for (let r = 1; r <= repeats; r++) {
        console.log(`\n  Running [${arm.label}] (Run ${r}/${repeats})...`)
        try {
          const res = await runBenchmarkTask(task, arm.label, arm.profile)
          allResults.push(res)

          console.log(`    Success: ${res.success ? '✓ PASS' : '✗ FAIL'} | ${res.correctnessDetails}`)
          console.log(`    Wall Time: ${(res.wallTimeMs / 1000).toFixed(1)}s | Steps: ${res.steps}`)
          console.log(`    Tool Calls: Total=${res.totalToolCalls} (CodeGraph=${res.codeGraphCalls}, Grep=${res.grepCalls}, Read=${res.readCalls}, Bash=${res.bashCalls})`)
          console.log(`    Tokens: In=${res.inputTokens}, Out=${res.outputTokens}, Total=${res.totalTokens}`)
          console.log(`    Result Chars: ${res.toolResultChars}`)
        } catch (err: any) {
          console.error(`    Error executing task: ${err.message}`)
          allResults.push({
            taskId: task.id,
            taskName: task.name,
            category: task.category,
            arm: arm.label,
            profile: arm.profile,
            success: false,
            correctnessDetails: `Execution error: ${err.message}`,
            wallTimeMs: 0,
            steps: 0,
            totalToolCalls: 0,
            codeGraphCalls: 0,
            grepCalls: 0,
            readCalls: 0,
            bashCalls: 0,
            toolResultChars: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            responsePreview: '',
          })
        }
      }
    }
  }

  // Save raw results
  const outPath = path.join(process.cwd(), 'benchmark', 'benchmark-results.json')
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf-8')
  console.log(`\nSaved raw benchmark results to: ${outPath}`)

  // Generate Summary Report
  generateReport(allResults, selectedArms, selectedTasks)
}

function generateReport(results: BenchmarkResult[], arms: ArmConfig[], tasks: BenchmarkTask[]) {
  const reportLines: string[] = []
  reportLines.push('# DeepSeek Harness + CodeGraph Integration Benchmark Report\n')
  reportLines.push(`**Date**: ${new Date().toISOString()}`)
  reportLines.push(`**Environment**: macOS Apple Silicon, Node ${process.version}, DSH v0.1.5-rc.1, CodeGraph v1.6.0`)
  reportLines.push(`**Model**: Qwen3.8-27B-MLX-8bit (local inference via OMLX)\n`)

  reportLines.push('## Executive Summary\n')
  reportLines.push('This benchmark evaluates the performance of `dsh-simple-codegraph` across representative codebase discovery, flow tracing, refactor impact, and negative control tasks compared to baseline DeepSeek Harness.\n')

  // Table by Arm Summary
  reportLines.push('### Aggregate Comparison Across All Discovery Tasks\n')
  reportLines.push('| Metric | ' + arms.map(a => a.label).join(' | ') + ' |')
  reportLines.push('| :--- | ' + arms.map(() => ':---:').join(' | ') + ' |')

  const discoveryTasks = tasks.filter(t => t.category !== 'negative' && t.category !== 'config')

  const getArmStats = (armLabel: string) => {
    const armResults = results.filter(r => r.arm === armLabel && discoveryTasks.some(dt => dt.id === r.taskId))
    const successes = armResults.filter(r => r.success).length
    const totalRuns = armResults.length
    const passRate = totalRuns > 0 ? ((successes / totalRuns) * 100).toFixed(0) + '%' : 'N/A'
    const medTime = (median(armResults.map(r => r.wallTimeMs)) / 1000).toFixed(1) + 's'
    const medTools = median(armResults.map(r => r.totalToolCalls)).toFixed(1)
    const medCG = median(armResults.map(r => r.codeGraphCalls)).toFixed(1)
    const medGrep = median(armResults.map(r => r.grepCalls)).toFixed(1)
    const medRead = median(armResults.map(r => r.readCalls)).toFixed(1)
    const medChars = median(armResults.map(r => r.toolResultChars)).toLocaleString()
    const medTokens = median(armResults.map(r => r.totalTokens)).toLocaleString()

    return { passRate, medTime, medTools, medCG, medGrep, medRead, medChars, medTokens }
  }

  const armStatsMap = new Map(arms.map(a => [a.label, getArmStats(a.label)]))

  reportLines.push('| **Success Rate** | ' + arms.map(a => armStatsMap.get(a.label)!.passRate).join(' | ') + ' |')
  reportLines.push('| **Median Wall Time** | ' + arms.map(a => armStatsMap.get(a.label)!.medTime).join(' | ') + ' |')
  reportLines.push('| **Median Total Tool Calls** | ' + arms.map(a => armStatsMap.get(a.label)!.medTools).join(' | ') + ' |')
  reportLines.push('| **Median CodeGraph Calls** | ' + arms.map(a => armStatsMap.get(a.label)!.medCG).join(' | ') + ' |')
  reportLines.push('| **Median Grep Calls** | ' + arms.map(a => armStatsMap.get(a.label)!.medGrep).join(' | ') + ' |')
  reportLines.push('| **Median Read Calls** | ' + arms.map(a => armStatsMap.get(a.label)!.medRead).join(' | ') + ' |')
  reportLines.push('| **Median Tool Result Chars** | ' + arms.map(a => armStatsMap.get(a.label)!.medChars).join(' | ') + ' |')
  reportLines.push('| **Median Total Tokens** | ' + arms.map(a => armStatsMap.get(a.label)!.medTokens).join(' | ') + ' |')

  // Per-Task Breakdown Table
  reportLines.push('\n## Detailed Per-Task Results\n')
  reportLines.push('| Task ID | Category | Arm | Status | Time | Steps | Total Tools | CG | Grep | Read | Tokens |')
  reportLines.push('| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |')

  for (const r of results) {
    reportLines.push(
      `| \`${r.taskId}\` | ${r.category} | ${r.arm} | ${r.success ? 'PASS' : 'FAIL'} | ${(r.wallTimeMs / 1000).toFixed(1)}s | ${r.steps} | ${r.totalToolCalls} | ${r.codeGraphCalls} | ${r.grepCalls} | ${r.readCalls} | ${r.totalTokens} |`
    )
  }

  const reportContent = reportLines.join('\n')
  const reportPath = path.join(process.cwd(), 'benchmark', 'BENCHMARK_REPORT.md')
  fs.writeFileSync(reportPath, reportContent, 'utf-8')
  console.log(`\nGenerated Markdown Report: ${reportPath}\n`)
  console.log(reportContent)
}

main().catch(err => {
  console.error('Fatal benchmark runner error:', err)
  process.exit(1)
})
