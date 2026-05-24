import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { FileCode, Loader2 } from 'lucide-react'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'

function languageForPath(path: string): string {
  if (path.endsWith('.tsx')) return 'typescript'
  if (path.endsWith('.ts') || path.endsWith('.mts') || path.endsWith('.cts')) return 'typescript'
  if (path.endsWith('.jsx')) return 'javascript'
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'javascript'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.css')) return 'css'
  return 'plaintext'
}

let monacoThemeDefined = false

function defineMonacoTheme(monaco: typeof import('monaco-editor')) {
  if (monacoThemeDefined) return
  monaco.editor.defineTheme('prebase-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a78bfa' },
      { token: 'string', foreground: '86efac' },
      { token: 'number', foreground: 'fcd34d' },
      { token: 'type', foreground: '67e8f9' },
      { token: 'function', foreground: '93c5fd' }
    ],
    colors: {
      'editor.background': '#0d0d0e',
      'editor.foreground': '#e4e4e7',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editor.lineHighlightBackground': '#18181b',
      'editor.selectionBackground': '#6366f133',
      'editor.inactiveSelectionBackground': '#6366f122',
      'editorCursor.foreground': '#a5b4fc',
      'editorIndentGuide.background': '#27272a',
      'editorIndentGuide.activeBackground': '#3f3f46'
    }
  })
  monacoThemeDefined = true
}

export function CodeEditorView() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const activeCodePath = useGraphStore((s) => s.activeCodePath)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineNumbers = useSettingsStore((s) => s.editorLineNumbers)
  const editorWordWrap = useSettingsStore((s) => s.editorWordWrap)

  const [content, setContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorHeight, setEditorHeight] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setEditorHeight(Math.max(200, el.clientHeight))
    })
    ro.observe(el)
    setEditorHeight(Math.max(200, el.clientHeight))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!activeCodePath || !snapshot) {
      setContent('')
      setError(null)
      setFileLoading(false)
      return
    }

    let cancelled = false
    setFileLoading(true)
    setError(null)

    void window.prebase
      .readFile(activeCodePath)
      .then((text) => {
        if (cancelled) return
        if (text === null) {
          setError('Could not read file from project')
          setContent('')
        } else {
          setContent(text)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load file')
          setContent('')
        }
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeCodePath, snapshot?.projectPath])

  const handleBeforeMount = useCallback((monaco: typeof import('monaco-editor')) => {
    defineMonacoTheme(monaco)
  }, [])

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed
  }, [])

  const monacoOptions = {
    readOnly: true,
    minimap: { enabled: false },
    fontSize: editorFontSize,
    lineHeight: Math.round(editorFontSize * 1.45),
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
    fontLigatures: true,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'line' as const,
    smoothScrolling: true,
    lineNumbers: editorLineNumbers ? ('on' as const) : ('off' as const),
    wordWrap: editorWordWrap ? ('on' as const) : ('off' as const),
    bracketPairColorization: { enabled: true },
    guides: { indentation: true },
    automaticLayout: true
  }

  if (!activeCodePath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-8 bg-[#0d0d0e]">
        <FileCode className="w-10 h-10 text-text-muted mb-3 opacity-40" />
        <p className="text-sm text-text-secondary mb-1">No file selected</p>
        <p className="text-xs text-text-muted max-w-sm">
          Choose a file from the explorer, or right-click a node in Graph view and select
          &quot;Open in Code View&quot;.
        </p>
      </div>
    )
  }

  const showEditor = !fileLoading && !error

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-[#0d0d0e]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-surface-raised/80 shrink-0 titlebar-no-drag">
        <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-xs font-mono text-text-secondary truncate">{activeCodePath}</span>
        {fileLoading && <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin ml-auto" />}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400/90 z-10">
            {error}
          </div>
        )}
        {fileLoading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-muted text-sm z-10 bg-[#0d0d0e]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading file…
          </div>
        )}
        {showEditor && (
          <Editor
            key={activeCodePath}
            height={editorHeight}
            language={languageForPath(activeCodePath)}
            value={content}
            theme="prebase-dark"
            options={monacoOptions}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            loading={null}
          />
        )}
      </div>
    </div>
  )
}
