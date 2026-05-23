import fg from 'fast-glob'
import { basename, extname } from 'path'
import ignore from 'ignore'
import { DEFAULT_IGNORE_PATTERNS } from '../utils/ignore-patterns'
import { isCodeFile, normalizePath, toRelative } from '../utils/paths'
import type { ScannedFile } from '../types'

export interface ScanOptions {
  extraIgnore?: string[]
}

export class FileScanner {
  private ig = ignore()

  constructor() {
    this.ig.add(DEFAULT_IGNORE_PATTERNS)
  }

  async scanProject(projectRoot: string, options: ScanOptions = {}): Promise<ScannedFile[]> {
    if (options.extraIgnore?.length) {
      this.ig.add(options.extraIgnore)
    }

    const entries = await fg('**/*', {
      cwd: projectRoot,
      absolute: true,
      onlyFiles: true,
      dot: false,
      followSymbolicLinks: false,
      suppressErrors: true
    })

    const files: ScannedFile[] = []

    for (const absolutePath of entries) {
      const relativePath = toRelative(projectRoot, absolutePath)
      if (this.ig.ignores(relativePath)) continue
      if (!isCodeFile(absolutePath)) continue

      files.push({
        absolutePath: normalizePath(absolutePath),
        relativePath,
        extension: extname(absolutePath).toLowerCase()
      })
    }

    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }

  async scanFolders(projectRoot: string): Promise<string[]> {
    const entries = await fg('**/', {
      cwd: projectRoot,
      onlyDirectories: true,
      dot: false
    })

    return entries
      .map((d) => d.replace(/\/$/, ''))
      .filter((d) => !this.ig.ignores(d))
      .sort((a, b) => a.localeCompare(b))
  }

  detectProjectType(projectRoot: string, files: ScannedFile[]): string {
    const names = new Set(files.map((f) => basename(f.relativePath)))
    if (names.has('package.json')) {
      const hasReact = files.some(
        (f) => f.extension === '.tsx' || f.extension === '.jsx'
      )
      return hasReact ? 'react' : 'javascript'
    }
    if (files.some((f) => f.extension === '.ts' || f.extension === '.tsx')) {
      return 'typescript'
    }
    return 'unknown'
  }
}
