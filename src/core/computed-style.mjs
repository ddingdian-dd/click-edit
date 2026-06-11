function toCssPropertyName(key) {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

export function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return ''
  if (rgb.startsWith('#')) return rgb
  const match = rgb.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return rgb
  const [, r, g, b] = match
  return '#' + [r, g, b].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

export function parseNumericValue(value) {
  if (!value || value === 'auto' || value === 'none') return { number: '', unit: '' }
  const match = String(value).match(/^(-?[\d.]+)(px|%|em|rem|vh|vw)?$/)
  if (!match) return { number: '', unit: '' }
  return { number: match[1], unit: match[2] || 'px' }
}

export function readCurrentStyles(element, properties) {
  const computed = window.getComputedStyle(element)
  const result = {}

  for (const property of properties) {
    const cssProperty = toCssPropertyName(property)
    const inlineValue = element.style.getPropertyValue(cssProperty)
    if (inlineValue) {
      result[property] = inlineValue
    } else {
      result[property] = computed.getPropertyValue(cssProperty)
    }
  }
  return result
}

export const STYLE_PROPERTIES = [
  'backgroundColor', 'color',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderWidth', 'borderColor', 'borderRadius',
  'fontSize', 'fontWeight', 'textAlign',
  'width', 'height',
  'display', 'flexDirection', 'justifyContent', 'alignItems',
  'boxShadow', 'opacity',
]

export function readAllStyles(element) {
  return readCurrentStyles(element, STYLE_PROPERTIES)
}
