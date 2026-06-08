import { existsSync, readFileSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import type { ParseResult } from '../types'
import type { PathMappings } from './tsconfig-paths'
import { nodeIdForPath, toRelative } from './paths'

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
  '.kts',
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

export interface ImportResolutionContext {
  pathIndex: Map<string, string>
  javaFqnIndex: Map<string, string>
  simpleNameIndex: Map<string, string[]>
  goModulePath: string | null
}

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

function readGoModulePath(projectRoot: string): string | null {
  const modPath = join(projectRoot, 'go.mod')
  if (!existsSync(modPath)) return null
  try {
    const content = readFileSync(modPath, 'utf-8')
    const match = content.match(/^module\s+(\S+)/m)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export function buildImportResolutionContext(
  projectPath: string,
  results: ParseResult[]
): ImportResolutionContext {
  const pathIndex = new Map<string, string>()
  const javaFqnIndex = new Map<string, string>()
  const simpleNameIndex = new Map<string, string[]>()

  for (const result of results) {
    const normalized = result.relativePath.replace(/\\/g, '/')
    pathIndex.set(normalized, nodeIdForPath(normalized))
    const base = basename(normalized)
    if (!pathIndex.has(base)) pathIndex.set(base, nodeIdForPath(normalized))

    const ext = extname(normalized).toLowerCase()
    const stem = base.replace(/\.[^.]+$/, '')
    const existing = simpleNameIndex.get(stem) ?? []
    if (!existing.includes(normalized)) {
      existing.push(normalized)
      simpleNameIndex.set(stem, existing)
    }

    if ((ext === '.java' || ext === '.kt' || ext === '.kts') && result.packageName) {
      javaFqnIndex.set(`${result.packageName}.${stem}`, normalized)
      const pathSuffix = `${result.packageName.replace(/\./g, '/')}/${stem}`
      javaFqnIndex.set(pathSuffix, normalized)
    }

    // Infer FQN from standard src/main/java/... layout when package declaration is missing.
    if (ext === '.java' || ext === '.kt' || ext === '.kts') {
      for (const prefix of ['src/main/java/', 'src/main/kotlin/', 'src/']) {
        if (!normalized.startsWith(prefix)) continue
        const suffix = normalized.slice(prefix.length).replace(/\.(java|kt|kts)$/, '')
        javaFqnIndex.set(suffix.replace(/\//g, '.'), normalized)
        javaFqnIndex.set(suffix, normalized)
      }
    }
  }

  return {
    pathIndex,
    javaFqnIndex,
    simpleNameIndex,
    goModulePath: readGoModulePath(projectPath)
  }
}

function tryResolveJavaImport(
  projectRoot: string,
  importSource: string,
  ctx: ImportResolutionContext
): string | null {
  const fromIndex = ctx.javaFqnIndex.get(importSource)
  if (fromIndex) return fromIndex

  const pathLike = importSource.replace(/\./g, '/')
  const bases = [
    join(projectRoot, 'src/main/java', pathLike),
    join(projectRoot, 'src/main/kotlin', pathLike),
    join(projectRoot, 'src', pathLike),
    join(projectRoot, 'app/src/main/java', pathLike),
    join(projectRoot, pathLike)
  ]
  for (const base of bases) {
    const resolved = tryResolveFile(projectRoot, base)
    if (resolved) return resolved
  }

  const simple = importSource.split('.').pop()
  if (simple) {
    const paths = ctx.simpleNameIndex.get(simple) ?? []
    const jvmPaths = paths.filter((p) => /\.(java|kt|kts)$/.test(p))
    if (jvmPaths.length === 1) return jvmPaths[0]
  }
  return null
}

function tryResolvePythonImport(
  projectRoot: string,
  fromFile: string,
  importSource: string,
  ctx: ImportResolutionContext
): string | null {
  const modulePath = importSource.replace(/\./g, '/')
  const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))

  if (importSource.startsWith('.')) {
    const relative = importSource.replace(/^\.+/, '').replace(/\./g, '/')
    const base = relative ? resolve(fromDir, relative) : fromDir
    const resolved = tryResolveFile(projectRoot, base)
    if (resolved) return resolved
    const pkgInit = tryResolveFile(projectRoot, join(base, '__init__'))
    if (pkgInit) return pkgInit
  }

  const relative = tryResolveFile(projectRoot, resolve(fromDir, modulePath))
  if (relative) return relative

  const roots = [projectRoot, join(projectRoot, 'src'), join(projectRoot, 'app')]
  for (const root of roots) {
    const resolved = tryResolveFile(projectRoot, join(root, modulePath))
    if (resolved) return resolved
    const pkgInit = tryResolveFile(projectRoot, join(root, modulePath, '__init__'))
    if (pkgInit) return pkgInit
  }

  const simple = importSource.split('.').pop()
  if (simple) {
    const paths = ctx.simpleNameIndex.get(simple) ?? []
    const pyPaths = paths.filter((p) => p.endsWith('.py'))
    if (pyPaths.length === 1) return pyPaths[0]
  }
  return null
}

function tryResolveGoImport(
  projectRoot: string,
  importSource: string,
  ctx: ImportResolutionContext
): string | null {
  let pathPart = importSource
  if (ctx.goModulePath && importSource.startsWith(ctx.goModulePath)) {
    pathPart = importSource.slice(ctx.goModulePath.length).replace(/^\//, '')
  }
  if (pathPart.startsWith('.')) {
    return null
  }
  const base = join(projectRoot, pathPart)
  const resolved = tryResolveFile(projectRoot, base)
  if (resolved) return resolved
  return tryResolveFile(projectRoot, join(base, pathPart.split('/').pop() ?? ''))
}

function tryResolveRelativeImport(
  projectRoot: string,
  fromFile: string,
  importSource: string
): string | null {
  const fromDir = join(projectRoot, fromFile.replace(/\/[^/]+$/, ''))
  const base = resolve(fromDir, importSource)
  return tryResolveFile(projectRoot, base)
}

function fuzzyResolveImport(
  projectRoot: string,
  fromFile: string,
  importSource: string,
  ctx: ImportResolutionContext
): string | null {
  const source = importSource.split('?')[0].trim()
  if (!source) return null

  if (source.startsWith('.')) {
    const fromDir = fromFile.replace(/\/[^/]+$/, '')
    const joined = `${fromDir}/${source.replace(/^\.\//, '')}`.replace(/\/+/g, '/')
    const candidates = [joined, joined.replace(/\/$/, ''), `${joined}/index`]
    for (const c of candidates) {
      const normalized = c.replace(/^\.\//, '')
      if (ctx.pathIndex.has(normalized)) return normalized
      for (const path of ctx.pathIndex.keys()) {
        if (path === normalized || path.endsWith(`/${normalized}`)) return path
      }
    }
  }

  const tail = source.split(/[/\\]/).pop()?.split('.').pop() ?? source
  const tailName = source.split(/[/\\.]/).filter(Boolean).pop() ?? source

  for (const path of ctx.pathIndex.keys()) {
    if (
      path.endsWith(`/${source}`) ||
      path.endsWith(`/${tail}`) ||
      path.endsWith(`/${tailName}`) ||
      basename(path).replace(/\.[^.]+$/, '') === tailName
    ) {
      return path
    }
  }

  const simplePaths = ctx.simpleNameIndex.get(tailName) ?? []
  if (simplePaths.length === 1) return simplePaths[0]

  void projectRoot
  return null
}

export function resolveImportWithContext(
  projectRoot: string,
  fromFile: string,
  importSource: string,
  pathMappings: PathMappings,
  ctx: ImportResolutionContext
): string | null {
  const source = importSource.split('?')[0].trim()
  if (!source) return null

  const ext = extname(fromFile).toLowerCase()

  if (source.startsWith('.')) {
    const rel = tryResolveRelativeImport(projectRoot, fromFile, source)
    if (rel) return rel
  }

  if (ext === '.java' || ext === '.kt' || ext === '.kts') {
    const java = tryResolveJavaImport(projectRoot, source, ctx)
    if (java) return java
  }

  if (ext === '.py' || source.startsWith('.')) {
    const py = tryResolvePythonImport(projectRoot, fromFile, source, ctx)
    if (py) return py
  }

  if (ext === '.go') {
    const go = tryResolveGoImport(projectRoot, source, ctx)
    if (go) return go
  }

  if (/^[a-zA-Z_][\w.]*$/.test(source) && source.includes('.') && !source.startsWith('@')) {
    const java = tryResolveJavaImport(projectRoot, source, ctx)
    if (java) return java
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
    const resolved = tryResolveFile(projectRoot, base)
    if (resolved) return resolved
  }

  const fuzzy = fuzzyResolveImport(projectRoot, fromFile, source, ctx)
  if (fuzzy) return fuzzy

  return null
}
