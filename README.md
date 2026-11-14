# claude-mods

Cinco mods para Claude Code: Prompt Enhancer, Modelo justo, Usage meter, Context bar y Mission control.

## Instalación

En una sesión de Claude Code, por cada mod:

```
/plugin install prompt-enhancer --marketplace Thomas-py/claude-mods
/plugin install modelo-justo --marketplace Thomas-py/claude-mods
/plugin install usage-meter --marketplace Thomas-py/claude-mods
/plugin install context-bar --marketplace Thomas-py/claude-mods
/plugin install mission-control --marketplace Thomas-py/claude-mods
```

Te pide confirmar agregar el marketplace (`y`) y el alcance.

## Qué hace cada uno

- **prompt-enhancer:** botón `✨ Mejorar prompt` y comando `/mejorar`. Convierte tu idea en un prompt completo; `Deshacer` vuelve al original.
- **modelo-justo:** elige Haiku, Sonnet u Opus según la tarea. Se prende y apaga con `/modelo-justo`.
- **usage-meter:** uso de tu ventana de 5 horas y hora de reinicio en la línea de estado; avisa al 80% y al 95%.
- **context-bar:** cuánto ocupa la conversación, con consejo de cuándo empezar otra. `▸ qué ocupa` muestra el detalle.
- **mission-control:** panel en vivo con los agentes trabajando. Se abre con `/agentes` o al arrancar un agente.

Son de acceso anticipado: dependen de la API de mods de Claude Code 2.1.325 y pueden necesitar cambios si se actualiza.
