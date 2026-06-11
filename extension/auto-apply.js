(function() {
  const STORAGE_KEY = 'visual-page-editor-edits-v1'

  function toCssPropertyName(key) {
    return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  }

  function getCurrentPath() {
    return window.location.pathname
  }

  function readStoredEdits() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    } catch { return [] }
  }

  function applyEdit(record) {
    if (record.path && record.path !== getCurrentPath()) return
    const element = document.querySelector(record.selector)
    if (!element) return

    if (record.insert) {
      const sibling = element.previousElementSibling || element.nextElementSibling || element
      const clone = sibling.cloneNode(true)
      clone.removeAttribute('id')
      clone.setAttribute('data-vpe-inserted', record.id)
      const textNode = clone.querySelector('span, a, p, h1, h2, h3, h4, h5, h6, li, label, div')
      if (textNode) textNode.textContent = record.insert
      else if (clone.lastChild) clone.lastChild.textContent = record.insert
      else clone.textContent = record.insert
      element.after(clone)
    }

    if (record.text !== undefined) {
      element.innerText = record.text
    }

    if (record.order && element.parentElement) {
      const parent = element.parentElement
      if (record.order === 'last') parent.appendChild(element)
      else if (record.order === 'first') parent.prepend(element)
      else if (record.order === 'down') {
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
      if (value === '') element.style.removeProperty(property)
      else element.style.setProperty(property, value)
    }
  }

  const edits = readStoredEdits()
  if (edits.length) {
    edits.forEach(applyEdit)
  }

})()
