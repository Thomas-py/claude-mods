import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const hasDraft = atom({ plugin: 'prompt-enhancer', key: 'hasDraft' } as const, false)
const isBusy = atom({ plugin: 'prompt-enhancer', key: 'isBusy' } as const, false)
const undo = atom({ plugin: 'prompt-enhancer', key: 'undo' } as const, null)

const SYSTEM = `Convertís una idea escrita en pocas palabras en un prompt completo para Claude Code (un agente que programa y trabaja en la compu del usuario).
Reglas:
- Respondé SOLO con el prompt final, sin explicaciones, sin comillas ni bloques de código alrededor.
- Mismo idioma que la idea.
- Estructura breve: objetivo, contexto, qué hay que hacer (pasos o requisitos), restricciones y cómo saber que está terminado.
- No inventes datos: si falta algo importante, escribilo como [completar: ...].
- Conciso: sin relleno ni frases de cortesía. Máximo ~250 palabras.`

async function enhance($: EngineInterface, idea: string): Promise<string> {
  if (!idea.trim() || (await read($, isBusy))) return 'Escribí una idea primero.'
  await update($, isBusy, () => true)
  $.ui.status('✨ mejorando prompt…')
  try {
    const r = await $.model.complete({
      model: 'sonnet',
      system: SYSTEM,
      prompt: `Idea:\n${idea}`,
      maxTokens: 1500,
      effort: 'low',
      timeoutMs: 60000,
    })
    if (!r.isAnswered) return `No se pudo mejorar (${r.reason}).`
    await update($, undo, () => idea)
    await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
    return 'Prompt mejorado: revisalo y mandalo.'
  } finally {
    await update($, isBusy, () => false)
    $.ui.status(undefined)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mejorar',
      description: 'Convierte tu idea (o lo escrito en el prompt) en un prompt completo',
    })
    return next(e)
  })

  on('command.run', { command: 'mejorar' }, async $ => {
    const idea = (await $.prompt.read()).text
    return { text: await enhance($, idea), isTextDisplayOnly: true }
  })

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    await update($, hasDraft, () => box.text.trim().length > 0)
    return box
  })

  on('prompt.change', async ($, e, next) => {
    await update($, hasDraft, () => e.text.trim().length > 0)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, undo, () => null)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const draft = await read($, hasDraft)
    const prev = await read($, undo)
    if (e.props.hasSurvey || (!draft && !prev)) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const busy = await read($, isBusy)
    return (
      <Box>
        {busy ? (
          <Text dimColor>✨ Mejorando prompt…</Text>
        ) : (
          <Button key="mejorar" label="✨ Mejorar prompt" variant="primary" onPress={async () => {
            const msg = await enhance($, (await $.prompt.read()).text)
            $.ui.toast(msg)
          }} />
        )}
        {prev !== null && !busy && (
          <Button key="deshacer" label="Deshacer" onPress={async () => {
            await $.prompt.fill({ text: prev, mode: 'replace' })
            await update($, undo, () => null)
          }} />
        )}
      </Box>
    )
  })
}
