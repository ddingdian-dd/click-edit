// Google Apps Script — 贴到 Apps Script 编辑器里
// 部署为 Web App（任何人均可访问）

// 首次运行前，先手动执行一次 setup() 函数，它会创建一个 Sheet 并在日志里打印 URL
function setup() {
  var ss = SpreadsheetApp.create('Click-Edit 使用统计')
  var sheet = ss.getSheetByName('Sheet1')
  sheet.setName('usage')
  sheet.appendRow(['时间', '用户ID', '版本', '域名'])
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId())
  Logger.log('表格已创建: ' + ss.getUrl())
}

function doGet(e) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  if (!sheetId) return ContentService.createTextOutput(JSON.stringify({ error: 'run setup() first' })).setMimeType(ContentService.MimeType.JSON)

  var ss = SpreadsheetApp.openById(sheetId)
  var sheet = ss.getSheetByName('usage')

  var uid = e.parameter.uid || 'unknown'
  var version = e.parameter.v || '?'
  var domain = e.parameter.d || ''
  var time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  sheet.appendRow([time, uid, version, domain])

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON)
}
