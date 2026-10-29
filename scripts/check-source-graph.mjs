import { readdir, readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve('src')
async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? collect(join(directory, entry.name)) : join(directory, entry.name)))).flat()
}
const files = (await collect(root)).filter(file => /\.(?:tsx?|css|json)$/.test(file))
const sources = new Set(files)
const reached = new Set()
async function visit(file) {
  if (!sources.has(file) || reached.has(file)) return
  reached.add(file)
  const text = await readFile(file, 'utf8')
  const imports = []
  if (/\.tsx?$/.test(file)) {
    const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const scan = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text)
      // Local import types are source dependencies too, even when erased from JS.
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text)
      ts.forEachChild(node, scan)
    }
    scan(parsed)
  } else if (extname(file) === '.css') {
    for (const match of text.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)) imports.push(match[1])
  }
  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue
    const base = resolve(dirname(file), specifier.split('?')[0])
    const target = [base, ...['.tsx', '.ts', '.js', '.css', '.json'].map(extension => base + extension), join(base, 'index.ts'), join(base, 'index.tsx')].find(candidate => sources.has(candidate) || existsSync(candidate) && statSync(candidate).isFile())
    if (!target) throw Error(`Missing local import: ${relative(root, file)} → ${specifier}`)
    await visit(target)
  }
}
await visit(join(root, 'main.tsx'))
const unused = files.filter(file => !reached.has(file))
if (unused.length) throw Error(`App-unreachable source files (tests do not count as app usage):\n${unused.map(file => relative(root, file)).sort().join('\n')}`)
console.log(`Source graph: ${reached.size} app-reachable TS/TSX/CSS/JSON files; no unused source files`)
