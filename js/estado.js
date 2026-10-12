/* Carga del estado de la Cup.
   La página no calcula puntos ni valida nada: solo lee el archivo que publica
   el Operador y se lo entrega a quien lo muestra.

   Uso:
     EstadoCup.iniciar(function (info) { ... });

   "info" trae:
     estado     el contenido del archivo, o null si no hay nada que mostrar
     situacion  'al_dia'      se leyó bien en el último intento
                'guardado'    falló la lectura; es la última copia buena de este navegador
                'sin_estado'  falló la lectura y no hay copia
     ejemplo    true si se está mostrando un estado de ejemplo (?estado=en-curso)
     error      texto del último problema, o null */
(function () {
	'use strict';

	// ---------- Configuración ----------
	// Único lugar donde se define de dónde sale el estado. El Operador lo publica
	// en la rama "estado" del repositorio; GitHub puede tardar unos 5 minutos en
	// entregar la versión nueva. También sirve una ruta del mismo sitio.
	const URL_ESTADO = 'https://raw.githubusercontent.com/albertocintolesi/sdr-cup/estado/datos/estado.json';
	const CARPETA_EJEMPLOS = 'datos/ejemplos/';
	const VERSION = 1;					// versión del contrato que entiende esta página
	const CADA_MS = 5 * 60 * 1000;		// cada cuánto se vuelve a leer
	const MINIMO_ENTRE_LECTURAS_MS = 60 * 1000;
	const ESPERA_MAXIMA_MS = 15 * 1000;
	const CLAVE_COPIA = 'sdr-cup:estado';

	// ?estado=en-curso lee datos/ejemplos/estado-en-curso.json. Sirve para maquetar y probar.
	const ejemplo = (function () {
		const pedido = new URLSearchParams(window.location.search).get('estado');
		return pedido && /^[a-z-]+$/.test(pedido) ? pedido : null;
	})();
	const direccion = ejemplo ? CARPETA_EJEMPLOS + 'estado-' + ejemplo + '.json' : URL_ESTADO;

	let avisar = null;
	let ultimoTexto = null;		// para no avisar si el archivo no cambió
	let ultimaSituacion = null;
	let estadoActual = null;
	let ultimoIntento = 0;
	let leyendo = false;

	// Revisa que el archivo tenga la forma mínima que la página necesita.
	// Devuelve un texto con el problema, o null si está bien.
	function problemaDe(datos) {
		if (!datos || typeof datos !== 'object') return 'El estado no es un objeto';
		if (Math.floor(Number(datos.version)) !== VERSION) return 'Versión de estado no soportada: ' + datos.version;
		if (!datos.cup || typeof datos.cup !== 'object') return 'Falta "cup"';
		if (isNaN(new Date(datos.cup.inicio)) || isNaN(new Date(datos.cup.cierre))) return 'Fechas de la Cup inválidas';
		if (isNaN(new Date(datos.actualizado))) return 'Falta la hora de actualización';
		if (!Array.isArray(datos.squads) || !Array.isArray(datos.eventos)) return 'Faltan "squads" o "eventos"';
		return null;
	}

	function interpretar(texto) {
		let datos;
		try {
			datos = JSON.parse(texto);
		} catch (fallo) {
			throw new Error('El estado no es JSON válido');
		}
		const problema = problemaDe(datos);
		if (problema) throw new Error(problema);
		return datos;
	}

	// La copia local puede no estar disponible (modo privado, almacenamiento lleno)
	function guardarCopia(texto) {
		if (ejemplo) return;
		try {
			window.localStorage.setItem(CLAVE_COPIA, texto);
		} catch (fallo) { /* sin copia: no es grave */ }
	}

	function leerCopia() {
		if (ejemplo) return null;
		try {
			const texto = window.localStorage.getItem(CLAVE_COPIA);
			return texto ? { texto: texto, datos: interpretar(texto) } : null;
		} catch (fallo) {
			return null;
		}
	}

	function publicar(situacion, error) {
		if (situacion === ultimaSituacion && situacion !== 'al_dia') return;
		ultimaSituacion = situacion;
		if (avisar) {
			avisar({ estado: estadoActual, situacion: situacion, ejemplo: !!ejemplo, error: error || null });
		}
	}

	function leer() {
		if (leyendo) return Promise.resolve();
		leyendo = true;
		ultimoIntento = Date.now();

		const control = 'AbortController' in window ? new AbortController() : null;
		const limite = setTimeout(function () {
			if (control) control.abort();
		}, ESPERA_MAXIMA_MS);
		// El parámetro "t" evita recibir una copia vieja guardada por el navegador
		const conSello = direccion + (direccion.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();

		return fetch(conSello, { cache: 'no-store', signal: control ? control.signal : undefined })
			.then(function (respuesta) {
				if (!respuesta.ok) throw new Error('El estado respondió ' + respuesta.status);
				return respuesta.text();
			})
			.then(function (texto) {
				const datos = interpretar(texto);
				const cambio = texto !== ultimoTexto;
				ultimoTexto = texto;
				estadoActual = datos;
				guardarCopia(texto);
				if (cambio || ultimaSituacion !== 'al_dia') {
					ultimaSituacion = null;
					publicar('al_dia');
				}
			})
			.catch(function (fallo) {
				const motivo = fallo && fallo.name === 'AbortError' ? 'El estado tardó demasiado en responder' : String(fallo && fallo.message || fallo);
				// Se conserva lo último bueno: lo ya mostrado o, si no hay, la copia de este navegador
				if (!estadoActual) {
					const copia = leerCopia();
					if (copia) {
						estadoActual = copia.datos;
						ultimoTexto = copia.texto;
					}
				}
				publicar(estadoActual ? 'guardado' : 'sin_estado', motivo);
			})
			.then(function () {
				clearTimeout(limite);
				leyendo = false;
			});
	}

	function iniciar(alCambiar) {
		avisar = alCambiar;
		leer();
		setInterval(function () {
			if (!document.hidden) leer();
		}, CADA_MS);
		// Al volver a la pestaña se lee de nuevo, sin insistir más de una vez por minuto
		document.addEventListener('visibilitychange', function () {
			if (!document.hidden && Date.now() - ultimoIntento > MINIMO_ENTRE_LECTURAS_MS) leer();
		});
	}

	// Minutos transcurridos desde una fecha del estado (por ejemplo, "actualizado")
	function minutosDesde(fecha) {
		return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
	}

	window.EstadoCup = {
		iniciar: iniciar,
		recargar: leer,
		minutosDesde: minutosDesde,
		direccion: direccion
	};
})();
