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

// 相对增量：识别 增加/减少/+/- 为 delta，而非绝对赋值
const deltaCases = [
  { command: '宽度增加20px', deltas: { width: '+20px' } },
  { command: '宽度减少12px', deltas: { width: '-12px' } },
  { command: '宽度+20px', deltas: { width: '+20px' } },
  { command: '高度增加50px', deltas: { height: '+50px' } },
  { command: '高度调小30px', deltas: { height: '-30px' } },
  { command: '内边距增加10px', deltas: { padding: '+10px' } },
  { command: '宽度增加20像素', deltas: { width: '+20px' } },
]

for (const item of deltaCases) {
  const parsed = parseVisualCommand(item.command)
  assert.deepEqual(parsed.deltas, item.deltas, item.command)
  // delta 指令不应误触发 insert/text
  assert.equal(parsed.insert, undefined, `${item.command} 不应产生 insert`)
  assert.equal(parsed.text, undefined, `${item.command} 不应产生 text`)
}

// 绝对赋值仍走 style，不进 deltas
const absParsed = parseVisualCommand('宽度改为300px')
assert.equal(absParsed.style.width, '300px', '宽度改为300px 应为绝对值')
assert.deepEqual(absParsed.deltas, {}, '宽度改为300px 不应产生 delta')

console.log(`commands passed: ${cases.length + deltaCases.length + 1}`)
