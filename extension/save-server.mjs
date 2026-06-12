import { createServer } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const PORT = 17532

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = ''
    for await (const chunk of req) body += chunk

    try {
      const { filePath, html } = JSON.parse(body)
      if (!filePath || !html) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'missing filePath or html' }))
        return
      }

      const localPath = filePath.startsWith('file://') ? fileURLToPath(filePath) : filePath
      await writeFile(localPath, html, 'utf-8')
      console.log(`[Click-Edit] saved: ${localPath}`)
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  res.writeHead(404)
  res.end('not found')
})

server.listen(PORT, () => {
  console.log(`[Click-Edit Save Server] running on http://localhost:${PORT}`)
  console.log('修改会自动保存回原文件。Ctrl+C 退出。')
})
