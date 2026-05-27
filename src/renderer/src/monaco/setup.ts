import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

let setupDone = false

export function setupMonaco(): void {
  if (setupDone) return
  setupDone = true

  self.MonacoEnvironment = {
    getWorker(_workerId, label) {
      switch (label) {
        case 'json':
          return new jsonWorker()
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker()
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker()
        case 'typescript':
        case 'javascript':
          return new tsWorker()
        default:
          return new editorWorker()
      }
    }
  }

  loader.config({ monaco })
}

export function definePrebaseEditorTheme(monacoApi: typeof monaco): void {
  monacoApi.editor.defineTheme('prebase-dark', {
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
}
