import { getGeminiApiKey } from './apiKeyLoader'
import { generateContent, type GeminiContent } from './geminiClient'

const MODEL = 'gemini-2.5-flash'

export interface MagnusMessage {
  role: 'user' | 'model'
  content: string
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
    const response = await generateContent(apiKey, MODEL, {
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

export async function magnusChat(params: MagnusChatParams): Promise<string> {
  const {
    query,
    projectName,
    projectRoot,
    selectedFilePath,
    fileCount,
    entryFile,
    topFiles,
    languageSummary,
    conversationHistory = []
  } = params

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return (
      'Gemini API key not found. ' +
      'Add GEMINI_API_KEY=your-key to your .env file at the project root, then restart the app.'
    )
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

  try {
    const text = await generateContent(apiKey, MODEL, {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] }
    })
    return text || 'No response generated.'
  } catch (err) {
    console.warn('[Magnus] Gemini error:', err)
    return classifyGeminiError(err)
  }
}
