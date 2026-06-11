import assert from 'node:assert/strict'
import { buildCssOverrides, buildPatch, normalizeEdits } from '../src/cli/patcher.mjs'

const edits = normalizeEdits({
  edits: [
    {
      path: '/',
      selector: '[data-vpe-id="hero"]',
      label: 'Hero',
      command: '底色改为纯白色',
      style: { backgroundColor: '#ffffff', boxShadow: 'none' },
    },
  ],
})

const css = buildCssOverrides(edits)
assert.match(css, /\[data-vpe-id="hero"\]/)
assert.match(css, /background-color: #ffffff;/)
assert.match(css, /box-shadow: none;/)

const { patch } = buildPatch({
  root: new URL('..', import.meta.url).pathname,
  edits,
  cssFile: 'src/visual-editor-overrides.css',
})
assert.match(patch, /diff --git a\/src\/visual-editor-overrides\.css/)
assert.match(patch, /\+  background-color: #ffffff;/)

console.log('patcher passed')
