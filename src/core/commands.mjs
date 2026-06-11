const REMOVE_INTENT_RE = /删除|删掉|去掉|去除|取消|不要|移除|清除|无/

const COLOR_MAP = {
  蓝: '#3370ff',
  蓝色: '#3370ff',
  浅蓝: '#e1eaff',
  绿: '#34c724',
  绿色: '#34c724',
  红: '#f54a45',
  红色: '#f54a45',
  橙: '#ff7d00',
  橙色: '#ff7d00',
  紫: '#7b61ff',
  紫色: '#7b61ff',
  黑: '#1f2329',
  黑色: '#1f2329',
  纯黑: '#000000',
  白: '#ffffff',
  白色: '#ffffff',
  纯白: '#ffffff',
  灰: '#f0f1f5',
  灰色: '#f0f1f5',
  浅灰: '#f6f6fb',
}

export function getColorFromCommand(command) {
  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (command.includes(key)) return value
  }
  return command.match(/#[0-9a-fA-F]{3,8}/)?.[0]
}

export function hasLayoutIntent(command) {
  return /高度|宽度|铺满|撑满|满屏|全屏|网页|页面|屏幕|自适应/.test(command)
}

export function hasPageSizeIntent(command) {
  return /网页高度|页面高度|屏幕高度|满屏|全屏|铺满.*(页面|网页|屏幕)|撑满.*(页面|网页|屏幕)|适配.*(页面|网页|屏幕)/.test(command)
}

