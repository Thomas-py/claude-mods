import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

const warned = atom({ plugin: 'usage-meter', key: 'warned' } as const, [])

const NAMES: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'gasto' }

function bar(pct: number): string {
  const n = Math.max(0, Math.min(8, Math.round(pct / 12.5)))
  return '█'.repeat(n) + '░'.repeat(8 - n)
}

function left(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return ' · se reinicia ya'
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  return ` · reinicia en ${h ? `${h}h ` : ''}${min % 60}m`
}

async function paint($: EngineInterface, limits: readonly SessionRateLimit[]): Promise<void> {
  if (!limits.length) {
    $.ui.status(undefined)
    return
  }
  const now = await $.clock.now()
  const five = limits.find(l => l.kind === 'five_hour')
  const rest = limits.filter(l => l !== five)
  const parts: string[] = []
  if (five) parts.push(`5h ${bar(five.percentUsed)} ${Math.round(five.percentUsed)}%${left(five.resetsAt, now)}`)
  for (const l of rest) parts.push(`${NAMES[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%`)
  $.ui.status(parts.join('  |  '))

  for (const l of limits) {
    for (const level of [80, 95]) {
      if (l.percentUsed < level) continue
      const key = `${l.kind}:${l.resetsAt ?? ''}`
      const list = await read($, warned)
      if (list.some(w => w.window === key && w.level >= level)) continue
      await update($, warned, ws => [...ws.filter(w => w.window !== key), { window: key, level }].slice(-20))
      $.ui.toast(`Llevás ${Math.round(l.percentUsed)}% de tu ventana ${NAMES[l.kind] ?? l.kind}${left(l.resetsAt, now)}`)
    }
  }
}

export const register: Register = on => {
  let latest: readonly SessionRateLimit[] = []

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    latest = (await $.session.usage()).rateLimits
    await paint($, latest)
    // refresca la cuenta regresiva aunque no haya turnos
    $.clock.every(60000, () => void paint($, latest))
    return r
  })

  on('session.measure', async ($, e, next) => {
    latest = e.rateLimits
    await paint($, latest)
    return next(e)
  })
}
