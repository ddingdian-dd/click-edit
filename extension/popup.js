const btn = document.getElementById('toggle')
const status = document.getElementById('status')

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

// 浏览器特权页面无法注入脚本（扩展页、设置页、商店页等）
function isRestrictedUrl(url) {
  if (!url) return true
  return /^(atlas|chrome|edge|brave|about|view-source|chrome-extension|moz-extension|devtools):/i.test(url) ||
    /^https?:\/\/chromewebstore\.google\.com\//i.test(url) ||
    /^https?:\/\/chrome\.google\.com\/webstore\//i.test(url)
}

// 探测页面真实状态：编辑器面板是否真的活着。
// 不能只看 window.__CLICK_EDIT__ 标记——重载扩展不会刷新已打开页面，
// 旧标记会残留但面板 DOM 已失效，导致 popup 误判为"运行中"却打不开。
// 以面板节点真实挂在文档上为准（isAlive），标记残留时返回 false 触发重建。
async function probeRunning(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const api = window.__CLICK_EDIT__
        if (!api) return false
        // 旧版本无 isAlive：用节点存在性兜底
        if (typeof api.isAlive === 'function') return api.isAlive()
        return !!document.getElementById('click-edit-root')
      }
    })
    return !!result
  } catch {
    return false
  }
}

async function updateUI() {
  const tab = await getTab()

  if (isRestrictedUrl(tab.url)) {
    btn.textContent = '启用编辑器'
    btn.className = 'btn'
    btn.disabled = true
    status.textContent = '此页面受浏览器保护，无法启用编辑器。请在普通网页中使用。'
    status.style.color = '#8f959e'
    return
  }

  btn.disabled = false
  const enabled = await probeRunning(tab.id)
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
    func: () => {
      const api = window.__CLICK_EDIT__
      if (!api) return false
      if (typeof api.isAlive === 'function') return api.isAlive()
      return !!document.getElementById('click-edit-root')
    }
  })
  if (!result) {
    throw new Error('编辑器注入失败，请检查页面是否有 CSP 限制')
  }
}

btn.addEventListener('click', async () => {
  const tab = await getTab()
  if (isRestrictedUrl(tab.url)) return

  const enabled = await probeRunning(tab.id)
  const newState = !enabled

  try {
    if (newState) {
      await injectEditor(tab.id)
      // 标记此 tab 已启用：background 在页面刷新（onUpdated complete）后据此自动重注入。
      // 缺这一步会导致刷新后编辑器不恢复。
      await chrome.storage.session.set({ [`ce_${tab.id}`]: true })
      const domain = new URL(tab.url || '').hostname || ''
      chrome.runtime.sendMessage({ type: 'ce_ping', domain })
    } else {
      // 清除标记，避免刷新后又被 background 自动注入。
      await chrome.storage.session.remove(`ce_${tab.id}`)
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
  } catch (err) {
    status.textContent = err.message
    status.style.color = '#f54a45'
    return
  }

  updateUI()
})

updateUI()
