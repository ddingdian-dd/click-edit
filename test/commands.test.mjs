import assert from 'node:assert/strict'
import { parseVisualCommand } from '../src/core/commands.mjs'

const cases = [
  {
    command: '高度适配网页高度',
    expected: { minHeight: '100vh' },
  },
  {
    command: '这一行不是透明的，是磨砂半透明的',
    expected: {
      backgroundColor: 'rgba(255, 255, 255, 0.72)',
      backdropFilter: 'blur(18px) saturate(160%)',
    },
  },
  {
    command: '删除阴影',
    expected: { boxShadow: 'none' },
  },
  {
    command: '磨砂半透明，但不要阴影',
    expected: {
      backgroundColor: 'rgba(255, 255, 255, 0.72)',
      boxShadow: 'none',
    },
  },
  {
    command: '底色改为纯白色',
    expected: { backgroundColor: '#ffffff' },
  },
  {
    command: '背景色改成白色',
    expected: { backgroundColor: '#ffffff' },
  },
  {
    command: '填充色改成蓝色',
    expected: { backgroundColor: '#3370ff' },
  },
]

for (const item of cases) {
  const { style } = parseVisualCommand(item.command)
  assert.deepEqual(
    Object.fromEntries(Object.keys(item.expected).map(key => [key, style[key]])),
    item.expected,
    item.command,
  )
}

console.log(`commands passed: ${cases.length}`)
