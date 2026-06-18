import { hasLayoutIntent, hasPageSizeIntent, isParsedCommandEmpty, parseVisualCommand } from '../core/commands.mjs'
import { applyEdit, createEditRecord, markExported, readStoredEdits, readStoredEditsForPath, saveEdit, STORAGE_KEY, undoLastEdit, undoToEdit } from '../core/edits.mjs'
import { getElementLabel } from '../core/selectors.mjs'
import { renderPropertiesPanel, getPropertiesPanelStyles } from './properties-panel.mjs'
import { llmParseCommand, getApiKey, setApiKey } from '../core/llm-command.mjs'
import { trackUnrecognized, trackMisparsed, getPendingCount, autoReport } from '../core/analytics.mjs'

const ROOT_ID = 'click-edit-root'
const HOVER_OUTLINE_ID = 'click-edit-hover-outline'
const SELECTED_OUTLINE_ID = 'click-edit-selected-outline'
const SAVE_SERVER = 'http://localhost:17532/save'

// file:// 页面下尝试静默写回原文件；返回:
//   'saved'        — 写入成功
//   'unsupported'  — 非 file:// 页面，不需要写
//   'no-server'    — 是 file:// 但 save-server 没启动
async function saveHtmlToFile() {
  if (!window.location.href.startsWith('file://')) return 'unsupported'
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
    return res.ok ? 'saved' : 'no-server'
  } catch {
    return 'no-server'
  }
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
  const recentHistory = history.slice(-5).reverse() // 倒序：最新在前
  const newCount = history.filter(item => !item.exportedAt).length
  const exportedCount = history.length - newCount
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
      .history-item--exported { background: #fafbff; opacity: .85; }
      .history-item--exported .history-command::before {
        content: '已导出 · ';
        color: #3370ff;
        font-weight: 600;
      }
      .history-divider {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 4px 2px;
        font-size: 11px;
        color: #8f959e;
      }
      .history-divider::before,
      .history-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #eef0f3;
      }
      .empty-history { color: #8f959e; font-size: 12px; }

      button {
        border: 0;
        border-radius: 999px;
        padding: 9px 14px;
        font: 600 13px/1 inherit;
        cursor: pointer;
      }
      .primary { color: #fff; background: #3370ff; }
      .primary:disabled { background: #c9cdd4; cursor: not-allowed; opacity: 0.6; }
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
          <div class="status">${escapeHtml(state.status || '')}</div>
        </div>
        <button class="collapse-btn" data-action="collapse" title="收起">&times;</button>
      </div>`}
      <div class="body">
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
              <button class="primary" data-action="apply" title="回车 ↵ 也可触发" disabled>应用</button>
            </div>
          </div>
        ` : ''}
        ${history.length ? `
          <div class="footer">
            <div class="footer-actions">
              <span style="font-size:12px;color:#1f2329;font-weight:700;">修改记录 ${history.length}${newCount && exportedCount ? ` <span style="font-weight:400;color:#8f959e;">（新增 ${newCount} · 已导出 ${exportedCount}）</span>` : ''}</span>
              <span class="spacer"></span>
              <button class="secondary mini" data-action="reset">重置</button>
              <button class="secondary mini" data-action="export" title="导出修改项 Markdown，可直接给开发">导出修改项${newCount ? ` (${newCount})` : ''}</button>
            </div>
            <div class="history">
              <div class="history-list">${(() => {
                const blocks = []
                let lastExported = null
                recentHistory.forEach((item, index) => {
                  const isExported = !!item.exportedAt
                  // 若与上一条已导出/未导出状态切换，插入分割线
                  if (lastExported !== null && lastExported !== isExported) {
                    blocks.push(`<div class="history-divider">${isExported ? '已导出' : '本次新增'}</div>`)
                  }
                  lastExported = isExported
                  const meta = [index === 0 ? '最新' : formatHistoryTime(item.createdAt), item.label].filter(Boolean).join(' · ')
                  blocks.push(`
                    <div class="history-item ${isExported ? 'history-item--exported' : ''}">
                      <div class="history-copy">
                        <div class="history-command" title="${escapeHtml(item.command || '未命名修改')}">${escapeHtml(item.command || '未命名修改')}</div>
                        <div class="history-meta">${escapeHtml(meta)}</div>
                      </div>
                      <button class="secondary mini" data-action="rollback" data-edit-id="${escapeHtml(item.id)}">回退</button>
                    </div>
                  `)
                })
                return blocks.join('')
              })()}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </section>
  `
}

export function initClickEdit(options = {}) {
  if (typeof window === 'undefined') return undefined
  // 复用判断基准是「面板是否真实存活」，而非「标记是否存在」。
  // 标记 __CLICK_EDIT__ 挂在页面 MAIN world，重载扩展不会清它；
  // 若面板 DOM 已被冲掉/失效而标记残留，必须销毁残留实例后重建，否则会卡死在「已运行但无界面」。
  const existing = window.__CLICK_EDIT__
  if (existing) {
    if (typeof existing.isAlive === 'function' && existing.isAlive()) return existing
    try { existing.destroy() } catch {}
  }

  const root = document.createElement('div')
  root.id = ROOT_ID
  const shadow = root.attachShadow({ mode: 'open' })

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

  // 挂到 <html> 而非 <body>：SPA 框架（React/Vue）re-render 时会替换 body 子树，
  // 把注入节点冲掉，导致 window.__CLICK_EDIT__ 还在但面板消失。<html> 子树不受框架管理。
  const mountHost = document.documentElement
  function ensureMounted() {
    if (!root.isConnected) mountHost.appendChild(root)
    if (!hoverOutline.isConnected) mountHost.appendChild(hoverOutline)
    if (!selectedOutline.isConnected) mountHost.appendChild(selectedOutline)
  }
  ensureMounted()

  // 看门狗：万一节点仍被移除，监听 <html> 直接子节点变化并自愈重挂。
  // 只看直接子节点（root/outline 都是 <html> 的直接子节点，body 被替换也是直接子节点变化），
  // 不用 subtree，避免 SPA 频繁 DOM 变更带来的性能开销与回调风暴。
  const mountObserver = new MutationObserver(() => ensureMounted())
  mountObserver.observe(mountHost, { childList: true })
  const state = {
    enabled: options.enabled ?? false,
    collapsed: false,
    hovered: null,
    selected: null,
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
    if (!state.enabled || state.collapsed) return
    state.hovered = isEditableTarget(event.target) ? event.target : null
    updateOutline(hoverOutline, state.hovered && state.hovered !== state.selected ? state.hovered : null)
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
    if (!state.enabled || state.collapsed || !isEditableTarget(event.target)) return
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
    state.status = `已选中：${getElementLabel(el)}`
    updateOutline(hoverOutline, null)
    updateOutline(selectedOutline, state.selected)
    rerender()
  }

  function onClick(event) {
    if (!state.enabled || state.collapsed || !isEditableTarget(event.target)) return
    event.preventDefault()
    event.stopPropagation()

    if (editingElement && editingElement !== event.target) {
      commitTextEdit()
    }

    if (state.selected === event.target && isTextNode(event.target) && !editingElement) {
      startTextEdit(event.target)
      return
    }

    // 点击了不同元素，直接切换选中
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
    state.selected = target
    updateOutline(selectedOutline, state.selected)
    const saveResult = await saveHtmlToFile()
    if (saveResult === 'saved') setStatus(`已应用：${command} · 已写入文件`)
    else setStatus(`已应用：${command}`)
    return record
  }

  function getEditRect(record) {
    try {
      const el = document.querySelector(record.selector)
      if (!el) return undefined
      const r = el.getBoundingClientRect()
      return {
        x: Math.round(r.left + window.scrollX),
        y: Math.round(r.top + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    } catch {
      return undefined
    }
  }

  function describeEditChange(record) {
    const parts = []
    const styleEntries = Object.entries(record.style || {}).filter(([, v]) => v !== undefined)
    for (const [key, after] of styleEntries) {
      const cssKey = toCssPropertyName(key)
      const before = record.before?.style?.[key]
      parts.push({ kind: 'style', property: cssKey, before: before || '(未设置)', after })
    }
    if (record.text !== undefined) {
      parts.push({ kind: 'text', before: record.before?.text ?? '', after: record.text })
    }
    if (record.hidden !== undefined) {
      parts.push({ kind: 'visibility', before: record.hidden ? '显示' : '隐藏', after: record.hidden ? '隐藏' : '显示' })
    }
    if (record.order) {
      parts.push({ kind: 'order', after: record.order })
    }
    if (record.insert) {
      parts.push({ kind: 'insert', after: record.insert })
    }
    return parts
  }

  function buildEditList() {
    const records = readStoredEditsForPath()
    return records.map((record, index) => ({
      index: index + 1,
      selector: record.selector,
      label: record.label,
      command: record.command,
      changes: describeEditChange(record),
      rect: getEditRect(record),
      source: record.source,
      createdAt: record.createdAt,
      exportedAt: record.exportedAt,
    }))
  }

  function renderEditItem(lines, item) {
    lines.push(`### ${item.index}. ${item.label || item.selector}`)
    lines.push('')
    if (item.command) lines.push(`> **指令**: ${item.command}`)
    lines.push('')
    lines.push(`- selector: \`${item.selector}\``)
    if (item.source) lines.push(`- 源码提示: \`${item.source}\``)
    if (item.rect) lines.push(`- 元素位置（页面坐标）: x=${item.rect.x}, y=${item.rect.y}, w=${item.rect.w}, h=${item.rect.h}`)
    lines.push('')
    lines.push('**改动**:')
    item.changes.forEach(change => {
      const line = formatChangeLine(change)
      if (line) lines.push(line)
    })
    lines.push('')
  }

  function formatChangeLine(change) {
    if (change.kind === 'style') {
      return `- ${change.property}: \`${change.before}\` → \`${change.after}\``
    }
    if (change.kind === 'text') {
      return `- 文案: "${change.before}" → "${change.after}"`
    }
    if (change.kind === 'visibility') {
      return `- 显隐: ${change.before} → ${change.after}`
    }
    if (change.kind === 'order') {
      const map = { up: '上移一位', down: '下移一位', first: '移到首位', last: '移到末位' }
      return `- 排序: ${map[change.after] || change.after}`
    }
    if (change.kind === 'insert') {
      return `- 新增同级元素，文本: "${change.after}"`
    }
    return ''
  }

  async function exportEditList() {
    const list = buildEditList()
    if (!list.length) {
      setStatus('当前页面没有可导出的修改。')
      return
    }

    const previouslyExported = list.filter(item => item.exportedAt)
    const newlyAdded = list.filter(item => !item.exportedAt)

    const url = window.location.href
    const title = document.title || ''
    const exportedAt = new Date().toISOString()
    const lines = []
    lines.push(`# Click-Edit 修改清单`)
    lines.push('')
    lines.push(`- 页面: ${title}`)
    lines.push(`- URL: ${url}`)
    lines.push(`- 导出时间: ${exportedAt}`)
    lines.push(`- 修改条数: ${list.length}（本次新增 ${newlyAdded.length}，历史已导出 ${previouslyExported.length}）`)
    lines.push('')
    lines.push('---')
    lines.push('')

    if (newlyAdded.length) {
      lines.push(`## 🆕 本次新增（${newlyAdded.length} 条）`)
      lines.push('')
      lines.push('> 上次导出之后产生的修改，开发优先看这一段。')
      lines.push('')
      newlyAdded.forEach(item => renderEditItem(lines, item))
      lines.push('---')
      lines.push('')
    }

    if (previouslyExported.length) {
      lines.push(`## ✅ 已导出过（${previouslyExported.length} 条）`)
      lines.push('')
      lines.push('> 之前已经导出过的修改，留在这里供完整对照。')
      lines.push('')
      previouslyExported.forEach(item => renderEditItem(lines, item))
      lines.push('---')
      lines.push('')
    }

    lines.push('## 原始数据（JSON，可直接喂给脚本）')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify({
      url,
      title,
      exportedAt,
      summary: { total: list.length, newlyAdded: newlyAdded.length, previouslyExported: previouslyExported.length },
      edits: list,
    }, null, 2))
    lines.push('```')
    lines.push('')

    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const pageName = (document.title || 'page').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
    const suggestedName = `click-edit-${pageName}.md`

    let summary
    if (newlyAdded.length && previouslyExported.length) {
      summary = `本次新增 ${newlyAdded.length} 条，含历史 ${previouslyExported.length} 条`
    } else if (newlyAdded.length) {
      summary = `${newlyAdded.length} 条修改`
    } else {
      summary = `${previouslyExported.length} 条历史修改，无新增`
    }

    // 优先用 showSaveFilePicker 让用户主动选保存路径
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'Markdown 文件', accept: { 'text/markdown': ['.md'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        markExported(undefined, exportedAt)
        rerender()
        setStatus(`保存成功：${handle.name}（${summary}）`)
      } catch (err) {
        if (err.name === 'AbortError') {
          setStatus('已取消保存。')
        } else {
          setStatus(`保存失败：${err.message || err}`)
        }
      }
      return
    }

    // 旧浏览器回退方案：直接下载到默认下载文件夹
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = suggestedName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    markExported(undefined, exportedAt)
    rerender()
    setStatus(`已下载 ${suggestedName}（${summary}），请到浏览器默认下载文件夹查收`)
  }

  function undoEdit() {
    const record = undoLastEdit()
    if (!record) {
      setStatus('没有可撤销的修改。')
      return undefined
    }
    if (record.command) {
      const el = document.querySelector(record.selector)
      const ctx = el ? { tag: el.tagName.toLowerCase(), text: el.innerText?.slice(0, 50) } : null
      trackMisparsed(record.command, ctx, JSON.stringify(record.style || {}))
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
    records.forEach(record => {
      if (record.command) {
        const el = document.querySelector(record.selector)
        const ctx = el ? { tag: el.tagName.toLowerCase(), text: el.innerText?.slice(0, 50) } : null
        trackMisparsed(record.command, ctx, JSON.stringify(record.style || {}))
      }
    })
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

    if (action === 'collapse') {
      state.collapsed = true
      state.hovered = null
      updateOutline(hoverOutline, null)
      updateOutline(selectedOutline, null)
      rerender()
      return
    }
    if (action === 'expand') {
      state.collapsed = false
      updateOutline(selectedOutline, state.selected)
      rerender()
      return
    }
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
    if (action === 'export') { exportEditList(); return }
    if (action === 'reset') { resetEdits(); return }

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

  // 实时预览：input 事件直接操作 DOM style，不产生记录
  shadow.addEventListener('input', event => {
    const target = event.target

    // textarea 输入时切换应用按钮状态
    if (target.matches?.('textarea')) {
      const applyBtn = shadow.querySelector('[data-action="apply"]')
      if (applyBtn) applyBtn.disabled = !target.value.trim()
      return
    }

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

  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('dblclick', onDblClick, true)

  readStoredEdits().forEach(record => applyEdit(record))
  rerender()

  const api = {
    // 面板真实存活 = root 节点仍挂在当前文档上。popup 与重复注入都以此为准，避免标记残留导致的死状态。
    isAlive: () => root.isConnected && root.ownerDocument === document,
    destroy() {
      mountObserver.disconnect() // 先停看门狗，否则 remove() 会被自愈逻辑立刻重挂
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDblClick, true)
      if (editingElement) commitTextEdit()
      root.remove()
      hoverOutline.remove()
      selectedOutline.remove()
      delete window.__CLICK_EDIT__
    },
    exportEditList: () => exportEditList(),
    history: () => readStoredEditsForPath(),
    applyToElement: (element, command) => applyCommandToElement(element, command),
    undo: () => undoEdit(),
    rollback: editId => rollbackEdit(editId),
  }

  window.__CLICK_EDIT__ = api
  return api
}
