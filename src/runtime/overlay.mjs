import { hasLayoutIntent, hasPageSizeIntent, isParsedCommandEmpty, parseVisualCommand } from '../core/commands.mjs'
import { applyEdit, createEditRecord, readStoredEdits, readStoredEditsForPath, saveEdit, STORAGE_KEY, undoLastEdit, undoToEdit } from '../core/edits.mjs'
import { getElementLabel } from '../core/selectors.mjs'
import { renderPropertiesPanel, getPropertiesPanelStyles } from './properties-panel.mjs'
import { llmParseCommand, getApiKey, setApiKey } from '../core/llm-command.mjs'
import { trackUnrecognized, getPendingCount, autoReport } from '../core/analytics.mjs'

const ROOT_ID = 'click-edit-root'
const HOVER_OUTLINE_ID = 'click-edit-hover-outline'
const SELECTED_OUTLINE_ID = 'click-edit-selected-outline'
const SAVE_SERVER = 'http://localhost:17532/save'

function saveHtmlToFile() {
  if (!window.location.href.startsWith('file://')) return
  const clone = document.documentElement.cloneNode(true)
  const editorRoot = clone.querySelector(`#${ROOT_ID}`)
  if (editorRoot) editorRoot.remove()
  clone.querySelectorAll(`#${HOVER_OUTLINE_ID}, #${SELECTED_OUTLINE_ID}`).forEach(el => el.remove())
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'))
  const html = '<!DOCTYPE html>\n' + clone.outerHTML
  fetch(SAVE_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: window.location.href, html })
  }).catch(() => {})
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest(`#${ROOT_ID}`)) return false
  if (['HTML', 'BODY', 'SCRIPT', 'STYLE'].includes(target.tagName)) return false
  return true
}

