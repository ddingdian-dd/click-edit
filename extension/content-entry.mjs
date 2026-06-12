import { initClickEdit } from '../src/runtime/overlay.mjs'

console.log('[Click-Edit] content script loaded, initializing...')
if (!window.__CLICK_EDIT__) {
  try {
    initClickEdit({ enabled: true })
    console.log('[Click-Edit] editor initialized successfully')
  } catch (err) {
    console.error('[Click-Edit] init failed:', err)
  }
}
