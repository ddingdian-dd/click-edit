const STORAGE_KEY = 'click-edit-analytics-v1'
const REPO = 'ddingdian-dd/click-edit'
const BATCH_THRESHOLD = 5

function readRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function writeRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function trackUnrecognized(command, elementContext) {
  const records = readRecords()
  records.push({
    command,
    element: elementContext ? `<${elementContext.tag}> "${elementContext.text?.slice(0, 50)}"` : null,
    url: location.href,
    time: new Date().toISOString()
  })
  writeRecords(records)

  if (records.length >= BATCH_THRESHOLD) {
    autoReport()
  }
}

export function getPendingCount() {
  return readRecords().length
}

export function autoReport() {
  const records = readRecords()
  if (!records.length) return

  const body = [
    '## 未识别指令上报',
    '',
    `共 ${records.length} 条，自动收集。`,
    '',
    '| 指令 | 元素 | 页面 | 时间 |',
    '|------|------|------|------|',
    ...records.map(r =>
      `| ${r.command} | ${r.element || '-'} | ${r.url?.split('/').pop() || '-'} | ${r.time?.slice(0, 16)} |`
    ),
    '',
    '---',
    'Auto-reported by Click-Edit analytics'
  ].join('\n')

  const title = `[Analytics] ${records.length} 条未识别指令 (${new Date().toISOString().slice(0, 10)})`

  const url = `https://github.com/${REPO}/issues/new?` + new URLSearchParams({
    title,
    body,
    labels: 'analytics,unrecognized-command'
  }).toString()

  window.open(url, '_blank')
  writeRecords([])
}

export function getAnalyticsReport() {
  const records = readRecords()
  if (!records.length) return null
  return {
    count: records.length,
    records,
    since: records[0]?.time
  }
}
