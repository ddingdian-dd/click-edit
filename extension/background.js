// 留空 = 禁用匿名埋点。如未来需要重新启用，填回 Google Apps Script 等可接收 GET 的 URL 即可。
const PING_URL = ''

async function getOrCreateUid() {
  const result = await chrome.storage.local.get('ce_uid')
  if (result.ce_uid) return result.ce_uid
  const uid = crypto.randomUUID()
  await chrome.storage.local.set({ ce_uid: uid })
  return uid
}

async function ping(domain) {
  if (!PING_URL || PING_URL.startsWith('__')) return
  try {
    const uid = await getOrCreateUid()
    const version = chrome.runtime.getManifest().version
    const params = new URLSearchParams({ uid, v: version, d: domain })
    // 网络/CORS/被墙都直接吞掉——这是非关键的匿名统计，不能影响主流程
    fetch(`${PING_URL}?${params}`).catch(() => {})
  } catch {}
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ce_ping') {
    ping(msg.domain || '')
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return

  const result = await chrome.storage.session.get(`ce_${tabId}`)
  if (!result[`ce_${tabId}`]) return

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['content.js']
    })
  } catch {}
})

// tab 关闭后清掉它的启用标记，否则 Chrome 复用 tabId 时，
// 新页面会被误判为「已启用」而自动注入编辑器。
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`ce_${tabId}`).catch(() => {})
})
