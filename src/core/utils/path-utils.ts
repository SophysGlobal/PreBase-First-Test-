import { isAbsolute, join, relative } from 'path'

/** Normalize a graph node path to a project-relative path for filesystem reads. */
export function toProjectRelativePath(projectPath: string, filePath: string): string | null {
  if (!filePath) return null

  const normalizedFile = filePath.replace(/\\/g, '/')

  if (isAbsolute(filePath) || /^[A-Za-z]:\//.test(normalizedFile)) {
    const rel = relative(projectPath, filePath).replace(/\\/g, '/')
    if (rel.startsWith('..') || rel === '') return null
    return rel
  }

  return normalizedFile.replace(/^\//, '')
}

export function resolveProjectFilePath(projectPath: string, filePath: string): string | null {
  const rel = toProjectRelativePath(projectPath, filePath)
  if (!rel) return null
  return join(projectPath, rel)
}
