import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Fill } from '../types'

const fill = atom({ plugin: 'context-bar', key: 'fill' } as const, null, { shape: 'fill-1' })
const isOpen = atom({ plugin: 'context-bar', key: 'isOpen' } as const, false)

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

async function measure($: EngineInterface): Promise<void> {
  const u = await $.session.usage({ breakdown: 'summary' })
  const c = u.context
  const b = c.breakdown
  const tokens = c.tokens ?? b?.totalTokens ?? 0
  const window = c.window || b?.rawMaxTokens || 0
  if (!window) return
  const top = (b?.categories ?? [])
    .filter(x => x.kind === 'used' && x.tokens > 0)
    .sort((a, z) => z.tokens - a.tokens)
    .slice(0, 5)
    .map(x => ({ name: x.name, tokens: x.tokens }))
  const value: Fill = {
    tokens,
    window,
    percent: c.percent ?? Math.round((tokens / window) * 100),
    top,
    compactAt: b?.isAutoCompactEnabled && b.autoCompactThreshold ? b.autoCompactThreshold : null,
  }
  await update($, fill, () => value)
}

function advice(f: Fill): { text: string; color?: string } {
  if (f.percent >= 80) return { text: 'Empezá otra conversación (/clear) o resumí (/compact)', color: 'error' }
  if (f.percent >= 60) return { text: 'Se está llenando: cerrá esta tarea y después empezá otra', color: 'warning' }
  return { text: 'Hay lugar de sobra' }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await measure($)
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await measure($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, fill)
    if (e.props.hasSurvey || !f || f.tokens === 0) return next(e)
    const { Box, Button, Progress, Text } = $.ui.resolve(e)
    const open = await read($, isOpen)
    const tip = advice(f)
    return (
      <Box flexDirection="column">
        <Box>
          <Progress label="Contexto" value={f.percent} max={100}
            valueText={`${f.percent}% · ${k(f.tokens)}/${k(f.window)}`}
            color={f.percent >= 80 ? 'error' : f.percent >= 60 ? 'warning' : 'success'} />
          <Text color={tip.color} dimColor={!tip.color}> {tip.text} </Text>
          <Button key="detalle" plain label={open ? '▾ ocultar' : '▸ qué ocupa'}
            onPress={() => update($, isOpen, v => !v)} />
        </Box>
        {open && f.top.map(s => (
          <Text key={s.name} dimColor>   {s.name}: {k(s.tokens)} ({Math.round((s.tokens / f.window) * 100)}%)</Text>
        ))}
        {open && f.compactAt !== null && (
          <Text dimColor>   Se resume solo al llegar a {k(f.compactAt)}</Text>
        )}
      </Box>
    )
  })
}
