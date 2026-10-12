/* Cuenta regresiva hasta el inicio de la Cup.
   La fecha se lee del atributo datetime de <time id="inicio"> en index.html. */
(function () {
	'use strict';

	const elInicio = document.getElementById('inicio');
	const activa = document.getElementById('cuenta-activa');
	const terminada = document.getElementById('cuenta-terminada');
	if (!elInicio || !activa || !terminada) return;

	const inicio = new Date(elInicio.getAttribute('datetime')).getTime();
	if (isNaN(inicio)) return;

	const DIA_MS = 24 * 60 * 60 * 1000;
	const MARCAS = 24;	// una por cada hora del último día

	// Lugares donde se escribe: las tres partes del reloj, el prefijo y el porcentaje
	const lugares = {
		prefijo: document.getElementById('prefijo'),
		porcentaje: document.getElementById('porcentaje')
	};
	activa.querySelectorAll('[data-unidad]').forEach(function (el) {
		lugares[el.dataset.unidad] = el;
	});
	const escrito = {};

	// La barra de avance: se crean sus marcas una sola vez
	const avance = document.getElementById('avance');
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

	// Solo toca la página cuando el texto cambia
	function escribir(lugar, texto) {
		if (!lugares[lugar] || escrito[lugar] === texto) return;
		escrito[lugar] = texto;
		lugares[lugar].textContent = texto;
	}

	function dos(numero) {
		return String(numero).padStart(2, '0');
	}

	let temporizador = null;

	function actualizar() {
		clearTimeout(temporizador);
		const falta = inicio - Date.now();

		if (falta <= 0) {
			activa.hidden = true;
			terminada.hidden = false;
			if (avance) avance.hidden = true;
			return;
		}

		const segundos = Math.floor(falta / 1000);
		const dias = Math.floor(segundos / 86400);
		escribir('horas', dos(Math.floor(segundos / 3600) % 24));
		escribir('minutos', dos(Math.floor(segundos / 60) % 60));
		escribir('segundos', dos(segundos % 60));
		// Si falta más de un día, los días van en el rótulo de arriba
		escribir('prefijo', dias > 0 ? 'T − ' + dias + (dias === 1 ? ' día' : ' días') : 'T −');

		// La barra se llena durante las últimas 24 horas
		const hecho = 1 - Math.min(falta / DIA_MS, 1);
		escribir('porcentaje', Math.floor(hecho * 100) + '%');
		const ahora = Math.floor(hecho * MARCAS);
		if (ahora !== llenas) {
			llenas = ahora;
			marcas.forEach(function (marca, i) {
				marca.classList.toggle('llena', i < llenas);
			});
		}

		// Vuelve a correr justo cuando cambia el segundo
		temporizador = setTimeout(actualizar, (falta % 1000) + 20);
	}

	actualizar();

	// Al volver a la pestaña el temporizador puede venir atrasado
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && terminada.hidden) actualizar();
	});
})();
