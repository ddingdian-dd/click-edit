chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return

  const result = await chrome.storage.session.get(`vpe_${tabId}`)
  if (!result[`vpe_${tabId}`]) return

  try {
    const res = await fetch(chrome.runtime.getURL('content.js'))
    const code = await res.text()
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (script) => {
        if (window.__VISUAL_PAGE_EDITOR__) return
        const el = document.createElement('script')
        el.textContent = script
        document.documentElement.appendChild(el)
        el.remove()
      },
      args: [code]
    })
  } catch {}
})
