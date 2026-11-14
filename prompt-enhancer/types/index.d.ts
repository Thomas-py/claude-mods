declare module 'claude-code' {
  interface PluginState {
    'prompt-enhancer': { hasDraft: boolean; isBusy: boolean; undo: string | null }
  }
}
export type Draft = string
