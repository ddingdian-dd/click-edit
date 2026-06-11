function cssEscape(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return String(value).replace(/["\\#.;?+*~':"!^$[\]()=>|/@]/g, '\\$&')
}

export function getElementLabel(element) {
  const text = element.innerText?.trim().replace(/\s+/g, ' ')
  if (text) return text.slice(0, 80)
  return element.getAttribute('aria-label') || element.getAttribute('title') || element.tagName.toLowerCase()
}

export function getElementSelector(element) {
  const visualId = element.getAttribute('data-vpe-id')
  if (visualId) return `[data-vpe-id="${cssEscape(visualId)}"]`

  const testId = element.getAttribute('data-testid')
  if (testId) return `[data-testid="${cssEscape(testId)}"]`

  const id = element.getAttribute('id')
  if (id) return `#${cssEscape(id)}`

  const parts = []
  let current = element

  while (current && current.tagName !== 'BODY') {
    const parent = current.parentElement
    if (!parent) break

    const tag = current.tagName.toLowerCase()
    const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName)
    const index = siblings.indexOf(current) + 1
    parts.unshift(`${tag}:nth-of-type(${index})`)
    current = parent
  }

  return `body > ${parts.join(' > ')}`
}

export function getSourceHint(element) {
  const source = element.getAttribute('data-vpe-source')
  const sourceId = element.getAttribute('data-vpe-id')
  if (!source && !sourceId) return undefined

  return {
    file: source || undefined,
    id: sourceId || undefined,
    originalText: element.innerText?.trim() || undefined,
  }
}
