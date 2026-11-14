export type Warned = { window: string; level: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { warned: Warned[] }
  }
}
