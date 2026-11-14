export type Activity = { tool: string; detail: string; at: number; count: number; startedAt: number }
export type Row = { id: string; label: string; type: string; status: string; parentId: string | null }

declare module 'claude-code' {
  interface PluginState {
    'mission-control': { rows: Shaped<Row[]>; activity: Shaped<Record<string, Activity>>; now: number }
  }
}
