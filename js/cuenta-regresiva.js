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

	const numeros = {};
	activa.querySelectorAll('.num').forEach(function (el) {
		numeros[el.dataset.unidad] = { el: el, texto: null };
	});

	function escribir(unidad, valor) {
		const destino = numeros[unidad];
		const texto = String(valor).padStart(2, '0');
		if (!destino || destino.texto === texto) return;
		destino.texto = texto;
		destino.el.textContent = '';
		for (const caracter of texto) {
			const digito = document.createElement('span');
			digito.className = 'digito';
			digito.textContent = caracter;
			destino.el.appendChild(digito);
		}
	}

	let temporizador = null;

	function actualizar() {
		clearTimeout(temporizador);
		const falta = inicio - Date.now();

		if (falta <= 0) {
			activa.hidden = true;
			terminada.hidden = false;
			return;
		}

		const segundos = Math.floor(falta / 1000);
		escribir('dias', Math.floor(segundos / 86400));
		escribir('horas', Math.floor(segundos / 3600) % 24);
		escribir('minutos', Math.floor(segundos / 60) % 60);
		escribir('segundos', segundos % 60);

		// Vuelve a correr justo cuando cambia el segundo
		temporizador = setTimeout(actualizar, (falta % 1000) + 20);
	}

	actualizar();

	// Al volver a la pestaña el temporizador puede venir atrasado
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && terminada.hidden) actualizar();
	});
})();
