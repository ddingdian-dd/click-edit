const path = require('node:path')

const clientEntry = path.resolve(__dirname, '../runtime/next-client.mjs')

function injectClientEntry(entry) {
  if (Array.isArray(entry)) {
    return entry.includes(clientEntry) ? entry : [clientEntry, ...entry]
  }
  if (typeof entry === 'string') {
    return entry === clientEntry ? entry : [clientEntry, entry]
  }
  return entry
}

function withClickEdit(nextConfig = {}, options = {}) {
  const userWebpack = nextConfig.webpack

  return {
    ...nextConfig,
    turbopack: nextConfig.turbopack || {},
    webpack(config, context) {
      if (context.dev && !context.isServer && options.enabled !== false) {
        const originalEntry = config.entry
        config.entry = async () => {
          const entries = await originalEntry()
          if (options.debug) {
            console.log('[click-edit] client entries:', Object.keys(entries))
          }
          for (const name of Object.keys(entries)) {
            entries[name] = injectClientEntry(entries[name])
          }
          return entries
        }
      }

      return userWebpack ? userWebpack(config, context) : config
    },
  }
}

module.exports = withClickEdit
module.exports.withClickEdit = withClickEdit
