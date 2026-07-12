/** Minimal ambient typings for the subset of the SimpleMDE API MarkDoc uses. */
declare module 'simplemde/dist/simplemde.min.js' {
  interface SimpleMDEOptions {
    element?: HTMLTextAreaElement
    initialValue?: string
    autofocus?: boolean
    spellChecker?: boolean
    toolbar?: boolean | unknown[]
    status?: boolean | unknown[]
  }

  interface CodeMirrorPosition {
    line: number
    ch: number
  }

  interface CodeMirrorDoc {
    setCursor(position: CodeMirrorPosition): void
  }

  interface CodeMirrorInstance {
    on(event: string, handler: (...args: unknown[]) => void): void
    getDoc(): CodeMirrorDoc
    posFromIndex(index: number): CodeMirrorPosition
    scrollIntoView(position: CodeMirrorPosition, margin?: number): void
    getScrollInfo(): { top: number; height: number; clientHeight: number }
    scrollTo(x: number | null, y: number): void
    focus(): void
    getWrapperElement(): HTMLElement
  }

  export default class SimpleMDE {
    constructor(options?: SimpleMDEOptions)
    codemirror: CodeMirrorInstance
    value(): string
    value(content: string): void
    toTextArea(): void
  }
}
