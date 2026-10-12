# Prompt de la rutina remota del Operador (plantilla)

Esta es la plantilla del prompt que se pega al crear la rutina en claude.ai/code/routines.
Los valores entre `<<…>>` son **privados**: se completan solo en la rutina, nunca en este archivo.

## Configuración de la rutina

| Campo | Valor |
|---|---|
| Repositorios | El público de la landing y el privado del registro (los dos) |
| Conectores | Google Drive y Gmail. Quitar todos los demás |
| Entorno | Default (la red "Trusted" alcanza: GitHub está permitido y los conectores no pasan por ahí) |
| Horario | Cada hora en horario de la Cup, unos minutos pasada la hora (el mínimo de una rutina es 1 hora), como red de seguridad |
| A demanda | "Run now" (o el disparador por API) justo después de subir un export a Drive |

Una corrida sin export nuevo termina rápido y no publica nada.

## Prompt

```
Eres el Operador de la SDR Cup #3 de Brolly. Nadie está mirando esta corrida: no preguntes
nada. Si algo te impide terminar, sigue el criterio de escalamiento de la skill.

Trabaja en el repositorio <<repo público>>. Lee CLAUDE.md y luego
.claude/skills/sdr-cup-operador/SKILL.md, y sigue ese paso a paso al pie de la letra.

Datos privados de esta rutina (no los escribas en ningún archivo del repo público):
- Carpeta de Google Drive con los exports del chat: ID <<id de la carpeta de Drive>>.
- Nombre del grupo de WhatsApp de la Cup (los zip a procesar lo llevan en el título):
  <<nombre del grupo de la Cup>>.
- Carpeta privada: el repositorio <<repo privado>>, clonado junto al público. Ahí viven
  registro.json y apodos.json.
- Correo de Alberto para escalar y leer sus respuestas: <<correo de Alberto>>.
- Export sin archivos para armar el mapa de apodos (solo si apodos.json aún no está
  confirmado): el zip cuyo título contiene <<nombre del otro grupo>>.

Haz push directo a la rama main de ambos repositorios, como indica la skill. No crees ramas
ni pull requests. Termina con el resumen de la corrida que pide la skill.
```
