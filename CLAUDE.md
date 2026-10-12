# SDR Cup Landing Page

Landing page liviana que muestra en vivo el estado de la SDR Cup de Brolly. La página no tiene lógica: solo renderiza un archivo de estado que genera un agente de Claude a partir del chat de WhatsApp del equipo.

## Contexto

**Brolly.** Fintech chilena. Ofrece a las empresas un beneficio gratuito de bienestar financiero para sus colaboradores. El negocio es el crédito a esos trabajadores. Brolly crece sumando empresas con convenio: más colaboradores bajo convenio, más mercado.

**Equipo comercial.** El área de BizDev se organiza en squads de SDRs, liderados por Alberto Cintolesi. Los SDRs hacen cold calling a jefaturas y gerencias de RR.HH., Personas y Finanzas en empresas chilenas de 100 a 5.000 colaboradores. Su trabajo termina al agendar la reunión, que luego toma el founding team. El líder se encarga del CRM (un Google Sheet), la carga de leads y el mailing.

**Métricas que importan.**
- Reuniones agendadas.
- Reuniones realizadas.
- Nivel de seniority de las contrapartes.
- Puntos (exclusivo de la Cup).

**Por qué existe la Cup.** El rol de SDR es individual y monótono. La Cup es una competencia corta entre squads que empuja la actividad y las reuniones, y le da al equipo competencia sana y sentido de equipo. La #1 (feb 2026, 1 semana) generó 21 reuniones agendadas. La #2 (mayo 2026, 2 semanas) terminó 59 a 41. Aprendizaje clave: ver la tabla de posiciones moviéndose mantiene a todos activos hasta el último día. Esa es la razón de ser de esta página.

## La Cup #3: lo esencial de las bases

- **Formato.** Squad 1 vs Squad 2, una semana hábil, cierre el viernes a las 17:00. Gana el squad con más puntos, con un mínimo de 20.
- **Fechas.** Parte el martes 13 de octubre de 2026 y cierra el viernes 16 a las 17:00.
- **Squad 1.** Matías Palma, Matías Hernández, Matías Rauque, Benjamín Allel.
- **Squad 2.** Isidora B., Alberto M., Pedro Pablo M., Alberto Cintolesi.
- **Por confirmar.** Premio y nombres de los squads.

| Capa | Puntos | Regla |
|---|---|---|
| Reunión agendada | +1 | Invitación de calendar creada con el lead |
| Reunión agendada y realizada | +2 | Agendada y realizada dentro de la semana de la Cup |
| Combo diario | +2 al squad | 2 o más integrantes agendan al menos una reunión el mismo día |
| Misión diaria | Variable | Una por día, se revela en la mañana, dura hasta el fin del día. No exclusiva |
| Flash Challenge | Variable | Sin aviso, con ventana de tiempo. Solo el primer squad que la cumple suma |
| Legendario: +5.000 colaboradores | +10 | Suma de colaboradores de las empresas con reuniones agendadas y realizadas en la Cup |
| Legendario: seniority ≥ 1,5 | +10 | Seniority promedio del squad en esas mismas reuniones |

**Filtros de calidad.** Solo cuentan empresas de más de 100 colaboradores y leads no junior. Si una reunión realizada resulta no calificada, cuenta solo +1. Las reuniones que llegan por mailing no suman. Escala de seniority del CRM: 2 = gerencia o superior, 1 = jefatura o encargado, junior = no suma.

**Validación.** Un punto existe solo si el SDR envía al grupo una captura de la invitación de calendar dentro de los 30 minutos siguientes al agendamiento. Si cumple una misión, el mensaje lleva "Misión completada: [detalle]". Si cumple un Flash, lleva "Flash Challenge: [nombre]". Las bases no cambian durante la Cup.

## Arquitectura

```
Grupo de WhatsApp  →  Export a Drive  →  Operador  →  Estado de la Cup  →  Landing page
(fuente única)        (Alberto, desde    (rutina       (eventos +           (solo lectura,
                       su iPhone)         remota)       totales)             sin lógica)
```

1. **Fuente.** Un grupo de WhatsApp dedicado a la Cup #3 es la única fuente de datos. Ahí ocurren las capturas, los anuncios de misiones y Flash y los avisos de reuniones realizadas. No se usa el CRM.
2. **Entrega del chat.** Alberto exporta el chat desde su iPhone, con archivos incluidos, y lo sube a la carpeta `Data SDRC` de su Google Drive. Cada export trae el historial completo del grupo.
3. **Operador.** Es la única pieza con lógica. Corre como rutina remota, sin depender de la máquina local: toma el export nuevo, procesa solo los mensajes que no ha visto, aplica las reglas y publica el estado. Guarda un registro persistente de lo ya digerido para no releer todo el chat en cada corrida.
4. **Estado de la Cup.** Un archivo de datos con los eventos y los totales ya calculados. Es el contrato entre el Operador y la página.
5. **Landing page.** Sitio estático publicado desde un repositorio público de GitHub (`albertocintolesi/sdr-cup`). Lee el estado y lo muestra. No calcula ni valida nada.

**Principios del Operador.**
- Cada mensaje se procesa una sola vez. Los eventos se agregan, nunca se sobrescriben.
- Decide de forma autónoma, con reglas predefinidas, usando solo lo que ve en el chat.
- Toda reunión con captura se considera calificada, salvo que el chat diga lo contrario. Cuenta como realizada solo si alguien lo avisa en el chat.
- Los combos diarios los deduce por su cuenta. Los legendarios no los calcula: se revisan con Alberto al cierre.
- Las correcciones de Alberto entran como eventos de ajuste manual, con su origen.
- Escala a Alberto, por correo, solo lo que genere muchas dudas o sea realmente inconsistente y no se pueda deducir del chat. Lo ambiguo menor lo marca para revisión y no lo inventa.
- Cada evento guarda su origen (mensaje, autor, hora) para poder auditarlo.

**Repositorio público.** Nunca se suben exports del chat, capturas, apodos de contactos ni direcciones de correo. Lo privado vive en Drive o en el prompt de la rutina.

## Equipo de agentes

Cada agente es una sesión propia de Claude Code. Los agentes reportan al Orquestador y el Orquestador a Alberto.

| Agente | Función | Modo |
|---|---|---|
| Ingeniero de datos | Construye el sistema de datos (del export al estado) y lo empaqueta en skills sin scripts locales | On demand |
| Constructor | Construye y mantiene la landing | On demand |
| Tester | Prueba y depura lo que construyen los otros; reporta al Orquestador | On demand |
| Operador | Ejecuta el sistema de datos en producción durante la Cup | Recurrente |
| Orquestador | Product Owner: prepara contexto, revisa cada fase y decide con Alberto | Permanente |

- Quien construye no prueba su propio sistema: se lo pide al Tester.
- Cada agente trabaja en su propia rama. La integración a `develop` y a `main` la hace el Orquestador.
