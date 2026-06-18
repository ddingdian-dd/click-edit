import { JSDOM } from 'jsdom'
import fs from 'fs'

function freshDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><h1>hi</h1></body></html>', {
    url: 'https://example.com/',
    pretendToBeVisual: true,
  })
  const { window } = dom
  globalThis.window = window
  globalThis.document = window.document
  globalThis.HTMLElement = window.HTMLElement
  globalThis.MutationObserver = window.MutationObserver
  globalThis.getComputedStyle = window.getComputedStyle
  window.localStorage.clear()
  return window
}

const code = fs.readFileSync('extension/content.js', 'utf8')
function runEntry(window) {
  const fn = new Function('window', 'document', 'HTMLElement', 'MutationObserver', 'getComputedStyle', code)
  fn(window, window.document, window.HTMLElement, window.MutationObserver, window.getComputedStyle)
}

let pass = 0, fail = 0
function assert(name, cond) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗', name) }
}

// 场景 1：首次注入
console.log('场景1 首次注入：')
const w1 = freshDom()
runEntry(w1)
assert('__CLICK_EDIT__ 存在', !!w1.__CLICK_EDIT__)
assert('isAlive 为 true', w1.__CLICK_EDIT__.isAlive() === true)
assert('面板节点挂载', !!w1.document.getElementById('click-edit-root'))

// 场景 2：旧版本标记残留（无 isAlive、面板已被冲掉）→ 重注入应销毁残留并重建
// 这正是用户遇到的死状态：改代码+重载扩展后，旧页面里残留老版本标记。
console.log('场景2 旧版本残留（无 isAlive）重注入应重建：')
const w2 = freshDom()
let oldDestroyed = false
w2.__CLICK_EDIT__ = { destroy() { oldDestroyed = true } } // 老版本没有 isAlive
runEntry(w2)
assert('旧实例被销毁', oldDestroyed === true)
assert('重建后 isAlive 为 true', w2.__CLICK_EDIT__.isAlive() === true)
assert('重建后面板节点存在', !!w2.document.getElementById('click-edit-root'))

// 场景 3：标记残留 + isAlive 返回 false（新版本面板失效）→ 应重建
console.log('场景3 新版本标记残留但 isAlive=false 应重建：')
const w3 = freshDom()
let deadDestroyed = false
w3.__CLICK_EDIT__ = { isAlive: () => false, destroy() { deadDestroyed = true } }
runEntry(w3)
assert('失效实例被销毁', deadDestroyed === true)
assert('重建后 isAlive 为 true', w3.__CLICK_EDIT__.isAlive() === true)

// 场景 4：标记存在 + 面板活着 → 应复用，不重建
console.log('场景4 面板活着应复用：')
const w4 = freshDom()
runEntry(w4)
const api4 = w4.__CLICK_EDIT__
runEntry(w4)
assert('复用同一实例', w4.__CLICK_EDIT__ === api4)
assert('仍然 isAlive', w4.__CLICK_EDIT__.isAlive() === true)

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
