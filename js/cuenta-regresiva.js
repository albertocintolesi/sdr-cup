/* Reloj de la Cup y cuenta regresiva del inicio de la página.

   La fase (por iniciar, en curso, cerrada) se deduce del reloj del teléfono
   comparado con el inicio y el cierre de la Cup. Es solo presentación:
   el reloj nunca toca puntos ni declara un ganador.

   - Antes del inicio: cuenta hacia el inicio.
   - Durante la Cup: cuenta hacia el cierre.
   - Si el estado trae cierre final: tras el cierre del puntaje sigue en curso
     y cuenta hacia el cierre final (las reuniones realizadas aún suman).
   - Después del cierre: "Terminó" y el resultado que indique el estado.

   Las fechas parten de los <time> de index.html y se reemplazan con las del
   estado cuando llega (RelojCup.fijar). */
(function () {
	'use strict';

	const activa = document.getElementById('cuenta-activa');
	const terminada = document.getElementById('cuenta-terminada');
	const elInicio = document.getElementById('inicio-cup');
	const elCierre = document.getElementById('cierre-cup');
	if (!activa || !terminada || !elInicio || !elCierre) return;

	const MARCAS = 24;
	const avance = document.getElementById('avance');

	let inicio = new Date(elInicio.getAttribute('datetime')).getTime();
	let cierre = new Date(elCierre.getAttribute('datetime')).getTime();
	// Cierre final opcional: después del cierre del puntaje, las reuniones realizadas
	// siguen sumando hasta esta hora. Sin él, la Cup termina en el cierre.
	let cierreFinal = null;
	let resultado = 'Resultado en revisión';
	let desfase = 0;	// solo para probar: adelanta o atrasa el reloj
	let faseActual = null;
	const oyentes = [];

	// ?ahora=2026-10-14T15:30:00-03:00 simula otra hora, para pruebas
	const pedido = new URLSearchParams(window.location.search).get('ahora');
	if (pedido && !isNaN(new Date(pedido))) desfase = new Date(pedido).getTime() - Date.now();

	function ahora() {
		return Date.now() + desfase;
	}

	function fin() {
		return cierreFinal && cierreFinal > cierre ? cierreFinal : cierre;
	}

	function fase() {
		const t = ahora();
		return t < inicio ? 'por_iniciar' : t < fin() ? 'en_curso' : 'cerrada';
	}

	// Entre el cierre del puntaje y el cierre final
	function tramoFinal() {
		const t = ahora();
		return fin() > cierre && t >= cierre && t < fin();
	}

	// Lugares donde se escribe
	const lugares = {
		prefijo: document.getElementById('prefijo'),
		destino: document.getElementById('destino'),
		resultado: document.getElementById('resultado'),
		porcentaje: document.getElementById('porcentaje'),
		avanceRotulo: document.getElementById('avance-rotulo')
	};
	activa.querySelectorAll('[data-unidad]').forEach(function (el) {
		lugares[el.dataset.unidad] = el;
	});
	const escrito = {};

	// Solo toca la página cuando el texto cambia
	function escribir(lugar, texto) {
		if (!lugares[lugar] || escrito[lugar] === texto) return;
		escrito[lugar] = texto;
		lugares[lugar].textContent = texto;
	}

	function dos(numero) {
		return String(numero).padStart(2, '0');
	}

	// Barra de avance: se crean sus marcas una sola vez
	const contenedorMarcas = document.getElementById('marcas');
	const marcas = [];
	if (contenedorMarcas) {
		for (let i = 0; i < MARCAS; i++) {
			const marca = document.createElement('span');
			marca.className = 'marca';
			contenedorMarcas.appendChild(marca);
			marcas.push(marca);
		}
	}
	let llenas = -1;

	function pintarAvance(hecho) {
		const parte = Math.min(Math.max(hecho, 0), 1);
		escribir('porcentaje', Math.floor(parte * 100) + '%');
		const cuantas = Math.floor(parte * MARCAS);
		if (cuantas === llenas) return;
		llenas = cuantas;
		marcas.forEach(function (marca, i) {
			marca.classList.toggle('llena', i < llenas);
		});
	}

	let temporizador = null;

	function actualizar() {
		clearTimeout(temporizador);
		const t = ahora();
		const actual = fase();
		const tramo = tramoFinal();
		// Entrar al tramo final también avisa, aunque la fase siga en curso
		const clave = actual + (tramo ? '-final' : '');

		if (clave !== faseActual) {
			faseActual = clave;
			document.documentElement.dataset.fase = actual;
			oyentes.forEach(function (aviso) { aviso(actual); });
		}

		if (actual === 'cerrada') {
			activa.hidden = true;
			terminada.hidden = false;
			escribir('resultado', resultado);
			if (avance) avance.hidden = false;
			escribir('avanceRotulo', 'Avance de la Cup');
			pintarAvance(1);
			// Sigue revisando por si cambian las fechas o el resultado
			temporizador = setTimeout(actualizar, 30000);
			return;
		}

		activa.hidden = false;
		terminada.hidden = true;
		// Hasta el cierre del puntaje se cuenta hacia él; en el tramo final, hacia el cierre final
		const meta = actual === 'por_iniciar' ? inicio : tramo ? fin() : cierre;
		const falta = meta - t;
		const segundos = Math.floor(falta / 1000);
		const dias = Math.floor(segundos / 86400);
		escribir('horas', dos(Math.floor(segundos / 3600) % 24));
		escribir('minutos', dos(Math.floor(segundos / 60) % 60));
		escribir('segundos', dos(segundos % 60));

		// Si falta más de un día, los días van en el rótulo de arriba
		const plural = dias === 1 ? ' día' : ' días';
		// La barra de avance solo tiene sentido con la Cup en marcha
		if (avance) avance.hidden = actual === 'por_iniciar';
		if (actual === 'por_iniciar') {
			escribir('prefijo', dias > 0 ? 'T − ' + dias + plural : 'T −');
			escribir('destino', 'para el inicio');
		} else {
			escribir('prefijo', dias > 0 ? 'Quedan ' + dias + plural + ' y' : 'Quedan');
			escribir('destino', tramo ? 'para el cierre final' : 'para el cierre');
			escribir('avanceRotulo', 'Avance de la Cup');
			pintarAvance((t - inicio) / (fin() - inicio));
		}

		// Vuelve a correr justo cuando cambia el segundo
		temporizador = setTimeout(actualizar, (falta % 1000) + 20);
	}

	window.RelojCup = {
		ahora: ahora,
		fase: fase,
		tramoFinal: tramoFinal,
		// El estado entrega las fechas reales y, al cierre, el texto del resultado
		fijar: function (datos) {
			if (datos.inicio && !isNaN(new Date(datos.inicio))) inicio = new Date(datos.inicio).getTime();
			if (datos.cierre && !isNaN(new Date(datos.cierre))) cierre = new Date(datos.cierre).getTime();
			cierreFinal = datos.cierre_final && !isNaN(new Date(datos.cierre_final)) ? new Date(datos.cierre_final).getTime() : null;
			if (datos.resultado) resultado = datos.resultado;
			actualizar();
		},
		// Para estados de ejemplo: el reloj se pone en la hora de ese ejemplo
		simular: function (fecha) {
			if (pedido || isNaN(new Date(fecha))) return;
			desfase = new Date(fecha).getTime() - Date.now();
			actualizar();
		},
		alCambiarFase: function (aviso) {
			oyentes.push(aviso);
		}
	};

	actualizar();

	// Al volver a la pestaña el temporizador puede venir atrasado
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden) actualizar();
	});
})();
