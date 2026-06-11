#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { applyPatchPlan, buildPatch, normalizeEdits } from './patcher.mjs'

function parseArgs(argv) {
  const args = { _: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) {
      args._.push(item)
      continue
    }
    const key = item.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      index += 1
    }
  }
  return args
}

function readEdits(filePath) {
  return normalizeEdits(JSON.parse(fs.readFileSync(filePath, 'utf8')))
}

function printHelp() {
  console.log(`
Visual Page Editor CLI

Usage:
  vpe patch --edits visual-edits.json --root . --out visual-editor.patch
  vpe apply --edits visual-edits.json --root . --css src/visual-editor-overrides.css
  vpe inspect --edits visual-edits.json

Options:
  --edits  Exported visual-edits.json file
  --root   Project root. Defaults to current directory
  --css    CSS override file path. Defaults to src/visual-editor-overrides.css
  --out    Patch output path. Defaults to visual-editor.patch
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]
  const root = path.resolve(args.root || process.cwd())
  const cssFile = args.css || 'src/visual-editor-overrides.css'

  if (!command || command === 'help' || args.help) {
    printHelp()
    return
  }

  if (!args.edits) {
    throw new Error('--edits is required')
  }

  const edits = readEdits(path.resolve(args.edits))

  if (command === 'inspect') {
    console.log(JSON.stringify({ count: edits.length, edits }, null, 2))
    return
  }

  if (command === 'patch') {
    const out = path.resolve(args.out || 'visual-editor.patch')
    const { patch, skipped } = buildPatch({ root, edits, cssFile })
    fs.writeFileSync(out, patch, 'utf8')
    console.log(`Patch written: ${out}`)
    if (skipped.length) console.log(`Skipped source text edits: ${skipped.length}`)
    return
  }

  if (command === 'apply') {
    const result = applyPatchPlan({ root, edits, cssFile })
    console.log(JSON.stringify(result, null, 2))
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
