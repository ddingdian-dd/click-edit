import { initClickEdit } from './overlay.mjs'

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const boot = () => window.setTimeout(() => initClickEdit(), 500)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  } else {
    boot()
  }
}
