import type { MarkdocApi } from '../preload/index'

declare global {
  interface Window {
    markdoc: MarkdocApi
  }
}

export {}