function getLayoutTarget(element, command) {
  if (hasPageSizeIntent(command)) {
    return element.closest('main') || document.querySelector('main') || document.body.firstElementChild || element
  }

  if (!element.children.length) {
    return element.closest('section, article, main') || element.closest('div') || element
  }

  return element
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function copyText(text) {
  if (!navigator.clipboard) return Promise.reject(new Error('Clipboard is unavailable'))
  return navigator.clipboard.writeText(text)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatHistoryTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}

function toCssPropertyName(key) {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

function createOutline({ id, border, shadow, zIndex }) {
  const outline = document.createElement('div')
  outline.id = id
  outline.style.cssText = [
    'position:fixed',
    `z-index:${zIndex}`,
    'pointer-events:none',
    border,
    shadow,
    'border-radius:8px',
    'display:none',
  ].join(';')
  document.body.appendChild(outline)
  return outline
}

function updateOutline(outline, element) {
  if (!element) {
    outline.style.display = 'none'
    return
  }

  const rect = element.getBoundingClientRect()
  outline.style.display = 'block'
  outline.style.left = `${rect.left}px`
  outline.style.top = `${rect.top}px`
  outline.style.width = `${rect.width}px`
  outline.style.height = `${rect.height}px`
}

function renderPanel(shadow, state) {
  const history = readStoredEditsForPath()
  const recentHistory = history.slice(-5).reverse()
  const propertiesHtml = state.activeTab === 'properties' ? renderPropertiesPanel(state.selected, state.expandedGroups) : ''

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        width: min(420px, calc(100vw - 40px));
        color: #1f2329;
        background: rgba(255, 255, 255, .96);
        border: 1px solid #dee0e3;
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(31, 35, 41, .16);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .panel--collapsed {
        width: auto;
        border-radius: 50%;
        padding: 0;
      }
      .fab {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        cursor: pointer;
        background: #3370ff;
        border: 0;
        border-radius: 50%;
        color: #fff;
        font-size: 20px;
        box-shadow: 0 4px 16px rgba(51, 112, 255, .3);
      }
      .fab:hover { transform: scale(1.08); }
      .header { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid #eff0f3; }
      .title { font-size: 14px; font-weight: 700; }
      .status { margin-top: 4px; font-size: 12px; line-height: 1.45; color: #646a73; }
      .collapse-btn { border: 0; background: none; cursor: pointer; padding: 4px; color: #8f959e; font-size: 18px; line-height: 1; border-radius: 6px; }
      .collapse-btn:hover { background: #f0f1f5; color: #1f2329; }
      .body { display: ${state.enabled && !state.collapsed ? 'block' : 'none'}; }
      .selected { padding: 9px 16px; font-size: 12px; line-height: 1.45; color: #646a73; }

      .tabs { display: flex; gap: 4px; padding: 0 16px; margin-top: 8px; }
      .tab {
        flex: 1;
        border: 0;
        border-radius: 8px;
        padding: 8px 0;
        font: 600 12px/1 inherit;
        cursor: pointer;
        transition: background .15s, color .15s;
      }
      .tab--active { color: #fff; background: #3370ff; }
      .tab--inactive { color: #646a73; background: #f0f1f5; }

      .nlp-body { padding: 14px 16px 0; }
      textarea {
        display: block;
        width: 100%;
        min-height: 94px;
        resize: vertical;
        border: 1px solid #dee0e3;
        border-radius: 14px;
        padding: 11px 12px;
        font: 14px/1.5 inherit;
        color: #1f2329;
        outline: none;
      }
      textarea:focus { border-color: #3370ff; box-shadow: 0 0 0 3px rgba(51,112,255,.14); }
      .nlp-actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; padding-bottom: 14px; }
      .nlp-actions .spacer { flex: 1; }

      .footer { padding: 10px 16px 14px; border-top: 1px solid #eff0f3; margin-top: 8px; }
      .footer-actions { display: flex; gap: 8px; align-items: center; }
      .footer-actions .spacer { flex: 1; }
      .history { margin-top: 10px; }
      .history-list { display: grid; gap: 6px; max-height: 120px; overflow: auto; }
      .history-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 10px;
        background: #f6f6fb;
        color: #1f2329;
        font-size: 12px;
        line-height: 1.35;
      }
      .history-copy { min-width: 0; }
      .history-command { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .history-meta { margin-top: 3px; color: #8f959e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
      .empty-history { color: #8f959e; font-size: 12px; }

      .layer-picker { padding: 8px 16px 0; }
      .layer-picker-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .layer-picker-title { font: 600 12px/1.3 inherit; color: #646a73; flex: 1; }
      .layer-picker-back {
        display: inline-flex; align-items: center; gap: 2px;
        height: 24px; padding: 0 10px;
        border: 1px solid #d8dadf;
        border-radius: 999px;
        background: #fff;
        color: #1f2329;
        font: 500 12px/1 inherit;
        cursor: pointer;
        flex-shrink: 0;
      }
      .layer-picker-back:hover { background: #f6f6fb; border-color: #c1c4ca; }
      .layer-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; }
      .layer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: #f6f6fb;
        cursor: pointer;
        transition: background .1s;
      }
      .layer-item:hover { background: #e8efff; box-shadow: inset 0 0 0 1px #3370ff; }
      .layer-item--depth {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        background: #3370ff;
        color: #fff;
        font: 700 11px/24px inherit;
        text-align: center;
        flex-shrink: 0;
      }
      .layer-item--info { min-width: 0; flex: 1; }
      .layer-item--tag { font: 600 12px/1.3 monospace; color: #1f2329; }
      .layer-item--text { font-size: 12px; line-height: 1.4; color: #8f959e; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .layer-item--size { font-size: 12px; line-height: 1; color: #b0b3b8; white-space: nowrap; flex-shrink: 0; }

      button {
        border: 0;
        border-radius: 999px;
        padding: 9px 14px;
        font: 600 13px/1 inherit;
        cursor: pointer;
      }
      .primary { color: #fff; background: #3370ff; }
      .secondary { color: #1f2329; background: #f0f1f5; }
      .mini { padding: 8px 11px; font-size: 12px; }

      ${getPropertiesPanelStyles()}
    </style>
    <section class="panel ${state.collapsed ? 'panel--collapsed' : ''}">
      ${state.collapsed ? `
        <button class="fab" data-action="expand" title="展开编辑器">&#9998;</button>
      ` : `
      <div class="header">
        <div>
          <div class="title">Click-Edit</div>
          <div class="status">${state.status}</div>
        </div>
        <button class="collapse-btn" data-action="collapse" title="收起">&times;</button>
      </div>`}
      <div class="body">
        ${state.layerCandidates ? `
          <div class="layer-picker">
            <div class="layer-picker-header">
              <button class="layer-picker-back" data-action="cancel-layer-pick" title="返回（Esc）">返回</button>
              <div class="layer-picker-title">点击位置有 ${state.layerCandidates.length} 个图层（从上到下）</div>
            </div>
            <div class="layer-list">
              ${state.layerCandidates.map((el, i) => {
                const tag = el.tagName.toLowerCase()
                const cls = el.className ? '.' + el.className.toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''
                const id = el.id ? '#' + el.id : ''
                const text = el.innerText?.trim().replace(/\s+/g, ' ').slice(0, 50) || ''
                const rect = el.getBoundingClientRect()
                const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`
                return `
                  <div class="layer-item" data-action="pick-layer" data-layer-index="${i}">
                    <div class="layer-item--depth">${i + 1}</div>
                    <div class="layer-item--info">
                      <div class="layer-item--tag">${escapeHtml(tag + id + cls)}</div>
                      ${text ? `<div class="layer-item--text">${escapeHtml(text)}</div>` : ''}
                    </div>
                    <div class="layer-item--size">${size}</div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        ` : `
        <div class="tabs">
          <button class="tab ${state.activeTab === 'properties' ? 'tab--active' : 'tab--inactive'}" data-action="tab-properties">属性面板</button>
          <button class="tab ${state.activeTab === 'nlp' ? 'tab--active' : 'tab--inactive'}" data-action="tab-nlp">快捷输入</button>
        </div>
        ${state.activeTab === 'properties' ? propertiesHtml : ''}
        ${state.activeTab === 'nlp' ? `
          <div class="nlp-body">
            <textarea placeholder="任意描述修改，如：底色改为纯白色；字号放大到20px；增加一个按钮；删除这个元素"></textarea>
            <div class="nlp-actions">
              <span class="spacer"></span>
              <button class="secondary" data-action="apply">应用修改</button>
              <button class="primary" data-action="save-html">保存</button>
            </div>
          </div>
        ` : ''}
        ${history.length ? `
          <div class="footer">
            <div class="footer-actions">
              <span style="font-size:11px;color:#8f959e;">记录 ${history.length}</span>
              <span class="spacer"></span>
              <button class="secondary mini" data-action="reset">重置</button>
              <button class="secondary mini" data-action="export">导出</button>
            </div>
            <div class="history">
              <div class="history-list">${recentHistory.map((item, index) => `
                <div class="history-item">
                  <div class="history-copy">
                    <div class="history-command" title="${escapeHtml(item.command || '未命名修改')}">${escapeHtml(item.command || '未命名修改')}</div>
                    <div class="history-meta">${escapeHtml([index === 0 ? '最新' : formatHistoryTime(item.createdAt), item.label].filter(Boolean).join(' · '))}</div>
                  </div>
                  <button class="secondary mini" data-action="rollback" data-edit-id="${escapeHtml(item.id)}">回退</button>
                </div>
              `).join('')}</div>
            </div>
          </div>
        ` : ''}
        `}
      </div>
    </section>
  `
}

export function initClickEdit(options = {}) {
  if (typeof window === 'undefined') return undefined
  if (window.__CLICK_EDIT__) return window.__CLICK_EDIT__

  const root = document.createElement('div')
  root.id = ROOT_ID
  const shadow = root.attachShadow({ mode: 'open' })
  document.body.appendChild(root)

  const hoverOutline = createOutline({
    id: HOVER_OUTLINE_ID,
    border: 'border:1px dashed rgba(51,112,255,.82)',
    shadow: 'box-shadow:0 0 0 3px rgba(51,112,255,.08)',
    zIndex: 2147483645,
  })
  const selectedOutline = createOutline({
    id: SELECTED_OUTLINE_ID,
    border: 'border:2px solid #3370ff',
    shadow: 'box-shadow:0 0 0 4px rgba(51,112,255,.14)',
    zIndex: 2147483646,
  })
  const state = {
    enabled: options.enabled ?? false,
    collapsed: false,
    hovered: null,
    selected: null,
    layerCandidates: null,
    status: '点击页面元素开始编辑。',
    activeTab: 'nlp',
    expandedGroups: new Set(['color']),
  }

  let previewProperty = null
  let editingElement = null
  let editingOriginalText = null

  function rerender() {
    renderPanel(shadow, state)
  }

  function setStatus(status) {
    state.status = status
    rerender()
  }

  function applyPropertyChange(property, value) {
    if (!state.selected) return
    const parsed = { style: { [property]: value } }
    const command = `${property}: ${value}`
    const record = createEditRecord({ element: state.selected, command, parsed })
    applyEdit(record)
    saveEdit(record)
    saveHtmlToFile()
    setStatus(`已修改：${property}`)
  }

  function handleToggleProperty(property, currentState) {
    if (!state.selected) return
    if (property === 'boxShadow') {
      const value = currentState === 'on' ? 'none' : '0 18px 48px rgba(31, 35, 41, 0.12)'
      applyPropertyChange(property, value)
    } else if (property === 'hidden') {
      const value = currentState === 'on' ? '' : 'none'
      applyPropertyChange('display', value)
    }
  }

  function handleNumberUnitChange(target) {
    const property = target.dataset.property
    const row = target.closest('.prop-number-wrap')
    if (!row || !property) return
    const numberInput = row.querySelector('.prop-number-input')
    const unitSelect = row.querySelector('.prop-unit-select')
    if (!numberInput) return
    const num = numberInput.value
    if (!num) return
    const unit = unitSelect?.value || 'px'
    applyPropertyChange(property, `${num}${unit}`)
  }

  function handleSpacingChange(target) {
    const property = target.dataset.property
    const value = target.value
    if (!property || !state.selected) return
    applyPropertyChange(property, value ? `${value}px` : '0px')
  }

  function onMouseMove(event) {
    if (!state.enabled) return
    state.hovered = isEditableTarget(event.target) ? event.target : null
    updateOutline(hoverOutline, state.hovered && state.hovered !== state.selected ? state.hovered : null)
    // 图层选择器期间，selectedOutline 由弹窗 mouseover 接管（橙色对照），不在这里覆盖
    if (state.layerCandidates) return
    updateOutline(selectedOutline, state.selected)
  }

  function commitTextEdit() {
    if (!editingElement) return
    const newText = editingElement.innerText.trim()
    editingElement.contentEditable = 'false'
    editingElement.style.outline = ''
    editingElement.style.cursor = ''
    editingElement.removeEventListener('blur', onEditBlur)
    editingElement.removeEventListener('keydown', onEditKeydown)

    if (newText !== editingOriginalText) {
      editingElement.innerText = editingOriginalText
      const parsed = { style: {}, text: newText }
      const command = `文案修改："${newText.slice(0, 30)}"`
      const record = createEditRecord({ element: editingElement, command, parsed })
      applyEdit(record)
      saveEdit(record)
    saveHtmlToFile()
      setStatus(`已保存文案修改`)
    }

    editingElement = null
    editingOriginalText = null
  }

  function onEditBlur() {
    setTimeout(() => commitTextEdit(), 0)
  }

  function onEditKeydown(event) {
    if (event.key === 'Escape') {
      editingElement.innerText = editingOriginalText
      commitTextEdit()
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      editingElement.blur()
    }
  }

  function onDblClick(event) {
    if (!state.enabled || !isEditableTarget(event.target)) return
    if (!isTextNode(event.target)) return
    event.preventDefault()
    event.stopPropagation()

    state.selected = event.target
    updateOutline(selectedOutline, event.target)
    startTextEdit(event.target)
  }

  function isTextNode(el) {
    if (!el || !el.childNodes) return false
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return true
    }
    return false
  }

  function startTextEdit(el) {
    if (editingElement) commitTextEdit()
    editingElement = el
    editingOriginalText = el.innerText.trim()
    el.contentEditable = 'true'
    el.style.outline = '2px solid #3370ff'
    el.style.cursor = 'text'
    el.focus()

    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)

    el.addEventListener('blur', onEditBlur)
    el.addEventListener('keydown', onEditKeydown)

    state.status = '编辑文字中… 点击别处保存，Esc 取消'
    rerender()
  }

  function selectElement(el) {
    state.selected = el
    state.layerCandidates = null
    state.status = `已选中：${getElementLabel(el)}`
    updateOutline(hoverOutline, null)
    updateOutline(selectedOutline, state.selected)
    rerender()
  }

  function getLayerCandidates(x, y) {
    const elements = document.elementsFromPoint(x, y)
    return elements.filter(el => isEditableTarget(el))
  }

  function onClick(event) {
    if (!state.enabled || !isEditableTarget(event.target)) return
    event.preventDefault()
    event.stopPropagation()

    if (editingElement && editingElement !== event.target) {
      commitTextEdit()
    }

    if (state.selected === event.target && isTextNode(event.target) && !editingElement) {
      startTextEdit(event.target)
      return
    }

    const candidates = getLayerCandidates(event.clientX, event.clientY)

    if (candidates.length > 1) {
      state.layerCandidates = candidates
      state.status = `检测到 ${candidates.length} 个重叠图层，请在面板中选择`
      updateOutline(hoverOutline, null)
      updateOutline(selectedOutline, null)
      rerender()
      return
    }

    selectElement(event.target)
  }

  function applyCommand() {
    const textarea = shadow.querySelector('textarea')
    const command = textarea?.value?.trim()
    return applyCommandToElement(state.selected, command)
  }

  function getElementContext(element) {
    const cs = window.getComputedStyle(element)
    const props = ['display','padding','margin','fontSize','color','backgroundColor','borderRadius']
    const styles = props.map(p => `${p}:${cs.getPropertyValue(p.replace(/[A-Z]/g, l => '-' + l.toLowerCase()))}`).join('; ')
    return {
      tag: element.tagName.toLowerCase(),
      text: element.innerText?.slice(0, 100),
      currentStyle: styles
    }
  }

  async function applyCommandToElement(element, command) {
    if (!element) {
      setStatus('请先点击选中页面元素。')
      return undefined
    }
    if (!command) return undefined

    const target = hasLayoutIntent(command) ? getLayoutTarget(element, command) : element
    let parsed = parseVisualCommand(command)

    if (isParsedCommandEmpty(parsed)) {
      setStatus('AI 理解中…')
      rerender()
      const llmResult = await llmParseCommand(command, getElementContext(target))
      if (!llmResult || isParsedCommandEmpty(llmResult)) {
        trackUnrecognized(command, getElementContext(target))
        setStatus('未能理解指令，请换种方式描述。')
        return undefined
      }
      parsed = llmResult
    }

    const record = createEditRecord({ element: target, command, parsed })
    applyEdit(record)
    saveEdit(record)
    saveHtmlToFile()
    state.selected = target
    updateOutline(selectedOutline, state.selected)
    setStatus(`已应用：${command}`)
    return record
  }

  function exportHtml() {
    const clone = document.documentElement.cloneNode(true)
    const editorRoot = clone.querySelector(`#${ROOT_ID}`)
    if (editorRoot) editorRoot.remove()
    const hoverEl = clone.querySelector(`#${HOVER_OUTLINE_ID}`)
    if (hoverEl) hoverEl.remove()
    const selectedEl = clone.querySelector(`#${SELECTED_OUTLINE_ID}`)
    if (selectedEl) selectedEl.remove()
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'))

    const html = '<!DOCTYPE html>\n' + clone.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const pageName = document.title || 'page'
    link.download = `${pageName}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setStatus('已导出修改后的 HTML 文件。')
  }

  async function saveHtmlDirect() {
    if (!window.location.href.startsWith('file://')) {
      setStatus('保存仅支持本地 file:// 页面。')
      return
    }
    const clone = document.documentElement.cloneNode(true)
    const editorRoot = clone.querySelector(`#${ROOT_ID}`)
    if (editorRoot) editorRoot.remove()
    clone.querySelectorAll(`#${HOVER_OUTLINE_ID}, #${SELECTED_OUTLINE_ID}`).forEach(el => el.remove())
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'))
    const html = '<!DOCTYPE html>\n' + clone.outerHTML

    try {
      const res = await fetch(SAVE_SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: window.location.href, html })
      })
      if (res.ok) {
        setStatus('已保存到文件。')
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus(`保存失败：${data.error || res.statusText}`)
      }
    } catch {
      setStatus('保存失败：请先运行 npm run save-server')
    }
  }

  function undoEdit() {
    const record = undoLastEdit()
    if (!record) {
      setStatus('没有可撤销的修改。')
      return undefined
    }
    setStatus(`已撤销：${record.command || record.label || '上一条修改'}`)
    return record
  }

  function rollbackEdit(editId) {
    const records = undoToEdit(editId)
    if (!records.length) {
      setStatus('无法回退这条记录，请确认元素仍在当前页面。')
      return []
    }
    setStatus(`已回退 ${records.length} 条修改。`)
    return records
  }

  function resetEdits() {
    window.localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  shadow.addEventListener('click', event => {
    const trigger = event.target?.closest?.('[data-action]')
    const action = trigger?.getAttribute?.('data-action')

    if (action === 'collapse') { state.collapsed = true; rerender(); return }
    if (action === 'expand') { state.collapsed = false; rerender(); return }
    if (action === 'toggle') {
      state.enabled = !state.enabled
      if (!state.enabled) {
        state.hovered = null
        state.selected = null
        updateOutline(hoverOutline, null)
        updateOutline(selectedOutline, null)
      }
      state.status = state.enabled ? '编辑模式已打开，点击页面元素。' : '打开编辑模式后，点击页面元素。'
      rerender()
      return
    }
    if (action === 'tab-properties') { state.activeTab = 'properties'; rerender(); return }
    if (action === 'tab-nlp') { state.activeTab = 'nlp'; rerender(); return }
    if (action === 'apply') { applyCommand(); return }
    if (action === 'undo') { undoEdit(); return }
    if (action === 'rollback') { rollbackEdit(trigger.getAttribute('data-edit-id')); return }
    if (action === 'export') { exportHtml(); return }
    if (action === 'save-html') { saveHtmlDirect(); return }
    if (action === 'reset') { resetEdits(); return }
    if (action === 'pick-layer') {
      const idx = parseInt(trigger.getAttribute('data-layer-index'), 10)
      const el = state.layerCandidates?.[idx]
      if (el) selectElement(el)
      return
    }
    if (action === 'cancel-layer-pick') {
      state.layerCandidates = null
      state.status = '已取消选择，点击页面元素重新选取。'
      rerender()
      return
    }

    // group fold/unfold
    const groupHeader = event.target?.closest?.('.group-header')
    if (groupHeader) {
      const key = groupHeader.dataset.group
      if (state.expandedGroups.has(key)) {
        state.expandedGroups.delete(key)
      } else {
        state.expandedGroups.add(key)
      }
      rerender()
      return
    }

    // toggle button
    const toggleBtn = event.target?.closest?.('.prop-toggle')
    if (toggleBtn) {
      handleToggleProperty(toggleBtn.dataset.property, toggleBtn.dataset.toggle)
      return
    }

    // button group
    const btnGroup = event.target?.closest?.('.prop-btn')
    if (btnGroup) {
      applyPropertyChange(btnGroup.dataset.property, btnGroup.dataset.value)
      return
    }
  })

  shadow.addEventListener('mouseover', event => {
    const layerItem = event.target?.closest?.('.layer-item')
    if (layerItem && state.layerCandidates) {
      const idx = parseInt(layerItem.getAttribute('data-layer-index'), 10)
      const el = state.layerCandidates[idx]
      if (el) {
        // 用橙色高亮，比品牌蓝在多种背景上都更醒目
        selectedOutline.style.border = '2px solid #ff7d00'
        selectedOutline.style.boxShadow = '0 0 0 4px rgba(255,125,0,.18)'
        updateOutline(selectedOutline, el)
      }
    }
  })

  shadow.addEventListener('mouseout', event => {
    const layerItem = event.target?.closest?.('.layer-item')
    if (layerItem && state.layerCandidates) {
      // 离开候选项后清空 outline，并把样式恢复回品牌蓝（默认选中态用）
      selectedOutline.style.border = '2px solid #3370ff'
      selectedOutline.style.boxShadow = '0 0 0 4px rgba(51,112,255,.14)'
      updateOutline(selectedOutline, state.selected)
    }
  })

  // 实时预览：input 事件直接操作 DOM style，不产生记录
  shadow.addEventListener('input', event => {
    const target = event.target
    if (!state.selected) return

    if (target.type === 'color' && target.dataset.property) {
      state.selected.style.setProperty(toCssPropertyName(target.dataset.property), target.value)
      const row = target.closest('.prop-color-wrap')
      const hexInput = row?.querySelector('.prop-hex-input')
      if (hexInput) hexInput.value = target.value
      previewProperty = target.dataset.property
      return
    }

    if (target.type === 'range' && target.dataset.property) {
      state.selected.style.setProperty(toCssPropertyName(target.dataset.property), target.value)
      const valueSpan = target.closest('.prop-range-wrap')?.querySelector('.prop-range-value')
      if (valueSpan) valueSpan.textContent = target.value
      previewProperty = target.dataset.property
      return
    }

    if (target.classList.contains('spacing-input') && target.dataset.property) {
      const value = target.value ? `${target.value}px` : '0px'
      state.selected.style.setProperty(toCssPropertyName(target.dataset.property), value)
      previewProperty = target.dataset.property
      return
    }

    if (target.dataset.type === 'number-unit' || target.dataset.role === 'unit') {
      const property = target.dataset.property
      const row = target.closest('.prop-number-wrap')
      if (!row || !property) return
      const numberInput = row.querySelector('.prop-number-input')
      const unitSelect = row.querySelector('.prop-unit-select')
      const num = numberInput?.value
      if (num) {
        const unit = unitSelect?.value || 'px'
        state.selected.style.setProperty(toCssPropertyName(property), `${num}${unit}`)
        previewProperty = property
      }
      return
    }
  })

  // 正式提交：change 事件产生 editRecord
  shadow.addEventListener('change', event => {
    const target = event.target
    if (!state.selected) return

    if (target.type === 'color' && target.dataset.property) {
      applyPropertyChange(target.dataset.property, target.value)
      previewProperty = null
      return
    }

    if (target.classList.contains('prop-hex-input') && target.dataset.property) {
      const value = target.value.trim()
      if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
        applyPropertyChange(target.dataset.property, value)
      }
      return
    }

    if (target.type === 'range' && target.dataset.property) {
      applyPropertyChange(target.dataset.property, target.value)
      previewProperty = null
      return
    }

    if (target.classList.contains('prop-select') && target.dataset.property) {
      applyPropertyChange(target.dataset.property, target.value)
      return
    }

    if (target.classList.contains('spacing-input') && target.dataset.property) {
      handleSpacingChange(target)
      previewProperty = null
      return
    }

    if (target.dataset.type === 'number-unit' || target.dataset.role === 'unit') {
      handleNumberUnitChange(target)
      previewProperty = null
      return
    }
  })

  shadow.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && event.target?.matches?.('textarea')) {
      event.preventDefault()
      const command = event.target.value?.trim()
      if (command && state.selected) {
        applyCommandToElement(state.selected, command)
      } else if (!state.selected) {
        setStatus('请先点击选中页面元素。')
      }
    }
  })

  function onGlobalKeydown(event) {
    if (event.key !== 'Escape') return
    if (state.layerCandidates) {
      event.preventDefault()
      state.layerCandidates = null
      state.status = '已取消选择，点击页面元素重新选取。'
      rerender()
    }
  }

  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('dblclick', onDblClick, true)
  document.addEventListener('keydown', onGlobalKeydown, true)

  readStoredEdits().forEach(record => applyEdit(record))
  rerender()

  const api = {
    destroy() {
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDblClick, true)
      document.removeEventListener('keydown', onGlobalKeydown, true)
      if (editingElement) commitTextEdit()
      root.remove()
      hoverOutline.remove()
      selectedOutline.remove()
      delete window.__CLICK_EDIT__
    },
    exportHtml: () => exportHtml(),
    history: () => readStoredEditsForPath(),
    applyToElement: (element, command) => applyCommandToElement(element, command),
    undo: () => undoEdit(),
    rollback: editId => rollbackEdit(editId),
  }

  window.__CLICK_EDIT__ = api
  return api
}
