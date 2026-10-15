import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import ts from 'typescript'

// Render actual components without a dev server or browser.
const sourceRoot = new URL('../../src/', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context) } catch (error) {
      if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.')) {
        for (const extension of ['.tsx', '.ts']) { try { return next(specifier + extension, context) } catch { /* Try the other source extension. */ } }
      }
      throw error
    }
  },
  load(url, context, next) {
    if (url.startsWith(sourceRoot)) {
      if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }
      if (url.endsWith('.json')) return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true }
      if (url.endsWith('.tsx')) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText, shortCircuit: true }
    }
    return next(url, context)
  },
})
