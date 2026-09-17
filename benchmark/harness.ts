import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { BenchmarkTask } from './tasks.js'

export interface BenchmarkResult {
  taskId: string
  taskName: string
  category: string
  arm: string
  profile: string
  success: boolean
  correctnessDetails: string
  wallTimeMs: number
  steps: number
  totalToolCalls: number
  codeGraphCalls: number
  grepCalls: number
  readCalls: number
  bashCalls: number
  toolResultChars: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  responsePreview: string
}

function getSessionBaseDir(cwd: string): string {
  const safeName = '--' + cwd.replace(/^\//, '').replace(/\//g, '-') + '--'
  return path.join(os.homedir(), '.dsh', 'sessions', safeName)
}

function getLatestSessionFile(baseDir: string, sinceMs: number): string | null {
  if (!fs.existsSync(baseDir)) return null
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
  let newestFile: string | null = null
  let newestMtime = sinceMs

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('session-')) {
      const zstdPath = path.join(baseDir, entry.name, 'session.v3.jsonl.zstd')
      if (fs.existsSync(zstdPath)) {
        const stat = fs.statSync(zstdPath)
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs
          newestFile = zstdPath
        }
      }
    }
  }
  return newestFile
}

function decompressZstd(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('zstd', ['-dc', filePath])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => (out += d.toString()))
    proc.stderr.on('data', (d) => (err += d.toString()))
    proc.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`zstd exited with ${code}: ${err}`))
    })
  })
}

export async function runBenchmarkTask(
  task: BenchmarkTask,
  arm: string,
  profile: string,
  timeoutMs: number = 180_000,
): Promise<BenchmarkResult> {
  const sessionBase = getSessionBaseDir(task.cwd)
  const startTime = Date.now()

  // Run dsh command: prompt is passed as a positional argument after profile options
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  const child = spawn('dsh', ['--profile', profile, task.prompt], {
    cwd: task.cwd,
    env: {
      ...process.env,
      DSH_PERMISSION_MODE: 'danger-full-access',
    },
  })

  child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk))

  const exitCode = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Benchmark task timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code ?? 0)
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

  const wallTimeMs = Date.now() - startTime
  const stdout = Buffer.concat(stdoutChunks).toString('utf-8')

  // Find telemetry session file
  const sessionFile = getLatestSessionFile(sessionBase, startTime - 5000)

  let steps = 0
  let totalToolCalls = 0
  let codeGraphCalls = 0
  let grepCalls = 0
  let readCalls = 0
  let bashCalls = 0
  let toolResultChars = 0
  let inputTokens = 0
  let outputTokens = 0
  let totalTokens = 0
  let finalResponse = ''

  if (sessionFile) {
    try {
      const decompressed = await decompressZstd(sessionFile)
      const lines = decompressed.trim().split('\n')

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          const type = event.type

          if (type === 'step/start') {
            steps++
          } else if (type === 'tool/call') {
            totalToolCalls++
            const toolName = event.data?.name || ''
            if (toolName.includes('codegraph')) {
              codeGraphCalls++
            } else if (toolName.includes('grep')) {
              grepCalls++
            } else if (toolName.includes('read')) {
              readCalls++
            } else if (toolName.includes('bash') || toolName.includes('execute')) {
              bashCalls++
            }
          } else if (type === 'tool/result') {
            let chars = 0
            const message = event.data?.message
            if (message?.content && Array.isArray(message.content)) {
              for (const c of message.content) {
                if (c.content && Array.isArray(c.content)) {
                  for (const sub of c.content) {
                    if (typeof sub.text === 'string') chars += sub.text.length
                  }
                } else if (typeof c.text === 'string') {
                  chars += c.text.length
                }
              }
            }
            if (chars === 0) {
              const content = event.data?.content || event.data?.result || ''
              chars = typeof content === 'string' ? content.length : JSON.stringify(content).length
            }
            toolResultChars += chars
          } else if (type === 'assistant/message') {
            const usage = event.data?.usage
            if (usage) {
              inputTokens += usage.inputTokens || 0
              outputTokens += usage.outputTokens || 0
              totalTokens += usage.totalTokens || 0
            }
            // Capture assistant text
            const parts = event.data?.content || []
            for (const part of parts) {
              if (part.type === 'text' && part.text) {
                finalResponse = part.text
              }
            }
          }
        } catch {
          // ignore malformed line
        }
      }
    } catch (err) {
      console.warn(`Failed to decompress session telemetry for task ${task.id}:`, err)
    }
  }

  // If finalResponse wasn't found in telemetry, use stdout
  if (!finalResponse) {
    finalResponse = stdout
  }

  // Correctness evaluation
  const lowerResp = finalResponse.toLowerCase()
  const matchedKeywords: string[] = []
  const missingKeywords: string[] = []

  for (const kw of task.expectedKeywords) {
    if (lowerResp.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw)
    } else {
      missingKeywords.push(kw)
    }
  }

  // At least 60% of expected keywords or all if fewer than 3
  const minRequired = task.expectedKeywords.length <= 2 ? task.expectedKeywords.length : Math.ceil(task.expectedKeywords.length * 0.6)
  const isCorrect = matchedKeywords.length >= minRequired

  const correctnessDetails = isCorrect
    ? `Passed (${matchedKeywords.length}/${task.expectedKeywords.length} keys: ${matchedKeywords.join(', ')})`
    : `Failed (missing: ${missingKeywords.join(', ')})`

  return {
    taskId: task.id,
    taskName: task.name,
    category: task.category,
    arm,
    profile,
    success: isCorrect && exitCode === 0,
    correctnessDetails,
    wallTimeMs,
    steps,
    totalToolCalls,
    codeGraphCalls,
    grepCalls,
    readCalls,
    bashCalls,
    toolResultChars,
    inputTokens,
    outputTokens,
    totalTokens,
    responsePreview: finalResponse.slice(0, 200).replace(/\n/g, ' '),
  }
}
