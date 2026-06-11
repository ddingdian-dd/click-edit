import { defineConfig } from 'vite'
import visualPageEditor from '../../src/plugins/vite.mjs'

export default defineConfig({
  plugins: [visualPageEditor()],
})
