import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(__dirname, '..')

function serveSourceFile(req, res, next) {
  const url = req.url?.split('?')[0] || ''
  if (!url.startsWith('/__visual-page-editor/')) {
    next()
    return
  }

  const relativePath = url.replace('/__visual-page-editor/', '')
  const filePath = path.resolve(srcRoot, relativePath)

  if (!filePath.startsWith(srcRoot) || !filePath.endsWith('.mjs') || !fs.existsSync(filePath)) {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
  res.end(fs.readFileSync(filePath, 'utf8'))
}

export function visualPageEditorVitePlugin(options = {}) {
  return {
    name: 'visual-page-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(serveSourceFile)
    },
    transformIndexHtml(html) {
      if (options.enabled === false) return html
      return {
        html,
        tags: [
          {
            tag: 'script',
            children: 'import { initVisualEditor } from "/__visual-page-editor/runtime/overlay.mjs"; initVisualEditor();',
            attrs: { type: 'module' },
            injectTo: 'body',
          },
        ],
      }
    },
  }
}

export default visualPageEditorVitePlugin
