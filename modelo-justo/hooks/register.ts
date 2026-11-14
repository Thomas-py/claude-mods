import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tier } from '../types'

const isOn = atom({ plugin: 'modelo-justo', key: 'isOn' } as const, true)

const LABELS = ['simple', 'media', 'dificil'] as const
const TIER: Record<string, Tier> = { simple: 'haiku', media: 'sonnet', dificil: 'opus' }

async function pick($: EngineInterface, task: string): Promise<Tier> {
  const text = `Tarea para un agente de programación. ¿Qué tan difícil es?
simple = pregunta corta, comando, cambio chico o mecánico, buscar algo, renombrar.
media = feature normal, bug acotado, editar varios archivos con un plan claro.
dificil = diseño o arquitectura, bug raro, refactor grande, razonamiento largo, ambigua.

Tarea:
${task.slice(0, 4000)}`
  try {
    const label = await $.model.classify(text, LABELS, { model: 'haiku' })
    return TIER[label ?? 'media'] ?? 'sonnet'
  } catch {
    return 'sonnet'
  }
}

export const register: Register = on => {
  let pending: Tier | null = null
  const byTurn = new Map<string, Tier>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'modelo-justo',
      description: 'Prende o apaga la elección automática de modelo (Haiku/Sonnet/Opus)',
    })
    return next(e)
  })

  on('command.run', { command: 'modelo-justo' }, async $ => {
    const now = !(await read($, isOn))
    await update($, isOn, () => now)
    if (!now) $.ui.status(undefined)
    return { text: now ? 'Modelo justo: prendido.' : 'Modelo justo: apagado (usa el modelo de /model).', isTextDisplayOnly: true }
  })

  on('prompt.submit', async ($, e, next) => {
    pending = null
    if (e.command || e.isMeta || e.turnId || !(await read($, isOn)) || !e.text.trim()) return next(e)
    pending = await pick($, e.text)
    $.ui.status(`modelo: ${pending}`)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId && pending) {
      byTurn.set(e.turnId, pending)
      pending = null
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const tier = e.agentId ? undefined : byTurn.get(e.turnId)
    return yield* next(tier ? { ...e, model: tier } : e)
  })

  on('turn.complete', async ($, e, next) => {
    byTurn.delete(e.turnId)
    return next(e)
  })

  // Subagentes: si nadie eligió modelo, se elige según la tarea.
  on('agent.spawn', async ($, e, next) => {
    if (e.model || e.subagentType === 'fork' || !(await read($, isOn))) return next(e)
    return next({ ...e, model: await pick($, `${e.description}\n${e.prompt}`) })
  })
}
