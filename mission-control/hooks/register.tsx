import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Activity, Row } from '../types'

const PANE = 'mission-control'
const rows = atom({ plugin: 'mission-control', key: 'rows' } as const, [], { shape: 'rows-1' })
const activity = atom({ plugin: 'mission-control', key: 'activity' } as const, {}, { shape: 'activity-1' })
const now = atom({ plugin: 'mission-control', key: 'now' } as const, 0)

const ICON: Record<string, string> = {
  pending: '…', running: '●', waiting: '◐', idle: '○', completed: '✔', failed: '✘', killed: '■',
}
const ACTIVE = new Set(['pending', 'running', 'waiting'])

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

function detailOf(input: Record<string, unknown>): string {
  for (const key of ['description', 'command', 'file_path', 'pattern', 'url', 'query', 'prompt']) {
    const v = input[key]
    if (typeof v === 'string' && v) return v.replace(/\s+/g, ' ').slice(0, 60)
  }
  return ''
}

async function refresh($: EngineInterface): Promise<boolean> {
  const list = await $.agent.list()
  const next: Row[] = list.map(a => ({
    id: a.id,
    label: a.name ?? a.description ?? a.type,
    type: a.type,
    status: a.status,
    parentId: a.parentId ?? null,
  }))
  await update($, rows, prev => {
    // conserva los que el motor ya soltó, como terminados
    const gone = prev.filter(p => !next.some(n => n.id === p.id))
      .map(p => (ACTIVE.has(p.status) ? { ...p, status: 'completed' } : p))
    return [...gone, ...next].slice(-30)
  })
  const t = await $.clock.now()
  await update($, now, () => t)
  return next.some(n => ACTIVE.has(n.status))
}

let stop: Timer | null = null

async function watch($: EngineInterface): Promise<void> {
  if (stop) return
  stop = $.clock.every(1000, () => {
    void refresh($).then(isBusy => {
      if (!isBusy && stop) {
        stop.cancel()
        stop = null
      }
    })
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agentes', description: 'Abre Mission control: los agentes trabajando en vivo' })
    return next(e)
  })

  on('command.run', { command: 'agentes' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Mission control' })
    return { text: 'Mission control abierto.', isTextDisplayOnly: true }
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = 'agentId' in r ? r.agentId : undefined
    if (id) {
      const t = await $.clock.now()
      await update($, activity, a => ({ ...a, [id]: { tool: 'arrancando', detail: e.description, at: t, count: 0, startedAt: t } }))
      void $.ui.open({ id: PANE, title: 'Mission control' })
      await refresh($)
      await watch($)
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId) {
      const id = e.agentId
      const t = await $.clock.now()
      const detail = detailOf(e as unknown as Record<string, unknown>)
      await update($, activity, a => {
        const old: Activity | undefined = a[id]
        return { ...a, [id]: { tool: e.tool, detail, at: t, count: (old?.count ?? 0) + 1, startedAt: old?.startedAt ?? t } }
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const acts = await read($, activity)
    const t = await read($, now)
    const running = list.filter(r => ACTIVE.has(r.status)).length
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 3) / 2))
    return (
      <Box flexDirection="column">
        <Text bold>{running ? `${running} trabajando` : 'Nadie trabajando'} · {list.length} en total</Text>
        {list.length === 0 && <Text dimColor>Todavía no se lanzó ningún agente. Se abre solo cuando arranque uno.</Text>}
        {list.slice(-room).reverse().map(r => {
          const a = acts[r.id]
          const isActive = ACTIVE.has(r.status)
          const color = r.status === 'failed' ? 'error' : isActive ? 'success' : undefined
          return (
            <Box key={r.id} flexDirection="column">
              <Text color={color} dimColor={!isActive}>
                {ICON[r.status] ?? '?'} {r.parentId ? '  ↳ ' : ''}{r.label} <Text dimColor>({r.type}{a ? ` · ${ago(t - a.startedAt)} · ${a.count} herramientas` : ''})</Text>
              </Text>
              {a && isActive && (
                <Text dimColor>    {a.tool}{a.detail ? `: ${a.detail}` : ''} · hace {ago(t - a.at)}</Text>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
