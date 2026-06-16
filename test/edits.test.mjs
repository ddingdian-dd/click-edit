import assert from 'node:assert/strict'
import { applyEdit, createEditRecord, readStoredEdits, readStoredEditsForPath, saveEdit, STORAGE_KEY, undoLastEdit, undoToEdit } from '../src/core/edits.mjs'

class FakeElement {
  constructor() {
    this._innerText = 'Old title'
    this._innerHTML = '<span>Old title</span>'
    this.attributes = new Map([['data-ce-id', 'hero']])
    this.style = {
      values: new Map([['background-color', '#000000']]),
      display: '',
      getPropertyValue(name) {
        return this.values.get(name) || ''
      },
      setProperty(name, value) {
        this.values.set(name, value)
      },
      removeProperty(name) {
        this.values.delete(name)
      },
    }
    this.tagName = 'H1'
  }

  get innerText() {
    return this._innerText
  }

  set innerText(value) {
    this._innerText = value
    this._innerHTML = value
  }

  get innerHTML() {
    return this._innerHTML
  }

  set innerHTML(value) {
    this._innerHTML = value
    this._innerText = String(value).replace(/<[^>]+>/g, '')
  }

  getAttribute(name) {
    return this.attributes.get(name) || null
  }
}

const element = new FakeElement()
const store = new Map()

globalThis.CSS = { escape: value => String(value) }
globalThis.window = {
  location: { pathname: '/' },
  localStorage: {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  },
}
globalThis.document = {
  querySelector: selector => (selector === '[data-ce-id="hero"]' ? element : null),
}

const record = createEditRecord({
  element,
  command: '文案改成“New title”，底色改为纯白色',
  parsed: {
    text: 'New title',
    style: { backgroundColor: '#ffffff' },
  },
})

assert.equal(record.before.text, 'Old title')
assert.equal(record.before.html, '<span>Old title</span>')
assert.equal(record.before.style.backgroundColor, '#000000')

applyEdit(record)
assert.equal(element.innerText, 'New title')
assert.equal(element.style.getPropertyValue('background-color'), '#ffffff')

saveEdit(record)
assert.equal(readStoredEdits().length, 1)
assert.equal(readStoredEditsForPath('/').length, 1)
assert.equal(readStoredEditsForPath('/other').length, 0)

const undone = undoLastEdit()
assert.equal(undone.command, '文案改成“New title”，底色改为纯白色')
assert.equal(element.innerText, 'Old title')
assert.equal(element.innerHTML, '<span>Old title</span>')
assert.equal(element.style.getPropertyValue('background-color'), '#000000')
assert.equal(JSON.parse(store.get(STORAGE_KEY)).length, 0)

const first = createEditRecord({
  element,
  command: '底色改为纯白色',
  parsed: {
    style: { backgroundColor: '#ffffff' },
  },
})
applyEdit(first)
saveEdit(first)

const second = createEditRecord({
  element,
  command: '删除阴影',
  parsed: {
    style: { boxShadow: 'none' },
  },
})
applyEdit(second)
saveEdit(second)

saveEdit({
  id: 'other-page-edit',
  path: '/other',
  selector: '[data-ce-id="hero"]',
  command: '其他页面修改',
  style: { backgroundColor: '#3370ff' },
  before: { style: { backgroundColor: '#000000' } },
})

assert.equal(readStoredEdits().length, 3)
assert.equal(readStoredEditsForPath('/').length, 2)

const rolledBack = undoToEdit(first.id)
assert.deepEqual(rolledBack.map(item => item.command), ['删除阴影', '底色改为纯白色'])
assert.equal(element.style.getPropertyValue('background-color'), '#000000')
assert.equal(element.style.getPropertyValue('box-shadow'), '')
assert.deepEqual(readStoredEdits().map(item => item.id), ['other-page-edit'])

console.log('edits passed')

// ---- 相对增量 delta：应用走 calc，回退能还原 ----
const deltaStore = new Map()
const deltaEl = new FakeElement()
// 当前宽度无 inline 值，靠 computed 提供基准
globalThis.window.getComputedStyle = () => ({
  getPropertyValue(name) {
    if (name === 'width') return '300px'
    if (name === 'height') return 'auto'
    return ''
  },
})
globalThis.window.localStorage = {
  getItem: key => deltaStore.get(key) || null,
  setItem: (key, value) => deltaStore.set(key, value),
}
globalThis.document.querySelector = selector =>
  (selector === '[data-ce-id="hero"]' ? deltaEl : null)

const widthDelta = createEditRecord({
  element: deltaEl,
  command: '宽度增加20px',
  parsed: { style: {}, deltas: { width: '+20px' } },
})
// 修改前 inline 宽度为空，快照应记录为空（回退时 removeProperty）
assert.equal(widthDelta.before.style.width, '')

applyEdit(widthDelta)
assert.equal(deltaEl.style.getPropertyValue('width'), 'calc(300px + 20px)', '宽度增量应基于 computed 300px')

// 基准为 auto 时退化为增量本身
const heightDelta = createEditRecord({
  element: deltaEl,
  command: '高度增加50px',
  parsed: { style: {}, deltas: { height: '+50px' } },
})
applyEdit(heightDelta)
assert.equal(deltaEl.style.getPropertyValue('height'), '50px', 'auto 基准下高度增量退化为绝对值')

// 回退宽度增量：inline 还原为空
saveEdit(widthDelta)
const revertedWidth = undoLastEdit()
assert.equal(revertedWidth.command, '宽度增加20px')
assert.equal(deltaEl.style.getPropertyValue('width'), '', '回退后宽度 inline 应被移除')

console.log('delta edits passed')
