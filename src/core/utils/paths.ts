import { existsSync } from 'fs'
import { extname, join, normalize, relative, resolve } from 'path'
import type { PathMappings } from './tsconfig-paths'

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.java',
  '.kt',
  '.kts',
  '.py',
  '.go',
  '.rs',
  '.cs',
  '.cpp',
  '.cc',
  '.cxx',
  '.c',
  '.h',
  '.hpp',
  '.swift',
  '.php',
  '.rb',
  '.lua',
  '.dart',
  '.scala',
  '.vue',
  '.svelte'
])

export function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, '/')
}

export function toRelative(projectRoot: string, absolutePath: string): string {
  return normalizePath(relative(projectRoot, absolutePath))
}

const RESOLVE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.java',
  '.kt',
  '.py',
  '.go',
  '.rs',
  '.cs',
  '.cpp',
  '.c',
  '.swift',
  '.php',
  '.rb',
  '.lua',
  '.dart',
  '.scala',
  '.vue',
  '.svelte'
]

function tryResolveFile(projectRoot: string, absoluteBase: string): string | null {
  const candidates = [
    ...RESOLVE_EXTENSIONS.map((ext) => `${absoluteBase}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => join(absoluteBase, `index${ext}`))
  ]

  for (const c of candidates) {
    if (!existsSync(c)) continue
    const rel = toRelative(projectRoot, c)
    if (!rel.startsWith('..') && !rel.startsWith('/')) return rel
  }
  return null
}

function tryResolveJavaImport(projectRoot: string, importSource: string): string | null {
  const pathLike = importSource.replace(/\./g, '/')
  const bases = [
    join(projectRoot, 'src/main/java', pathLike),
    join(projectRoot, 'src/main/kotlin', pathLike),
    join(projectRoot, 'src', pathLike),
    join(projectRoot, pathLike)
  ]
  for (const base of bases) {
    const resolved = tryResolveFile(projectRoot, base)
    if (resolved) return resolved
  }
  return null
}

function tryResolvePythonImport(projectRoot: string, fromFile: string, importSource: string): string | null {
  const modulePath = importSource.replace(/\./g, '/')
  const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))
  const relative = tryResolveFile(projectRoot, resolve(fromDir, modulePath))
  if (relative) return relative
  const roots = [projectRoot, join(projectRoot, 'src')]
  for (const root of roots) {
    const resolved = tryResolveFile(projectRoot, join(root, modulePath))
    if (resolved) return resolved
    const pkgInit = tryResolveFile(projectRoot, join(root, modulePath, '__init__'))
    if (pkgInit) return pkgInit
  }
  return null
}

export function resolveImportPath(
  projectRoot: string,
  fromFile: string,
  importSource: string,
  pathMappings: PathMappings = {}
): string | null {
  const source = importSource.split('?')[0].trim()
  if (!source) return null

  if (source.startsWith('.')) {
    const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))
    const base = resolve(fromDir, source)
    return tryResolveFile(projectRoot, base)
  }

  if (/^[a-zA-Z_][\w.]*$/.test(source) && source.includes('.') && !source.startsWith('@')) {
    if (fromFile.endsWith('.java') || fromFile.endsWith('.kt') || fromFile.endsWith('.kts')) {
      const java = tryResolveJavaImport(projectRoot, source)
      if (java) return java
    }
  }

  if (fromFile.endsWith('.py')) {
    const py = tryResolvePythonImport(projectRoot, fromFile, source)
    if (py) return py
  }

  for (const [pattern, targets] of Object.entries(pathMappings)) {
    if (!source.startsWith(pattern)) continue
    const rest = source.slice(pattern.length)
    for (const targetRoot of targets) {
      const base = join(targetRoot, rest)
      const resolved = tryResolveFile(projectRoot, base)
      if (resolved) return resolved
    }
  }

  if (source.startsWith('/') || source.includes('/')) {
    const base = join(projectRoot, source.replace(/^\//, ''))
    return tryResolveFile(projectRoot, base)
  }

  return null
}

export function nodeIdForPath(relativePath: string): string {
  return `file:${relativePath}`
}

export function folderIdForPath(relativePath: string): string {
  return `folder:${relativePath || '.'}`
}

export function getParentFolderPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null
  parts.pop()
  return parts.join('/')
}
