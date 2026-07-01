/**
 * Direct HTTP client for the Gemini Generative Language API.
 *
 * Supports two credential types used by AI Studio:
 *
 *   1. Classic API keys (start with "AIza")
 *      → sent as `?key=` query parameter (same as the AI Studio cURL quickstart)
 *
 *   2. New "AQ." bearer credentials from the updated AI Studio key system
 *      → sent as `Authorization: Bearer <credential>` header
 *
 * We avoid the @google/genai SDK because it sends keys only via the
 * `x-goog-api-key` header, which does not accept the newer "AQ." credential type.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export type GeminiRole = 'user' | 'model'

export interface GeminiPart {
  text: string
}

export interface GeminiContent {
  role: GeminiRole
  parts: GeminiPart[]
}

interface GenerateRequest {
  contents: GeminiContent[]
  systemInstruction?: { parts: GeminiPart[] }
  generationConfig?: Record<string, unknown>
}

interface GeminiResponseCandidate {
  content: { parts: GeminiPart[]; role: string }
  finishReason: string
}

interface GeminiResponse {
  candidates?: GeminiResponseCandidate[]
  error?: { code: number; message: string; status: string }
}

/**
 * Try one specific auth method. Returns the response text or throws with the raw error JSON.
 */
async function tryAuth(
  apiKey: string,
  model: string,
  body: GenerateRequest,
  method: 'query' | 'header' | 'bearer'
): Promise<string> {
  const baseUrl = `${BASE_URL}/models/${model}:generateContent`
  const url = method === 'query'
    ? `${baseUrl}?key=${encodeURIComponent(apiKey)}`
    : baseUrl

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (method === 'header') headers['x-goog-api-key'] = apiKey
  if (method === 'bearer') headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const json: GeminiResponse = await res.json()

  if (!res.ok || json.error) {
    throw new Error(JSON.stringify(json.error ?? { code: res.status, message: `HTTP ${res.status}` }))
  }

  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
}

/**
 * Make a generateContent call, automatically finding the right auth method.
 * Tries: x-goog-api-key header → ?key= query param → Authorization: Bearer
 */
export async function generateContent(
  apiKey: string,
  model: string,
  body: GenerateRequest
): Promise<string> {
  const methods: Array<'header' | 'query' | 'bearer'> = ['header', 'query', 'bearer']
  let lastError: Error | undefined

  for (const method of methods) {
    try {
      return await tryAuth(apiKey, model, body, method)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // If it's not an auth error, don't try other methods
      const msg = lastError.message.toLowerCase()
      const isAuthError =
        msg.includes('api_key_invalid') ||
        msg.includes('api_key_service_blocked') ||
        msg.includes('unauthenticated') ||
        msg.includes('invalid_argument') ||
        msg.includes('"code":400') ||
        msg.includes('"code":401') ||
        msg.includes('"code":403')
      if (!isAuthError) break
    }
  }

  throw lastError ?? new Error('All auth methods failed')
}
