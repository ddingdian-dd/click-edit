const SYSTEM_PROMPT = `你是一个 HTML/CSS 可视化编辑助手。用户会描述对页面元素的修改需求，你需要返回结构化的操作指令。

你必须且只能返回一个 JSON 对象，不要任何解释文字。JSON 格式如下：

{
  "style": { "cssProperty": "value" },  // camelCase CSS 属性，如 backgroundColor, fontSize
  "text": "新文字内容",                    // 修改文字内容时使用，不修改则不要此字段
  "hidden": true/false,                   // 隐藏/显示元素，不涉及则不要此字段
  "order": "up/down/first/last",          // 移动元素位置，不涉及则不要此字段
  "insert": "新元素文字内容"               // 在当前元素后插入同类型新元素，不涉及则不要此字段
}

规则：
- style 中的属性名用 camelCase（如 paddingBottom 不是 padding-bottom）
- 颜色值用 hex 或 rgba
- 尺寸值带单位（px, %, vh 等）
- 如果用户说"删除"指的是隐藏元素，返回 {"hidden": true}
- 如果用户说"移到最后"之类，返回 {"order": "last"}
- 只返回 JSON，不要 markdown 代码块，不要解释`

const DEFAULT_KEY = '019d1a6691b176a180ab9de6786e3c20'
let apiKey = null

export function setApiKey(key) {
  apiKey = key
  try { localStorage.setItem('vpe-api-key', key) } catch {}
}

export function getApiKey() {
  if (apiKey) return apiKey
  try { apiKey = localStorage.getItem('vpe-api-key') } catch {}
  return apiKey || DEFAULT_KEY
}

export async function llmParseCommand(command, elementContext) {
  const key = getApiKey()
  if (!key) return null

  const userMessage = elementContext
    ? `当前选中元素：<${elementContext.tag}> 内容："${elementContext.text?.slice(0, 100)}" 当前样式：${elementContext.currentStyle}\n\n用户指令：${command}`
    : `用户指令：${command}`

  try {
    const isProxy = !key.startsWith('sk-ant-')
    const baseUrl = isProxy
      ? 'http://deepseek-work.intsig.net/proxy/aws/claude/bedrock'
      : 'https://api.anthropic.com'
    const endpoint = `${baseUrl}/v1/messages`
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    }
    if (isProxy) {
      headers['Authorization'] = `Bearer ${key}`
    } else {
      headers['x-api-key'] = key
      headers['anthropic-dangerous-direct-browser-access'] = 'true'
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: isProxy ? 'us.anthropic.claude-haiku-4-5-20251001-v1:0' : 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    })

    if (!res.ok) {
      if (res.status === 401) {
        apiKey = null
        try { localStorage.removeItem('vpe-api-key') } catch {}
      }
      return null
    }

    const data = await res.json()
    const text = data.content?.[0]?.text?.trim()
    if (!text) return null

    const json = JSON.parse(text.replace(/^```json?\s*/, '').replace(/```$/, ''))
    return {
      style: json.style || {},
      text: json.text,
      hidden: json.hidden,
      order: json.order,
      insert: json.insert
    }
  } catch {
    return null
  }
}
