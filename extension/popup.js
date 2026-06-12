const btn = document.getElementById('toggle')
const status = document.getElementById('status')

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function getState(tabId) {
  const result = await chrome.storage.session.get(`ce_${tabId}`)
  return result[`ce_${tabId}`] || false
}

async function setState(tabId, enabled) {
  await chrome.storage.session.set({ [`ce_${tabId}`]: enabled })
}

async function updateUI() {
  const tab = await getTab()
  const enabled = await getState(tab.id)
  btn.textContent = enabled ? '停用编辑器' : '启用编辑器'
  btn.className = enabled ? 'btn btn--off' : 'btn'
  status.textContent = enabled ? '编辑器已在当前页面运行' : ''
  status.style.color = '#8f959e'
}

async function injectEditor(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: ['content.js']
  })
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => !!window.__CLICK_EDIT__
  })
  if (!result) {
    throw new Error('编辑器注入失败，请检查页面是否有 CSP 限制')
  }
}

btn.addEventListener('click', async () => {
  const tab = await getTab()
  const enabled = await getState(tab.id)
  const newState = !enabled

  try {
    if (newState) {
      await injectEditor(tab.id)
      const domain = new URL(tab.url || '').hostname || ''
      chrome.runtime.sendMessage({ type: 'ce_ping', domain })
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          if (window.__CLICK_EDIT__) {
            window.__CLICK_EDIT__.destroy()
          }
        }
      })
    }
    await setState(tab.id, newState)
  } catch (err) {
    status.textContent = err.message
    status.style.color = '#f54a45'
    return
  }

  updateUI()
})

updateUI()
