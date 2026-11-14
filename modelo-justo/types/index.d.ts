export type Tier = 'haiku' | 'sonnet' | 'opus'

declare module 'claude-code' {
  interface PluginState {
    'modelo-justo': { isOn: boolean }
  }
}
