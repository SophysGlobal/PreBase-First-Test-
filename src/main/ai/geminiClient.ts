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

/** Detect whether a credential needs Bearer token auth vs classic API key auth. */
function isBearer(credential: string): boolean {
  // New AI Studio credentials start with "AQ." — they are OAuth2-style bearer tokens
  return credential.startsWith('AQ.')
}

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

/** Make a generateContent call, choosing the right auth method for the credential type. */
export async function generateContent(
  apiKey: string,
  model: string,
  body: GenerateRequest
): Promise<string> {
  // Classic AIza keys → ?key= query param (matches AI Studio cURL quickstart)
  // AQ. credentials  → Authorization: Bearer header (OAuth2-style)
  const bearer = isBearer(apiKey)
  const url = bearer
    ? `${BASE_URL}/models/${model}:generateContent`
    : `${BASE_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearer) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  const json: GeminiResponse = await res.json()

  if (!res.ok || json.error) {
    throw new Error(JSON.stringify(json.error ?? { code: res.status, message: `HTTP ${res.status}` }))
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return text.trim()
}
