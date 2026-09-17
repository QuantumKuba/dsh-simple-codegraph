export interface BenchmarkTask {
  id: string
  name: string
  category: 'architecture' | 'symbol' | 'flow' | 'multi-file' | 'impact' | 'negative' | 'config'
  prompt: string
  cwd: string
  expectedKeywords: string[]
  shouldUseCodeGraph: boolean
}

export const BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: 'arch_discovery',
    name: 'Architecture Discovery',
    category: 'architecture',
    prompt: 'Explain the architecture of how questionnaire responses are processed into bias vectors and how baseline probing uses them. Which functions and files are involved in the pipeline?',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['compute_bias_from_responses', 'core.py', 'baseline.py', 'BiasVector'],
    shouldUseCodeGraph: true,
  },
  {
    id: 'symbol_location',
    name: 'Symbol Location',
    category: 'symbol',
    prompt: 'Where is compute_bias_from_responses implemented and what does it do?',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['compute_bias_from_responses', 'core.py', 'BiasVector'],
    shouldUseCodeGraph: true,
  },
  {
    id: 'flow_tracing',
    name: 'Flow Tracing',
    category: 'flow',
    prompt: 'Trace the flow from EightValuesQuestion to compute_contribution to compute_bias_from_responses. How do stance multipliers affect the resulting bias vector?',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['compute_contribution', 'to_multiplier', 'effect', 'BiasVector'],
    shouldUseCodeGraph: true,
  },
  {
    id: 'multifile_understanding',
    name: 'Multi-file Understanding',
    category: 'multi-file',
    prompt: 'In src/models/core.py and src/sensitivity/baseline.py, what model class represents the output bias vector and what axes does it contain?',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['BiasVector', 'econ', 'dipl', 'govt', 'scty'],
    shouldUseCodeGraph: true,
  },
  {
    id: 'refactor_impact',
    name: 'Refactor / Blast Radius Impact',
    category: 'impact',
    prompt: 'What would changing the axes or fields in BiasVector affect across the codebase? Name the callers and dependent modules.',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['core.py', 'baseline.py', 'bias_analysis.py', 'stitch_experiment_run.py'],
    shouldUseCodeGraph: true,
  },
  {
    id: 'negative_arithmetic',
    name: 'Negative Control (Non-Code)',
    category: 'negative',
    prompt: 'What is 2 + 2? Please answer in one word.',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['4', 'four'],
    shouldUseCodeGraph: false,
  },
  {
    id: 'config_pyproject',
    name: 'Config / Non-indexed File',
    category: 'config',
    prompt: 'What is the project name and required Python version in pyproject.toml?',
    cwd: '/Users/kuba/Documents/Github/DeRAG',
    expectedKeywords: ['derag', '3.13'],
    shouldUseCodeGraph: false,
  },
]
