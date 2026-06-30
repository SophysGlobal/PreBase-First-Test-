import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Parse a single named key from an .env-formatted file.
 * Handles: leading/trailing whitespace, quoted values, comment lines.
 */
function parseKeyFromEnvFile(filePath: string, keyName: string): string | undefined {
  try {
    const lines = readFileSync(filePath, 'utf-8').split(/\r?\n/)
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx < 0) continue
      const name = line.slice(0, eqIdx).trim()
      if (name !== keyName) continue
      let value = line.slice(eqIdx + 1).trim()
      // Strip optional surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value) return value
    }
  } catch {
    // File not found or unreadable — try next path
  }
  return undefined
}

/**
 * Retrieve the Gemini API key using the most reliable method available.
 *
 * Strategy (in order):
 * 1. Read the .env file directly from process.cwd() — bypasses build-time
 *    env-var inlining that electron-vite/Vite can apply to process.env references.
 * 2. Read .env from the directory two levels above __dirname (covers out/main/).
 * 3. Fall back to process.env in case a CI or Docker environment set it externally.
 */
export function getGeminiApiKey(): string | undefined {
  const envFilePaths = [
    resolve(process.cwd(), '.env'),
    // __dirname at runtime is <project>/out/main — walk up to project root
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../../../.env'),
  ]

  for (const p of envFilePaths) {
    const key = parseKeyFromEnvFile(p, 'GEMINI_API_KEY')
    if (key) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.log(`[PreBase/apiKey] read from file: ${p} | length: ${key.length} | prefix: ${key.slice(0, 6)}`)
      }
      return key
    }
  }

  // Last resort: environment variable (may have been set externally or inlined)
  const envKey = process.env['GEMINI_API_KEY']?.trim() || undefined
  if (envKey && process.env['NODE_ENV'] !== 'production') {
    console.log(`[PreBase/apiKey] read from process.env | length: ${envKey.length} | prefix: ${envKey.slice(0, 6)}`)
  }
  return envKey
}

/** Returns true if a Gemini API key is available. */
export function isKeyAvailable(): boolean {
  return !!getGeminiApiKey()
}

/** Dev-only: log key diagnostics without exposing the value. */
export function logKeyDiagnostics(): void {
  if (process.env['NODE_ENV'] === 'production') return
  const key = getGeminiApiKey()
  const fromEnv = process.env['GEMINI_API_KEY']?.trim()
  console.log('[PreBase/apiKey] cwd:', process.cwd())
  console.log('[PreBase/apiKey] __dirname:', __dirname)
  console.log('[PreBase/apiKey] key found via file read:', !!key, '| length:', key?.length ?? 0)
  console.log('[PreBase/apiKey] process.env key present:', !!fromEnv, '| length:', fromEnv?.length ?? 0)
  if (key && fromEnv && key !== fromEnv) {
    console.warn('[PreBase/apiKey] WARNING: file-read key differs from process.env key (using file-read value)')
  }
}
