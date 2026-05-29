import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { FileCode, Loader2 } from 'lucide-react'
import { definePrebaseEditorTheme } from '../../monaco/setup'
import { useGraphStore } from '../../state/graph-store'
import { useSettingsStore } from '../../state/settings-store'
import { monacoLanguageForPath } from '../../utils/language'

export function CodeEditorView() {
  const snapshot = useGraphStore((s) => s.snapshot)
  const activeCodePath = useGraphStore((s) => s.activeCodePath)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineNumbers = useSettingsStore((s) => s.editorLineNumbers)
  const editorWordWrap = useSettingsStore((s) => s.editorWordWrap)
  const editorMinimap = useSettingsStore((s) => s.editorMinimap)

  const monaco = useMonaco()
  const [content, setContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (monaco) {
      definePrebaseEditorTheme(monaco)
      monaco.editor.setTheme('prebase-dark')
    }
  }, [monaco])

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
          setError(`Could not read "${activeCodePath}" from disk`)
          setContent('')
        } else {
          setContent(text)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file')
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

  const handleMount = useCallback((ed: editor.IStandaloneCodeEditor) => {
    editorRef.current = ed
    setEditorReady(true)
    ed.layout()
  }, [])

  const monacoOptions = {
    readOnly: true,
    minimap: { enabled: editorMinimap },
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

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-[#0d0d0e]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-surface-raised/80 shrink-0 titlebar-no-drag">
        <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-xs font-mono text-text-secondary truncate">{activeCodePath}</span>
        {(fileLoading || !editorReady) && (
          <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin ml-auto" />
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400/90 z-10 px-6 text-center">
            {error}
          </div>
        )}
        {fileLoading && !error && (
          <div className="absolute inset-x-0 top-3 z-10 flex justify-center pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-surface-overlay/90 border border-border-subtle text-[11px] text-text-muted">
              Loading file…
            </span>
          </div>
        )}
        <Editor
          key={activeCodePath}
          height="100%"
          language={monacoLanguageForPath(activeCodePath)}
          value={content}
          theme="prebase-dark"
          options={monacoOptions}
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center h-full gap-2 text-text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing editor…
            </div>
          }
        />
      </div>
    </div>
  )
}
