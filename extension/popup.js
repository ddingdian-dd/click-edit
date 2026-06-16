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

// 探测页面真实状态：编辑器是否真的在运行（而非依赖 storage 缓存）
async function probeRunning(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => !!window.__CLICK_EDIT__
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
    func: () => !!window.__CLICK_EDIT__
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
  } catch (err) {
    status.textContent = err.message
    status.style.color = '#f54a45'
    return
  }

  updateUI()
})

updateUI()
