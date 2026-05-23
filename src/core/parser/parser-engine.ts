import { readFile } from 'fs/promises'
import { parse, type ParserOptions } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule
import * as t from '@babel/types'
import type { ParseResult, ScannedFile } from '../types'

const PARSER_PLUGINS: ParserOptions['plugins'] = [
  'typescript',
  'jsx',
  'decorators-legacy',
  'classProperties',
  'dynamicImport',
  'importMeta',
  'topLevelAwait'
]

export class ParserEngine {
  async parseFile(file: ScannedFile): Promise<ParseResult | null> {
    let content: string
    try {
      content = await readFile(file.absolutePath, 'utf-8')
    } catch {
      return null
    }

    if (content.length > 500_000) return null

    let ast: t.File
    try {
      ast = parse(content, {
        sourceType: 'module',
        plugins: PARSER_PLUGINS,
        errorRecovery: true
      })
    } catch {
      return this.fallbackRegexParse(file, content)
    }

    const imports: ParseResult['imports'] = []
    const exports: ParseResult['exports'] = []
    const functions: string[] = []
    const components: string[] = []
    let isComponentFile = file.extension === '.tsx' || file.extension === '.jsx'

    const extractDecl = (decl: t.Declaration) =>
      this.extractDeclarationNames(decl, exports, functions, components)
    const isComponentName = (name: string) => this.looksLikeComponent(name, file.extension)

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value
        const specifiers = path.node.specifiers.map((s) => {
          if (t.isImportDefaultSpecifier(s)) return 'default'
          if (t.isImportNamespaceSpecifier(s)) return '*'
          return s.local.name
        })
        imports.push({
          source,
          specifiers,
          isDefault: path.node.specifiers.some((s) => t.isImportDefaultSpecifier(s)),
          line: path.node.loc?.start.line
        })
      },
      ExportNamedDeclaration(path) {
        if (path.node.declaration) extractDecl(path.node.declaration)
        path.node.specifiers.forEach((s) => {
          if (t.isExportSpecifier(s) && t.isIdentifier(s.exported)) {
            exports.push({ name: s.exported.name })
          }
        })
      },
      ExportDefaultDeclaration(path) {
        const name =
          t.isIdentifier(path.node.declaration)
            ? path.node.declaration.name
            : t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id
              ? path.node.declaration.id.name
              : 'default'
        exports.push({ name, isDefault: true })
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          if (isComponentName(path.node.declaration.id.name)) {
            components.push(path.node.declaration.id.name)
          }
        }
      },
      ExportAllDeclaration(path) {
        exports.push({ name: `* from ${path.node.source?.value ?? ''}` })
      },
      FunctionDeclaration(path) {
        if (path.node.id?.name) {
          functions.push(path.node.id.name)
          if (isComponentName(path.node.id.name)) components.push(path.node.id.name)
        }
      },
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && path.node.init) {
          const name = path.node.id.name
          if (
            t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init)
          ) {
            functions.push(name)
            if (isComponentName(name)) {
              components.push(name)
              isComponentFile = true
            }
          }
        }
      },
      CallExpression(path) {
        if (
          t.isIdentifier(path.node.callee, { name: 'require' }) &&
          path.node.arguments[0] &&
          t.isStringLiteral(path.node.arguments[0])
        ) {
          imports.push({
            source: path.node.arguments[0].value,
            specifiers: ['require']
          })
        }
      }
    })

    return {
      filePath: file.absolutePath,
      relativePath: file.relativePath,
      imports,
      exports,
      functions,
      components,
      isComponentFile: isComponentFile || components.length > 0
    }
  }

  async parseFiles(files: ScannedFile[]): Promise<ParseResult[]> {
    const results: ParseResult[] = []
    const batchSize = 20

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const parsed = await Promise.all(batch.map((f) => this.parseFile(f)))
      for (const p of parsed) {
        if (p) results.push(p)
      }
    }

    return results
  }

  private extractDeclarationNames(
    decl: t.Declaration,
    exports: ParseResult['exports'],
    functions: string[],
    components: string[]
  ): void {
    if (t.isFunctionDeclaration(decl) && decl.id) {
      exports.push({ name: decl.id.name })
      functions.push(decl.id.name)
    } else if (t.isVariableDeclaration(decl)) {
      decl.declarations.forEach((d) => {
        if (t.isIdentifier(d.id)) exports.push({ name: d.id.name })
      })
    } else if (t.isClassDeclaration(decl) && decl.id) {
      exports.push({ name: decl.id.name })
    } else if (t.isTSInterfaceDeclaration(decl)) {
      exports.push({ name: decl.id.name, isType: true })
    } else if (t.isTSTypeAliasDeclaration(decl)) {
      exports.push({ name: decl.id.name, isType: true })
    }
  }

  private looksLikeComponent(name: string, ext: string): boolean {
    if (ext === '.tsx' || ext === '.jsx') return /^[A-Z]/.test(name)
    return false
  }

  private fallbackRegexParse(file: ScannedFile, content: string): ParseResult {
    const imports: ParseResult['imports'] = []
    const importRe =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = importRe.exec(content)) !== null) {
      imports.push({ source: m[1], specifiers: [] })
    }

    return {
      filePath: file.absolutePath,
      relativePath: file.relativePath,
      imports,
      exports: [],
      functions: [],
      components: [],
      isComponentFile: file.extension === '.tsx' || file.extension === '.jsx'
    }
  }
}
