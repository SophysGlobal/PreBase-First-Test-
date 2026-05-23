import type { PrebaseAPI } from '../../preload/index'

declare global {
  interface Window {
    prebase: PrebaseAPI
  }
}

export {}
