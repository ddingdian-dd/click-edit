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
