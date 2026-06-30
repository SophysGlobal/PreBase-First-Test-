import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

export interface CachedDescription {
  description: string
  generatedAt: string
  model: string
}

type CacheStore = Record<string, CachedDescription>

let _store: CacheStore | null = null
let _cacheFilePath: string | null = null

function getCacheFilePath(): string {
  if (_cacheFilePath) return _cacheFilePath
  const userData = app.getPath('userData')
  _cacheFilePath = join(userData, 'ai-descriptions-cache.json')
  return _cacheFilePath
}

async function loadStore(): Promise<CacheStore> {
  if (_store !== null) return _store
  try {
    const path = getCacheFilePath()
    const raw = await readFile(path, 'utf-8')
    _store = JSON.parse(raw) as CacheStore
  } catch {
    _store = {}
  }
  return _store
}

async function persistStore(): Promise<void> {
  if (_store === null) return
  try {
    const path = getCacheFilePath()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(_store, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[DescriptionCache] Failed to persist:', err)
  }
}

export async function getCachedDescription(key: string): Promise<CachedDescription | null> {
  const store = await loadStore()
  return store[key] ?? null
}

export async function setCachedDescription(
  key: string,
  entry: CachedDescription
): Promise<void> {
  const store = await loadStore()
  store[key] = entry
  await persistStore()
}

export function fileCacheKey(projectRoot: string, relativeFilePath: string): string {
  return `${projectRoot}::file::${relativeFilePath}`
}

export function layerCacheKey(
  projectRoot: string,
  layoutType: string,
  depthId: string | number,
  fileIdsHash: string
): string {
  return `${projectRoot}::layer::${layoutType}::${depthId}::${fileIdsHash}`
}

export function hashFileIds(fileIds: string[]): string {
  const sorted = [...fileIds].sort().join(',')
  let h = 5381
  for (let i = 0; i < sorted.length; i++) {
    h = ((h << 5) + h + sorted.charCodeAt(i)) | 0
  }
  return ((h >>> 0) % 1_000_000).toString(16)
}
