export type Slice = { name: string; tokens: number }
export type Fill = { tokens: number; window: number; percent: number; top: Slice[]; compactAt: number | null }

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { fill: Shaped<Fill | null>; isOpen: boolean }
  }
}
