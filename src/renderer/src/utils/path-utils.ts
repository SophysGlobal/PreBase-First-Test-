/** Browser-safe project-relative path normalization (no Node path module). */

export function toProjectRelativePath(projectPath: string, filePath: string): string | null {
  if (!filePath) return null

  const normProject = projectPath.replace(/\\/g, '/').replace(/\/$/, '')
  const normFile = filePath.replace(/\\/g, '/')

  const isAbsUnix = normFile.startsWith('/')
  const isAbsWin = /^[A-Za-z]:\//.test(normFile)

  if (isAbsUnix || isAbsWin) {
    const prefix = normProject + '/'
    if (!normFile.startsWith(prefix) && normFile !== normProject) {
      if (normFile.startsWith(normProject)) {
        const rel = normFile.slice(normProject.length).replace(/^\//, '')
        return rel || null
      }
      return null
    }
    const rel = normFile.slice(normProject.length).replace(/^\//, '')
    return rel || null
  }

  return normFile.replace(/^\//, '')
}
