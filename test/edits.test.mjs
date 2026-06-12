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
