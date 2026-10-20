# Guía de operación de la SDR Cup #3 (para Alberto)

El marcador se actualiza solo. Tu parte es subir el chat y responder cuando el Operador te pregunte.

## 1. Subir el chat

1. En el iPhone abre el grupo de la Cup → toca el nombre del grupo → **Exportar chat** → **Adjuntar archivos**.
2. Guárdalo en Google Drive, en la carpeta **Data SDRC**. No le cambies el nombre al archivo.
3. Listo. Cada export trae todo el historial; el Operador procesa solo lo nuevo. No importa que queden exports anteriores en la carpeta.

Evita videos en el grupo: inflan el archivo y la descarga puede fallar.

## 2. Actualizar el marcador al tiro

La rutina corre sola una vez por hora (al minuto 7, de 10:00 a 19:00). Para no esperar:

1. Entra a **claude.ai/code/routines** y abre **SDR Cup #3 · Operador**.
2. Toca **Run now**.

Tarda unos 2 minutos. La página puede demorar hasta 5 minutos más en mostrarlo, por la caché de GitHub. Si no subiste un export nuevo, la corrida termina en menos de un minuto y no cambia nada: es lo esperado.

## 3. Cambiar el nombre del grupo

La rutina busca el export por el nombre del grupo de WhatsApp. Al crear el grupo:

1. En la rutina, toca **Edit**.
2. Busca la línea `NOMBRE_DEL_GRUPO = …` y escribe el nombre tal como aparece en el nombre del archivo exportado (basta una parte que no se repita en otros archivos de la carpeta).
3. Guarda. Mientras esa línea diga PENDIENTE, la rutina no procesa nada.

## 4. Cuando el Operador te pregunta

Solo escribe si algo es realmente inconsistente (por ejemplo, dos SDRs suben la misma empresa). Llega un correo con asunto **[SDR Cup #3] Consulta del Operador**, con las dudas numeradas.

- Responde **en ese mismo correo**, desde tu correo personal, una línea por duda: "1. Sí suma", "2. No".
- Mientras no respondas, ese caso queda "en revisión" y no suma.
- La respuesta se aplica en la siguiente corrida.

## 5. Corregir un puntaje

Escríbelo en el grupo, claro y con el nombre o la empresa. Se aplica con el siguiente export:

- "La de [empresa] no suma, el lead es junior." → se anula esa reunión.
- "Le resto 1 punto al Squad 1 por…" o "Le sumo 2 al Squad 2 por…" → ajuste con ese número exacto.
- "Sí cuenta la de [empresa]." → se confirma algo que estaba en revisión.

También puedes hacerlo sin pasar por el grupo: en **Run now** hay un cuadro de texto; lo que escribas ahí llega al Operador como instrucción tuya. Escríbela una sola vez: si la repites en otra corrida, se podría aplicar dos veces ("Suma 1 punto al Squad 2 por la reunión de Isidora del martes").

**Misión del día y Flash Challenge.** No hace falta anunciarlos en el grupo: ese mismo cuadro de **Run now** sirve para publicarlos en la página ("Misión de hoy: Primer saque. La primera reunión que agende cada integrante suma 1 punto adicional"). Un Flash necesita su ventana ("de 15:00 a 16:00"); sin ella no se publica y el Operador te pregunta. Hay una sola misión por día: si mandas otra, no entra. El SDR igual tiene que escribir "Misión completada: …" en el grupo para sumar. Si prefieres anunciarlos en el grupo, sigue funcionando como siempre.

**Flash Challenge sorteados.** Además, el Operador lanza solo los Flash que dejaste definidos, a una hora al azar. Ni tú sabes cuándo ni cuál: no abras `flash.json` en el repo privado. Cuando cae uno te llega un correo **[SDR Cup #3] Se lanzó un Flash Challenge**, sin el contenido: avisa al grupo que revise la landing. Queda abierto hasta que un squad lo cumpla y lo declare en el grupo ("Flash Challenge: …"), o hasta el cierre.

Un Flash marcado como "mejor del día" (por ejemplo, Heavyweight) dura hasta el fin de ese día y lo decides tú: al terminar la ventana te llega un correo **[SDR Cup #3] Flash "…": elige al ganador** con los candidatos (squad, SDR, empresa y colaboradores declarados). Responde en ese correo qué squad gana, o "no gana nadie". También puede decidirlo el Orquestador al lanzar la rutina ("Heavyweight: gana Squad 2").

Tus resúmenes de puntaje en el grupo no cambian el marcador. Si tu cuenta no coincide con la página, el Operador te escribe para aclararlo. Nada se borra: toda corrección queda como un movimiento nuevo y visible.

## 6. Cerrar la Cup

El martes 20 de octubre a las 23:59:59 el marcador deja de sumar solo (`cup.cierre`). Lo que llegue después queda en revisión; las reuniones realizadas avisadas hasta el viernes 23 a las 17:00 (`cup.cierre_final`) se confirman en el conteo final.

1. Tras el cierre final (viernes 23, 17:00) recibirás un correo **[SDR Cup #3] Cierre: resultado por confirmar** con el marcador, lo que quedó en revisión y las misiones que alguien cumplió sin declararlas.
2. Responde ese correo con: qué casos suman, qué squad logra cada legendario (+5.000 colaboradores y seniority ≥ 1,5, 10 puntos cada uno) y la frase **"el resultado es definitivo"**. Después toca **Run now**: la rutina deja de correr sola el viernes 23 a las 19:07.
3. Recién ahí la página muestra al ganador. Antes dice "resultado en revisión", aunque hayas publicado puntajes finales en el grupo.

## Datos de la rutina

- **Nombre:** SDR Cup #3 · Operador. Se ve y se edita en claude.ai/code/routines → SDR Cup #3 · Operador (con tu cuenta de Claude).
- **Horario:** minuto 7 de cada hora, de 10:07 a 19:07, del martes 13 al viernes 16 y del lunes 19 al viernes 23 de octubre, hora de Chile (extensión). Primera corrida: martes 13 a las 10:07.
- **Accesos:** Google Drive (leer los exports) y Gmail (escribirte y leer tu respuesta). Ningún otro conector.
- **Dónde escribe:** solo en la rama `estado` del repo de la página y en la rama `registro` del repo privado. Nunca en `main`.
- **Para pausarla:** en esa misma página, el interruptor de encendido. Para borrarla al terminar la Cup: menú → Delete.

## Si algo falla

- **El marcador no se mueve:** revisa que el export esté en Data SDRC y que el nombre del grupo calce. Luego Run now.
- **Un punto mal asignado:** corrígelo como en el punto 5.
- **Dudas sobre qué hizo una corrida:** en claude.ai/code/routines, cada corrida deja un resumen con el export procesado, los eventos nuevos y los pendientes.
