import { initClickEdit } from '../src/runtime/overlay.mjs'

console.log('[Click-Edit] content script loaded, initializing...')
// 无条件调用：标记残留但面板已失效时，initClickEdit 内部用 isAlive 判断，
// 自动销毁残留实例并重建。若加 if (!window.__CLICK_EDIT__) 守卫，残留标记会挡住重建，卡死在"已运行但无界面"。
try {
  initClickEdit({ enabled: true })
  console.log('[Click-Edit] editor initialized successfully')
} catch (err) {
  console.error('[Click-Edit] init failed:', err)
}
