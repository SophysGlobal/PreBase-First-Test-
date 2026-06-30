import { readFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import { getGeminiApiKey } from './apiKeyLoader'
import { generateContent } from './geminiClient'
import {
  getCachedDescription,
  setCachedDescription,
  fileCacheKey,
  layerCacheKey,
  hashFileIds,
  type CachedDescription
} from './descriptionCache'

const MODEL = 'gemini-2.5-flash'
const MAX_FILE_CHARS = 6_000
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.gz', '.tar', '.7z',
  '.mp3', '.mp4', '.wav', '.ogg', '.mov', '.avi',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat'
])

function shouldSkipFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  const name = basename(filePath)
  if (BINARY_EXTENSIONS.has(ext)) return true
  if (name.endsWith('.lock') || name === 'package-lock.json') return true
  return false
}

function trimFileContent(content: string): string {
  if (content.length <= MAX_FILE_CHARS) return content
  // Return top portion with a note
  return content.slice(0, MAX_FILE_CHARS) + '\n\n[... content trimmed for brevity ...]'
}

function getApiKey(): string | null {
  return getGeminiApiKey() ?? null
}

export interface DescribeFileParams {
  projectRoot: string
  projectName: string
  relativeFilePath: string
  neighboringFiles?: string[]
}

export interface DescribeLayerParams {
  projectRoot: string
  projectName: string
  layoutType: 'hierarchy' | 'pyramid'
  depth: number
  fileIds: string[]
  filePaths: string[]
  cachedFileDescriptions?: Record<string, string>
}

export async function describeFile(params: DescribeFileParams): Promise<string> {
  const { projectRoot, projectName, relativeFilePath } = params

  const cacheKey = fileCacheKey(projectRoot, relativeFilePath)
  const cached = await getCachedDescription(cacheKey)
  if (cached) return cached.description

  const apiKey = getApiKey()
  if (!apiKey) return ''

  if (shouldSkipFile(relativeFilePath)) return ''

  let fileContent = ''
  try {
    const fullPath = join(projectRoot, relativeFilePath)
    const raw = await readFile(fullPath, 'utf-8')
    fileContent = trimFileContent(raw)
  } catch {
    fileContent = ''
  }

  const ext = extname(relativeFilePath).replace('.', '') || 'unknown'
  const neighbors = (params.neighboringFiles ?? []).slice(0, 6).join(', ')

  const prompt = `You are helping describe a source code file inside a software project.

Project name: ${projectName}
File path: ${relativeFilePath}
File type: ${ext}
${neighbors ? `Neighboring related files: ${neighbors}` : ''}
File content:
${fileContent || '(content unavailable)'}

Write a concise 1-3 sentence description of what this file does in the project.
Do not hallucinate. If the file content is unclear, say what can be inferred from the name, path, or imports.
Do not include markdown tables or code blocks. Plain text only.`

  try {
    const description = await generateContent(apiKey, MODEL, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })
    if (description) {
      const entry: CachedDescription = {
        description,
        generatedAt: new Date().toISOString(),
        model: MODEL
      }
      await setCachedDescription(cacheKey, entry)
    }
    return description
  } catch (err) {
    console.warn('[GeminiService] describeFile error:', err)
    return ''
  }
}

export async function describeLayer(params: DescribeLayerParams): Promise<string> {
  const { projectRoot, projectName, layoutType, depth, fileIds, filePaths } = params

  const idsHash = hashFileIds(fileIds)
  const cacheKey = layerCacheKey(projectRoot, layoutType, depth, idsHash)
  const cached = await getCachedDescription(cacheKey)
  if (cached) return cached.description

  const apiKey = getApiKey()
  if (!apiKey) return ''

  const isUnreachable = depth >= 10_000
  const depthLabel = isUnreachable ? 'Unlinked (not reachable from entry)' : `Depth ${depth}`
  const layoutLabel = layoutType === 'hierarchy' ? 'Hierarchy (ring-based)' : 'Pyramid (top-down layers)'
  const distanceExplain = isUnreachable
    ? 'These files have no connection path from the entry point.'
    : depth === 0
      ? 'This is the entry file layer.'
      : `These files are ${depth} relationship step${depth === 1 ? '' : 's'} away from the entry file.`

  const fileLines = filePaths
    .slice(0, 20)
    .map((p, i) => {
      const desc = params.cachedFileDescriptions?.[fileIds[i] ?? '']
      return desc ? `  - ${p}: ${desc}` : `  - ${p}`
    })
    .join('\n')

  const prompt = `You are helping describe a layer in a codebase architecture graph.

Project name: ${projectName}
Layout: ${layoutLabel}
Layer: ${depthLabel}
Meaning: ${distanceExplain}
Total files: ${filePaths.length}
Files in this layer (up to 20 shown):
${fileLines}

Write a concise 2-4 sentence explanation of what this layer appears to represent in the project.
Focus on architectural role (e.g. "This layer contains the main UI pages and feature components").
Be specific to the file names/paths. Do not make generic statements.
Do not hallucinate. Do not include markdown tables or code blocks. Plain text only.`

  try {
    const description = await generateContent(apiKey, MODEL, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })
    if (description) {
      const entry: CachedDescription = {
        description,
        generatedAt: new Date().toISOString(),
        model: MODEL
      }
      await setCachedDescription(cacheKey, entry)
    }
    return description
  } catch (err) {
    console.warn('[GeminiService] describeLayer error:', err)
    return ''
  }
}

export function isGeminiAvailable(): boolean {
  return !!getGeminiApiKey()
}
