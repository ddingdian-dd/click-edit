import { initVisualEditor } from '../src/runtime/overlay.mjs'

console.log('[VPE] content script loaded, initializing...')
if (!window.__VISUAL_PAGE_EDITOR__) {
  try {
    initVisualEditor({ enabled: true })
    console.log('[VPE] editor initialized successfully')
  } catch (err) {
    console.error('[VPE] init failed:', err)
  }
}
