export interface SupportedLanguage {
  id: string
  name: string
  extensions: string[]
  parser: 'babel' | 'import-regex' | 'monaco-only'
  graphImports: boolean
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    id: 'typescript',
    name: 'TypeScript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    parser: 'babel',
    graphImports: true
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    parser: 'babel',
    graphImports: true
  },
  {
    id: 'java',
    name: 'Java',
    extensions: ['.java'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    extensions: ['.kt', '.kts'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'python',
    name: 'Python',
    extensions: ['.py'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'go',
    name: 'Go',
    extensions: ['.go'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'rust',
    name: 'Rust',
    extensions: ['.rs'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'csharp',
    name: 'C#',
    extensions: ['.cs'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'cpp',
    name: 'C / C++',
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'swift',
    name: 'Swift',
    extensions: ['.swift'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'php',
    name: 'PHP',
    extensions: ['.php'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'ruby',
    name: 'Ruby',
    extensions: ['.rb'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'lua',
    name: 'Lua',
    extensions: ['.lua'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'dart',
    name: 'Dart',
    extensions: ['.dart'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'scala',
    name: 'Scala',
    extensions: ['.scala'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'vue',
    name: 'Vue',
    extensions: ['.vue'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'svelte',
    name: 'Svelte',
    extensions: ['.svelte'],
    parser: 'import-regex',
    graphImports: true
  },
  {
    id: 'css',
    name: 'CSS / SCSS',
    extensions: ['.css', '.scss', '.less'],
    parser: 'monaco-only',
    graphImports: false
  },
  {
    id: 'html',
    name: 'HTML',
    extensions: ['.html', '.htm'],
    parser: 'monaco-only',
    graphImports: false
  },
  {
    id: 'json',
    name: 'JSON',
    extensions: ['.json'],
    parser: 'monaco-only',
    graphImports: false
  }
]

export const APP_VERSION = '0.1.0'
export const APP_NAME = 'PreBase'
