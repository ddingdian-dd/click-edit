import { getElementLabel, getElementSelector, getSourceHint } from './selectors.mjs'

export const STORAGE_KEY = 'click-edit-edits-v1'

function toCssPropertyName(key) {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

function getCurrentPath() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

function recordMatchesPath(record, path) {
  return !record.path || record.path === path
}

function captureBeforeSnapshot(element, parsed) {
  const style = {}
  for (const key of Object.keys(parsed.style || {})) {
    style[key] = element.style.getPropertyValue(toCssPropertyName(key))
  }

  let orderIndex
  if (parsed.order && element.parentElement) {
    orderIndex = Array.from(element.parentElement.children).indexOf(element)
  }

  return {
    text: parsed.text !== undefined ? element.innerText : undefined,
    html: parsed.text !== undefined ? element.innerHTML : undefined,
    display: parsed.hidden !== undefined ? element.style.display : undefined,
    orderIndex,
    style,
  }
}

export function createEditRecord({ element, command, parsed, path = getCurrentPath() }) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path,
    selector: getElementSelector(element),
    label: getElementLabel(element),
    command,
    text: parsed.text,
    hidden: parsed.hidden,
    order: parsed.order,
    insert: parsed.insert,
    style: parsed.style,
    before: captureBeforeSnapshot(element, parsed),
    source: getSourceHint(element),
    createdAt: new Date().toISOString(),
  }
}

export function applyEdit(record, root = document) {
  if (record.path && record.path !== getCurrentPath()) return false
  const element = root.querySelector(record.selector)
  if (!element) return false

  if (record.insert) {
    const sibling = element.previousElementSibling || element.nextElementSibling || element
    const clone = sibling.cloneNode(true)
    clone.removeAttribute('id')
    clone.setAttribute('data-ce-inserted', record.id)
    const textNode = clone.querySelector('span, a, p, h1, h2, h3, h4, h5, h6, li, label, div')
    if (textNode) {
      textNode.textContent = record.insert
    } else {
      clone.lastChild ? clone.lastChild.textContent = record.insert : clone.textContent = record.insert
    }
    element.after(clone)
  }

  if (record.text !== undefined) {
    element.innerText = record.text
  }

  if (record.order && element.parentElement) {
    const parent = element.parentElement
    if (record.order === 'last') {
      parent.appendChild(element)
    } else if (record.order === 'first') {
      parent.prepend(element)
    } else if (record.order === 'down') {
      const next = element.nextElementSibling
      if (next) next.after(element)
    } else if (record.order === 'up') {
      const prev = element.previousElementSibling
      if (prev) prev.before(element)
    }
  }

  if (record.hidden !== undefined) {
    element.style.display = record.hidden ? 'none' : ''
  }

  for (const [key, value] of Object.entries(record.style || {})) {
    if (value === undefined) continue

    const property = toCssPropertyName(key)
    if (value === '') {
      element.style.removeProperty(property)
    } else {
      element.style.setProperty(property, value)
    }
  }

  return true
}

export function revertEdit(record, root = document) {
  if (record.path && record.path !== getCurrentPath()) return false
  const element = root.querySelector(record.selector)
  if (!element || !record.before) return false

  if (record.insert) {
    const inserted = root.querySelector(`[data-ce-inserted="${record.id}"]`)
    if (inserted) inserted.remove()
    return true
  }

  if (record.before.html !== undefined) {
    element.innerHTML = record.before.html
  } else if (record.before.text !== undefined) {
    element.innerText = record.before.text
  }

  if (record.before.orderIndex !== undefined && element.parentElement) {
    const parent = element.parentElement
    const children = Array.from(parent.children)
    if (record.before.orderIndex >= children.length) {
      parent.appendChild(element)
    } else {
      const ref = children.filter(c => c !== element)[record.before.orderIndex]
      if (ref) parent.insertBefore(element, ref)
      else parent.appendChild(element)
    }
  }

  if (record.before.display !== undefined) {
    element.style.display = record.before.display
  }

  for (const [key, value] of Object.entries(record.before.style || {})) {
    const property = toCssPropertyName(key)
    if (value) {
      element.style.setProperty(property, value)
    } else {
      element.style.removeProperty(property)
    }
  }

  return true
}

export function readStoredEdits() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function readStoredEditsForPath(path = getCurrentPath()) {
  return readStoredEdits().filter(record => recordMatchesPath(record, path))
}

export function writeStoredEdits(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records, null, 2))
}

export function saveEdit(record) {
  const records = readStoredEdits()
  records.push(record)
  writeStoredEdits(records)
  return records
}

export function undoLastEdit(root = document) {
  const records = readStoredEdits()
  const path = getCurrentPath()
  let index = -1
  for (let cursor = records.length - 1; cursor >= 0; cursor -= 1) {
    if (recordMatchesPath(records[cursor], path)) {
      index = cursor
      break
    }
  }
  if (index === -1) return undefined

  const record = records[index]
  if (!revertEdit(record, root)) return undefined

  records.splice(index, 1)
  writeStoredEdits(records)
  return record
}

export function undoToEdit(editId, root = document) {
  const records = readStoredEdits()
  const path = getCurrentPath()
  const targetIndex = records.findIndex(record => record.id === editId && recordMatchesPath(record, path))
  if (targetIndex === -1) return []

  const candidates = []
  for (let index = records.length - 1; index >= targetIndex; index -= 1) {
    const record = records[index]
    if (!recordMatchesPath(record, path)) continue
    if (!record.before || !root.querySelector(record.selector)) return []
    candidates.push({ index, record })
  }

  for (const { record } of candidates) {
    if (!revertEdit(record, root)) return []
  }

  const indicesToRemove = candidates.map(c => c.index).sort((a, b) => b - a)
  for (const index of indicesToRemove) {
    records.splice(index, 1)
  }

  writeStoredEdits(records)
  return candidates.map(item => item.record)
}
