import { defineConfig } from 'vite'
import clickEdit from '../../src/plugins/vite.mjs'

export default defineConfig({
  plugins: [clickEdit()],
})
