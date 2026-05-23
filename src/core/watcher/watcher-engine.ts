import chokidar, { type FSWatcher } from 'chokidar'
import { basename } from 'path'
import { DEFAULT_IGNORE_PATTERNS } from '../utils/ignore-patterns'
import { isCodeFile } from '../utils/paths'

export interface WatcherEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  relativePath: string
}

export type WatcherCallback = (events: WatcherEvent[]) => void

export class WatcherEngine {
  private watcher: FSWatcher | null = null
  private pendingEvents: WatcherEvent[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private callback: WatcherCallback | null = null
  private projectRoot = ''

  start(projectRoot: string, callback: WatcherCallback, debounceMs = 300): void {
    this.stop()
    this.projectRoot = projectRoot
    this.callback = callback

    this.watcher = chokidar.watch(projectRoot, {
      ignored: (path) => this.shouldIgnore(path),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      depth: 12
    })

    const queue = (type: WatcherEvent['type'], absolutePath: string) => {
      const relativePath = absolutePath
        .slice(projectRoot.length)
        .replace(/^[/\\]/, '')
        .replace(/\\/g, '/')

      if (!relativePath || this.shouldIgnore(relativePath)) return
      if (type !== 'unlinkDir' && type !== 'addDir' && !isCodeFile(relativePath)) return

      this.pendingEvents.push({ type, relativePath })
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.flush(), debounceMs)
    }

    this.watcher
      .on('add', (p) => queue('add', p))
      .on('change', (p) => queue('change', p))
      .on('unlink', (p) => queue('unlink', p))
      .on('addDir', (p) => queue('addDir', p))
      .on('unlinkDir', (p) => queue('unlinkDir', p))
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingEvents = []
    void this.watcher?.close()
    this.watcher = null
    this.callback = null
  }

  private flush(): void {
    if (!this.callback || this.pendingEvents.length === 0) return
    const events = [...this.pendingEvents]
    this.pendingEvents = []
    this.callback(events)
  }

  private shouldIgnore(path: string): boolean {
    const normalized = path.replace(/\\/g, '/')
    const name = basename(normalized)

    if (name.startsWith('.') && name !== '.') return true

    for (const pattern of DEFAULT_IGNORE_PATTERNS) {
      const simplified = pattern.replace(/\*\*\//g, '').replace(/\*\*/g, '').replace(/\*/g, '')
      if (simplified && normalized.includes(simplified.replace(/\//g, ''))) {
        if (normalized.includes('node_modules')) return true
        if (normalized.includes('/dist/') || normalized.endsWith('/dist')) return true
        if (normalized.includes('/build/')) return true
        if (normalized.includes('/.git/')) return true
      }
    }

    return (
      normalized.includes('node_modules') ||
      normalized.includes('/dist/') ||
      normalized.includes('/build/') ||
      normalized.includes('/.next/') ||
      normalized.includes('/coverage/')
    )
  }
}
