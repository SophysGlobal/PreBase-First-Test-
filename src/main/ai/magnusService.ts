import { getGeminiApiKey } from './apiKeyLoader'
import { generateContent, generateContentGrounded, type GeminiContent } from './geminiClient'

const DEFAULT_MODEL = 'gemini-2.5-flash'
const STRONG_MODEL = 'gemini-2.5-pro'

/**
 * Resolve the "auto" pseudo-model to a concrete Gemini model. Simple heuristic for now:
 * longer/complex-looking queries route to the stronger model, everything else uses the
 * fast default. Structured this way so smarter routing can be added later.
 */
function resolveAutoModel(query: string): string {
  const q = query.toLowerCase()
  const complexSignals = [
    'architecture', 'debug', 'refactor', 'design', 'why does', 'explain in depth',
    'trade-off', 'tradeoff', 'performance', 'security', 'compare'
  ]
  const looksComplex = q.length > 400 || complexSignals.some((s) => q.includes(s))
  return looksComplex ? STRONG_MODEL : DEFAULT_MODEL
}

/**
 * Whether a query looks code/project-relevant enough to justify a live web search
 * (current library docs, framework APIs, dependency behavior, error messages).
 * General-knowledge or conversational queries never trigger web search.
 */
function isCodeOrProjectQuery(query: string): boolean {
  const q = query.toLowerCase()
  const signals = [
    'docs', 'documentation', 'api', 'library', 'package', 'framework', 'error', 'exception',
    'bug', 'stack trace', 'dependency', 'version', 'deprecated', 'how do i', 'how to',
    'best practice', 'vite', 'react', 'electron', 'typescript', 'node', 'npm', 'gemini'
  ]
  return signals.some((s) => q.includes(s))
}

export interface MagnusMessage {
  role: 'user' | 'model'
  content: string
}

export interface MagnusChatResult {
  text: string
  /** True only when Gemini actually issued a live web search for this reply. */
  usedWebSearch: boolean
  /** Source titles/domains Gemini actually consulted, if any. */
  sources: string[]
}

export interface MagnusChatParams {
  query: string
  projectRoot: string
  projectName: string
  selectedFilePath?: string
  fileCount?: number
  entryFile?: string
  topFiles?: string[]
  languageSummary?: string
  conversationHistory?: MagnusMessage[]
  /** Gemini model ID to use, e.g. "gemini-2.5-flash". Defaults to gemini-2.5-flash. */
  model?: string
}

/** Parse a Gemini API error object into a user-facing message. */
function classifyGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  // Try to parse structured error from our geminiClient
  let code = 0
  let status = ''
  let apiMessage = ''
  try {
    const parsed = JSON.parse(raw)
    code = parsed.code ?? 0
    status = (parsed.status ?? '').toLowerCase()
    apiMessage = (parsed.message ?? '').toLowerCase()
  } catch {
    // Not a JSON error — use raw string matching
    apiMessage = raw.toLowerCase()
  }

  const msg = apiMessage || raw.toLowerCase()

  // In dev mode always append full raw error for diagnosis
  const rawSuffix =
    process.env['NODE_ENV'] !== 'production' ? `\n\n[Dev raw error: ${raw.slice(0, 500)}]` : ''

  if (
    status === 'invalid_argument' ||
    code === 400 ||
    msg.includes('api key not valid') ||
    msg.includes('api_key_invalid') ||
    msg.includes('please pass a valid api key')
  ) {
    return (
      'Gemini rejected the API key. ' +
      'Make sure the key in your .env file is the exact key shown at aistudio.google.com/apikey ' +
      'and that you copied it with "Copy key", not "Copy cURL quickstart".' +
      rawSuffix
    )
  }

  if (status === 'permission_denied' || code === 403) {
    return (
      'Gemini permission denied. ' +
      'Enable the "Generative Language API" at console.cloud.google.com/apis.' +
      rawSuffix
    )
  }

  if (status === 'resource_exhausted' || code === 429 || msg.includes('quota')) {
    return 'Gemini quota or rate limit reached. Check your quota at aistudio.google.com.' + rawSuffix
  }

  if (code === 404 || msg.includes('model not found') || msg.includes('model_not_found')) {
    return 'Gemini model not found. The model name may be wrong or unavailable.' + rawSuffix
  }

  if (msg.includes('enotfound') || msg.includes('econnrefused')) {
    return 'Could not reach the Gemini API. Check your internet connection.' + rawSuffix
  }

  if (process.env['NODE_ENV'] !== 'production') {
    return `Gemini request failed.\n\nRaw error: ${raw.slice(0, 500)}`
  }
  return 'Gemini request failed. Run in dev mode for diagnostic detail.'
}