function extractQuotedText(command) {
  return command.match(/[“"]([^”"]+)[”"]/)?.[1] || command.match(/[改换](?:成|为)(.+)$/)?.[1]?.trim()
}

function hasTextStyleIntent(command) {
  return /文字颜色|字体颜色|字色/.test(command)
}

function hasBackgroundIntent(command) {
  return /背景色?|底色|填充色|(?:蓝|绿|红|橙|紫|黑|白|灰|浅灰|纯白|纯黑)底/.test(command)
}

function hasTextContentIntent(command) {
  return command.includes('文案') || (command.includes('文字') && !hasTextStyleIntent(command))
}

function hasGlassIntent(command) {
  return /磨砂|毛玻璃|玻璃|半透明/.test(command)
}

function hasRemoveIntent(command) {
  return REMOVE_INTENT_RE.test(command)
}

function hasRemoveGlassIntent(command) {
  return /(删除|删掉|去掉|去除|取消|不要|移除|清除|无)(?:这个|这种|该)?(磨砂|毛玻璃|玻璃|半透明)|(磨砂|毛玻璃|玻璃|半透明)(?:效果)?(删除|删掉|去掉|去除|取消|移除|清除)/.test(command)
}

function getGlassBackground(command) {
  if (/黑|深色/.test(command)) return 'rgba(31, 35, 41, 0.58)'
  if (/蓝/.test(command)) return 'rgba(51, 112, 255, 0.18)'
  if (/灰/.test(command)) return 'rgba(246, 246, 251, 0.72)'
  return 'rgba(255, 255, 255, 0.72)'
}

function extractCssSize(command, axis) {
  const match = command.match(new RegExp(`${axis}[^0-9]*(\\d+(?:\\.\\d+)?)(px|%|vh|vw|rem|em)?`))
  if (!match) return undefined
  return `${match[1]}${match[2] || 'px'}`
}

function applyVisualStyleCommand(command, style) {
  const color = getColorFromCommand(command)
  const remove = hasRemoveIntent(command)

  if (hasBackgroundIntent(command)) {
    if (remove || (/透明/.test(command) && !/不是透明/.test(command))) {
      style.backgroundColor = 'transparent'
    } else if (color) {
      style.backgroundColor = color
    }
  }

  if (hasTextStyleIntent(command) && color) {
    style.color = color
  }

  if (/边框/.test(command)) {
    style.border = remove ? '0' : `1px solid ${color || '#3370ff'}`
  }

  if (/阴影|投影|shadow/i.test(command)) {
    style.boxShadow = remove ? 'none' : '0 18px 48px rgba(31, 35, 41, 0.12)'
  }

  if (hasGlassIntent(command) && !hasRemoveGlassIntent(command)) {
    style.backgroundColor = getGlassBackground(command)
    style.backdropFilter = 'blur(18px) saturate(160%)'
    style.WebkitBackdropFilter = 'blur(18px) saturate(160%)'
    style.border = /不要边框|无边框|删除边框|去掉边框/.test(command) ? '0' : '1px solid rgba(255, 255, 255, 0.55)'
    style.boxShadow = /不要阴影|无阴影|删除阴影|去掉阴影|取消阴影/.test(command) ? 'none' : '0 18px 48px rgba(31, 35, 41, 0.12)'
  }

  if (/透明/.test(command) && !/半透明|磨砂|毛玻璃|玻璃|不是透明|不透明/.test(command)) {
    style.backgroundColor = 'transparent'
    style.boxShadow = 'none'
  }

  if (/不透明/.test(command) && !hasGlassIntent(command)) {
    style.opacity = '1'
  }
}

export function parseVisualCommand(command) {
  const input = command.trim()
  const style = {}
  let text
  let hidden

  if (!input) return { style }

  if (input.includes('隐藏')) hidden = true
  if (input.includes('显示')) hidden = false
  if (/^(删除|删掉|去掉|移除)(这个|该|此)?(元素|模块|组件|板块|区块)?$/.test(input) || input === '删除') hidden = true
  if (input.includes('加粗')) style.fontWeight = '700'
  if (input.includes('取消加粗')) style.fontWeight = '400'
  if (input.includes('居中')) style.textAlign = 'center'
  if (input.includes('左对齐')) style.textAlign = 'left'
  if (input.includes('右对齐')) style.textAlign = 'right'
  if (input.includes('圆角')) style.borderRadius = input.includes('更') ? '24px' : '12px'

  if (input.includes('放大')) {
    style.transform = 'scale(1.06)'
    style.transformOrigin = 'center'
  }
  if (input.includes('缩小')) {
    style.transform = 'scale(0.94)'
    style.transformOrigin = 'center'
  }

  applyVisualStyleCommand(input, style)

  if (input.includes('高度')) {
    const height = extractCssSize(input, '高度')
    if (height) {
      style.minHeight = height
    } else if (hasPageSizeIntent(input)) {
      style.minHeight = '100vh'
    } else if (input.includes('自适应') || input.includes('适配')) {
      style.height = 'auto'
    }
  }

  if (input.includes('宽度')) {
    const width = extractCssSize(input, '宽度')
    if (width) {
      style.width = width
    } else if (input.includes('铺满') || input.includes('撑满') || input.includes('满')) {
      style.width = '100%'
    } else if (input.includes('自适应') || input.includes('适配')) {
      style.width = 'auto'
    }
  }

  if (input.includes('铺满屏幕') || input.includes('撑满屏幕') || input.includes('全屏') || input.includes('满屏')) {
    style.minHeight = '100vh'
    style.width = '100%'
  }

  if (input.includes('内容上下居中') || input.includes('垂直居中') || input.includes('上下居中')) {
    style.display = 'flex'
    style.flexDirection = 'column'
    style.justifyContent = 'center'
  }
  if (input.includes('内容左右居中') || input.includes('水平居中')) {
    style.display = 'flex'
    style.alignItems = 'center'
  }

  // padding / margin
  const spacingMatch = input.match(/(padding|margin|内边距|外边距|内间距|外间距).*?(上|下|左|右|top|bottom|left|right)?.*?(?:增加|加|设为|改为|设置为?)?.*?(\d+)\s*(px|%|rem|em)?/i)
  if (spacingMatch) {
    const propBase = /margin|外/.test(spacingMatch[1]) ? 'margin' : 'padding'
    const dirMap = { '上': 'Top', '下': 'Bottom', '左': 'Left', '右': 'Right', 'top': 'Top', 'bottom': 'Bottom', 'left': 'Left', 'right': 'Right' }
    const dir = spacingMatch[2] ? dirMap[spacingMatch[2].toLowerCase()] || '' : ''
    const value = `${spacingMatch[3]}${spacingMatch[4] || 'px'}`
    style[`${propBase}${dir}`] = value
  }

  // 直接 CSS 属性赋值：如 "font-size 改为 20px" 或 "fontSize: 20px"
  const cssPropMatch = input.match(/([a-zA-Z-]+)\s*[:：]?\s*(?:改为|设为|改成|设置为?)?\s*(\d+(?:\.\d+)?\s*(?:px|%|rem|em|vh|vw)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/i)
  if (cssPropMatch && Object.keys(style).length === 0) {
    const rawProp = cssPropMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const validProps = ['fontSize','lineHeight','letterSpacing','fontWeight','opacity','gap','borderRadius','paddingTop','paddingBottom','paddingLeft','paddingRight','marginTop','marginBottom','marginLeft','marginRight']
    if (validProps.includes(rawProp) || rawProp.startsWith('padding') || rawProp.startsWith('margin')) {
      style[rawProp] = cssPropMatch[2].trim()
    }
  }

  const hasStyleIntent = Object.keys(style).length > 0 || hidden !== undefined
  if (hasTextContentIntent(input) || (!hasStyleIntent && !hasLayoutIntent(input) && (input.includes('改成') || input.includes('改为') || input.includes('换成') || input.includes('换为')))) {
    text = extractQuotedText(input)
  }

  let order
  if (/移动?到最后|放到最后|排到最后|移到末尾|移动?到后面|排最后|最后面/.test(input)) order = 'last'
  else if (/移动?到最前|放到最前|排到最前|移到开头|移动?到前面|排最前|最前面/.test(input)) order = 'first'
  else if (/往?下移动?|向下移动?|下移|往后移/.test(input)) order = 'down'
  else if (/往?上移动?|向上移动?|上移|往前移/.test(input)) order = 'up'

  let insert
  const insertMatch = input.match(/(?:增加|添加|新增|加上|加一个|插入)(?:一个)?["""]?(.+?)["""]?$/)
  if (insertMatch && !hasStyleIntent) {
    insert = insertMatch[1].trim()
  }

  return { style, text, hidden, order, insert }
}

export function isParsedCommandEmpty(parsed) {
  return Object.keys(parsed.style || {}).length === 0 && parsed.text === undefined && parsed.hidden === undefined && parsed.order === undefined && parsed.insert === undefined
}
