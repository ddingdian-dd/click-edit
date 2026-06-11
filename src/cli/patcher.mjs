import fs from 'node:fs'
import path from 'node:path'

export function normalizeEdits(input) {
  if (Array.isArray(input)) return input
  if (Array.isArray(input?.edits)) return input.edits
  throw new Error('Invalid edits file. Expected an array or { edits: [] }.')
}

export function toCssPropertyName(key) {
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

export function buildCssOverrides(edits) {
  const blocks = []

  for (const edit of edits) {
    const entries = Object.entries(edit.style || {})
    if (!entries.length && edit.hidden === undefined) continue

    const declarations = []
    for (const [key, value] of entries) {
      declarations.push(`  ${toCssPropertyName(key)}: ${value};`)
    }
    if (edit.hidden !== undefined) {
      declarations.push(`  display: ${edit.hidden ? 'none' : 'initial'};`)
    }

    blocks.push([
      `/* ${edit.command || 'visual edit'} | ${edit.path || '*'} | ${edit.label || edit.selector} */`,
      `${edit.selector} {`,
      ...declarations,
      '}',
    ].join('\n'))
  }

  return `${blocks.join('\n\n')}\n`
}

export function applySourceTextEdits(root, edits) {
  const changed = new Map()
  const skipped = []

  for (const edit of edits) {
    if (edit.text === undefined || !edit.source?.file || !edit.source?.originalText) continue

    const filePath = path.resolve(root, edit.source.file)
    if (!filePath.startsWith(path.resolve(root))) {
      skipped.push({ edit, reason: 'source file is outside root' })
      continue
    }
    if (!fs.existsSync(filePath)) {
      skipped.push({ edit, reason: 'source file does not exist' })
      continue
    }

    const current = changed.get(filePath) ?? fs.readFileSync(filePath, 'utf8')
    if (!current.includes(edit.source.originalText)) {
      skipped.push({ edit, reason: 'original text was not found' })
      continue
    }

    changed.set(filePath, current.replace(edit.source.originalText, edit.text))
  }

  return { changed, skipped }
}

export function buildUnifiedDiff(filePath, oldContent, newContent) {
  const oldLines = oldContent ? oldContent.split('\n') : []
  const newLines = newContent ? newContent.split('\n') : []
  const oldCount = Math.max(oldLines.length, 1)
  const newCount = Math.max(newLines.length, 1)

  return [
    `diff --git a/${filePath} b/${filePath}`,
    oldContent ? `--- a/${filePath}` : '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -1,${oldCount} +1,${newCount} @@`,
    ...oldLines.filter((_, index) => index < oldLines.length - 1 || oldContent.endsWith('\n') === false).map(line => `-${line}`),
    ...newLines.filter((_, index) => index < newLines.length - 1 || newContent.endsWith('\n') === false).map(line => `+${line}`),
    '',
  ].join('\n')
}

export function buildPatch({ root, edits, cssFile }) {
  const patches = []
  const cssPath = path.resolve(root, cssFile)
  const oldCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''
  const newCss = buildCssOverrides(edits)
  if (newCss.trim()) {
    patches.push(buildUnifiedDiff(cssFile, oldCss, newCss))
  }

  const { changed, skipped } = applySourceTextEdits(root, edits)
  for (const [filePath, newContent] of changed.entries()) {
    const relativePath = path.relative(root, filePath)
    const oldContent = fs.readFileSync(filePath, 'utf8')
    patches.push(buildUnifiedDiff(relativePath, oldContent, newContent))
  }

  return {
    patch: patches.join('\n'),
    skipped,
  }
}

export function applyPatchPlan({ root, edits, cssFile }) {
  const cssPath = path.resolve(root, cssFile)
  fs.mkdirSync(path.dirname(cssPath), { recursive: true })
  fs.writeFileSync(cssPath, buildCssOverrides(edits), 'utf8')

  const { changed, skipped } = applySourceTextEdits(root, edits)
  for (const [filePath, content] of changed.entries()) {
    fs.writeFileSync(filePath, content, 'utf8')
  }

  return {
    cssFile,
    sourceFiles: Array.from(changed.keys()).map(filePath => path.relative(root, filePath)),
    skipped,
  }
}