export interface GeminiPingResult {
  keyFound: boolean
  keyLength: number
  keyPrefix: string
  success: boolean
  response?: string
  rawError?: string
}

/**
 * Minimal diagnostic ping — makes the simplest possible direct HTTP call to
 * verify the key and connectivity without any SDK wrapper.
 */
export async function geminiPing(): Promise<GeminiPingResult> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {
      keyFound: false, keyLength: 0, keyPrefix: '',
      success: false, rawError: 'No API key found in .env'
    }
  }

  try {
    const response = await generateContent(apiKey, DEFAULT_MODEL, {
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: OK' }] }]
    })
    return {
      keyFound: true, keyLength: apiKey.length, keyPrefix: apiKey.slice(0, 4),
      success: true, response
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    return {
      keyFound: true, keyLength: apiKey.length, keyPrefix: apiKey.slice(0, 4),
      success: false, rawError: raw.slice(0, 500)
    }
  }
}

export async function magnusChat(params: MagnusChatParams): Promise<MagnusChatResult> {
  const {
    query,
    projectName,
    projectRoot,
    selectedFilePath,
    fileCount,
    entryFile,
    topFiles,
    languageSummary,
    conversationHistory = [],
    model: requestedModel = DEFAULT_MODEL
  } = params
  const model = requestedModel === 'auto' ? resolveAutoModel(query) : requestedModel

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {
      text:
        'Gemini API key not found. ' +
        'Add GEMINI_API_KEY=your-key to your .env file at the project root, then restart the app.',
      usedWebSearch: false,
      sources: []
    }
  }

  // Build project context
  const contextLines: string[] = [
    projectName ? `Project name: ${projectName}` : '',
    projectRoot ? `Project root: ${projectRoot}` : '',
    fileCount ? `Total source files: ${fileCount}` : '',
    entryFile ? `Entry point: ${entryFile}` : '',
    topFiles?.length ? `Most-connected files: ${topFiles.slice(0, 10).join(', ')}` : '',
    languageSummary ? `Languages: ${languageSummary}` : '',
    selectedFilePath ? `Currently selected file: ${selectedFilePath}` : ''
  ].filter(Boolean)

  const systemInstruction =
    [
      `You are Magnus, an AI assistant embedded inside PreBase, a code visualization IDE.`,
      `You can answer any question the user asks — general knowledge, coding help, architecture advice, or anything else.`,
      `When relevant, use the project context below to give more specific answers.`,
      `Be concise, helpful, and accurate.`,
      contextLines.length ? `\nCurrent project context:\n${contextLines.join('\n')}` : ''
    ]
      .filter(Boolean)
      .join('\n')

  const contents: GeminiContent[] = [
    ...conversationHistory.map((h) => ({
      role: h.role as 'user' | 'model',
      parts: [{ text: h.content }]
    })),
    { role: 'user' as const, parts: [{ text: query }] }
  ]

  const useWebSearch = isCodeOrProjectQuery(query)

  try {
    if (useWebSearch) {
      const result = await generateContentGrounded(apiKey, model, {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
      return {
        text: result.text || 'No response generated.',
        usedWebSearch: result.usedWebSearch,
        sources: result.sources
      }
    }

    const text = await generateContent(apiKey, model, {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] }
    })
    return { text: text || 'No response generated.', usedWebSearch: false, sources: [] }
  } catch (err) {
    console.warn('[Magnus] Gemini error:', err)
    return { text: classifyGeminiError(err), usedWebSearch: false, sources: [] }
  }
}
