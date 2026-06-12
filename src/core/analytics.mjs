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
  track('unrecognized', command, elementContext)
}

export function trackMisparsed(command, elementContext, appliedResult) {
  track('misparsed', command, elementContext, appliedResult)
}

function track(type, command, elementContext, appliedResult) {
  const records = readRecords()
  records.push({
    type,
    command,
    element: elementContext ? `<${elementContext.tag}> "${elementContext.text?.slice(0, 50)}"` : null,
    applied: appliedResult || null,
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

  const unrecognized = records.filter(r => r.type === 'unrecognized')
  const misparsed = records.filter(r => r.type === 'misparsed')

  const sections = []
  if (unrecognized.length) {
    sections.push(
      `### 未识别 (${unrecognized.length} 条)`,
      '',
      '| 指令 | 元素 | 页面 | 时间 |',
      '|------|------|------|------|',
      ...unrecognized.map(r =>
        `| ${r.command} | ${r.element || '-'} | ${r.url?.split('/').pop() || '-'} | ${r.time?.slice(0, 16)} |`
      )
    )
  }
  if (misparsed.length) {
    sections.push(
      '',
      `### 解析错误 (${misparsed.length} 条)`,
      '',
      '| 指令 | 实际效果 | 元素 | 时间 |',
      '|------|---------|------|------|',
      ...misparsed.map(r =>
        `| ${r.command} | ${r.applied || '-'} | ${r.element || '-'} | ${r.time?.slice(0, 16)} |`
      )
    )
  }

  const body = [
    '## 指令问题上报',
    '',
    `共 ${records.length} 条（未识别 ${unrecognized.length} + 解析错误 ${misparsed.length}），自动收集。`,
    '',
    ...sections,
    '',
    '---',
    'Auto-reported by Click-Edit analytics'
  ].join('\n')

  const title = `[Analytics] ${records.length} 条指令问题 (${new Date().toISOString().slice(0, 10)})`

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
