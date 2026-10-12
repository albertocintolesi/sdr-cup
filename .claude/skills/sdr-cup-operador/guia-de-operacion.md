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

También puedes hacerlo sin pasar por el grupo: en **Run now** hay un cuadro de texto; lo que escribas ahí llega al Operador como instrucción tuya ("Suma 1 punto al Squad 2 por la reunión de Isidora del martes").

Tus resúmenes de puntaje en el grupo no cambian el marcador. Si tu cuenta no coincide con la página, el Operador te escribe para aclararlo. Nada se borra: toda corrección queda como un movimiento nuevo y visible.

## 6. Cerrar la Cup

El viernes a las 17:00 el marcador deja de sumar solo. Lo que llegue después queda en revisión.

1. Tras el cierre recibirás un correo **[SDR Cup #3] Cierre: resultado por confirmar** con el marcador, lo que quedó en revisión y las misiones que alguien cumplió sin declararlas.
2. Responde ese correo con: qué casos suman, qué squad logra cada legendario (+5.000 colaboradores y seniority ≥ 1,5, 10 puntos cada uno) y la frase **"el resultado es definitivo"**.
3. Recién ahí la página muestra al ganador. Antes dice "resultado en revisión", aunque hayas publicado puntajes finales en el grupo.

## Datos de la rutina

- **Nombre:** SDR Cup #3 · Operador. Se ve y se edita en https://claude.ai/code/routines/trig_01GsAJj1qLi1Cquy91ZLh49v (con tu cuenta de Claude).
- **Horario:** minuto 7 de cada hora, de 10:07 a 19:07, del martes 13 al viernes 16 de octubre, hora de Chile. Primera corrida: martes 13 a las 10:07.
- **Accesos:** Google Drive (leer los exports) y Gmail (escribirte y leer tu respuesta). Ningún otro conector.
- **Dónde escribe:** solo en la rama `estado` del repo de la página y en la rama `registro` del repo privado. Nunca en `main`.
- **Para pausarla:** en esa misma página, el interruptor de encendido. Para borrarla al terminar la Cup: menú → Delete.

## Si algo falla

- **El marcador no se mueve:** revisa que el export esté en Data SDRC y que el nombre del grupo calce. Luego Run now.
- **Un punto mal asignado:** corrígelo como en el punto 5.
- **Dudas sobre qué hizo una corrida:** en claude.ai/code/routines, cada corrida deja un resumen con el export procesado, los eventos nuevos y los pendientes.
