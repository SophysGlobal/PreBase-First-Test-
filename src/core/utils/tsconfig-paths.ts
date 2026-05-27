import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

export type PathMappings = Record<string, string[]>

/**
 * Load path aliases from tsconfig.json (and referenced configs).
 */
export function loadTsconfigPaths(projectRoot: string): PathMappings {
  const mappings: PathMappings = {}
  const visited = new Set<string>()

  function readConfig(configPath: string): void {
    const abs = resolve(configPath)
    if (visited.has(abs) || !existsSync(abs)) return
    visited.add(abs)

    try {
      const raw = readFileSync(abs, 'utf-8')
      const json = JSON.parse(stripJsonComments(raw)) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
        extends?: string
      }

      if (json.extends) {
        const parent = resolve(dirname(abs), json.extends)
        readConfig(parent.endsWith('.json') ? parent : `${parent}.json`)
      }

      const baseUrl = json.compilerOptions?.baseUrl
        ? resolve(dirname(abs), json.compilerOptions.baseUrl)
        : dirname(abs)

      const paths = json.compilerOptions?.paths ?? {}
      for (const [key, targets] of Object.entries(paths)) {
        const pattern = key.replace(/\*$/, '')
        const resolvedTargets = targets.map((t) => {
          const target = t.replace(/\*$/, '')
          return resolve(baseUrl, target).replace(/\\/g, '/')
        })
        mappings[pattern] = resolvedTargets
      }
    } catch {
      // ignore malformed configs
    }
  }

  const candidates = [
    join(projectRoot, 'tsconfig.json'),
    join(projectRoot, 'tsconfig.app.json'),
    join(projectRoot, 'tsconfig.web.json')
  ]

  for (const c of candidates) {
    if (existsSync(c)) readConfig(c)
  }

  return mappings
}

function stripJsonComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}
