const btn = document.getElementById('toggle')
const status = document.getElementById('status')

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function getState(tabId) {
  const result = await chrome.storage.session.get(`vpe_${tabId}`)
  return result[`vpe_${tabId}`] || false
}

async function setState(tabId, enabled) {
  await chrome.storage.session.set({ [`vpe_${tabId}`]: enabled })
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
}

btn.addEventListener('click', async () => {
  const tab = await getTab()
  const enabled = await getState(tab.id)
  const newState = !enabled

  try {
    if (newState) {
      await injectEditor(tab.id)
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          if (window.__VISUAL_PAGE_EDITOR__) {
            window.__VISUAL_PAGE_EDITOR__.destroy()
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
