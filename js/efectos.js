/* Efectos de la página: nada de esto cambia los datos, solo cómo aparecen.

   - La barra de accesos aparece al hacer scroll y se esconde al quedarse quieto.
   - Las secciones se revelan al entrar en pantalla.
   - Los números del marcador entran con un movimiento, siempre con su valor real.
   - El inicio se aleja al bajar y el túnel se detiene cuando ya no se ve. */
(function () {
	'use strict';

	const raiz = document.documentElement;
	const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
	const hayObservador = 'IntersectionObserver' in window;

	// Con esta clase el CSS sabe que puede esconder lo que se va a revelar.
	// Si este archivo no carga, todo queda visible desde el principio.
	if (hayObservador) raiz.classList.add('con-efectos');

	// ---------- Revelar al entrar en pantalla ----------
	const ojo = hayObservador ? new IntersectionObserver(function (entradas) {
		entradas.forEach(function (entrada) {
			if (!entrada.isIntersecting) return;
			entrada.target.classList.add('visto');
			ojo.unobserve(entrada.target);
		});
	}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

	function observar(nodo) {
		if (ojo) ojo.observe(nodo);
		else nodo.classList.add('visto');
	}
	document.querySelectorAll('.revelar').forEach(observar);

	// ---------- Números del marcador ----------
	// El número real se escribe de inmediato y nunca se muestra otro valor.
	// El adorno es solo un movimiento de entrada cuando el número aparece en pantalla.
	const ojoNumeros = hayObservador ? new IntersectionObserver(function (entradas) {
		entradas.forEach(function (entrada) {
			if (!entrada.isIntersecting) return;
			ojoNumeros.unobserve(entrada.target);
			entrada.target.classList.add('numero-entra');
		});
	}, { threshold: 0.4 }) : null;

	function contar(nodo, valor) {
		nodo.textContent = valor;
		// Sin adorno con movimiento reducido o con la pestaña oculta
		if (ojoNumeros && !quieto.matches && !document.hidden) ojoNumeros.observe(nodo);
	}

	window.Efectos = { observar: observar, contar: contar };

	// ---------- Barra de accesos ----------
	const barra = document.getElementById('barra');
	if (barra) {
		const ESPERA_MS = 2200;
		let reposo = null;

		function esconderSiCorresponde() {
			if (barra.matches(':hover') || barra.contains(document.activeElement)) {
				reposo = setTimeout(esconderSiCorresponde, ESPERA_MS);
				return;
			}
			barra.classList.remove('visible');
		}

		function mostrar() {
			clearTimeout(reposo);
			// Arriba del todo no hace falta: el inicio ocupa la pantalla
			if (window.scrollY < 80) {
				barra.classList.remove('visible');
				return;
			}
			barra.classList.add('visible');
			reposo = setTimeout(esconderSiCorresponde, ESPERA_MS);
		}

		window.addEventListener('scroll', mostrar, { passive: true });
		barra.addEventListener('focusin', mostrar);

		// Marca el acceso de la sección que se está viendo
		if (hayObservador) {
			const enlaces = {};
			barra.querySelectorAll('.barra-enlaces a').forEach(function (enlace) {
				enlaces[enlace.getAttribute('href').slice(1)] = enlace;
			});
			const ojoSecciones = new IntersectionObserver(function (entradas) {
				entradas.forEach(function (entrada) {
					if (!entrada.isIntersecting || !enlaces[entrada.target.id]) return;
					Object.keys(enlaces).forEach(function (clave) {
						enlaces[clave].classList.toggle('actual', clave === entrada.target.id);
					});
					// En celular la barra se desliza: se deja a la vista el acceso actual
					if (enlaces[entrada.target.id].scrollIntoView && barra.classList.contains('visible')) {
						enlaces[entrada.target.id].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
					}
				});
			}, { rootMargin: '-45% 0px -50% 0px' });
			Object.keys(enlaces).forEach(function (clave) {
				const seccion = document.getElementById(clave);
				if (seccion) ojoSecciones.observe(seccion);
			});
		}
	}

	// ---------- El inicio se aleja al bajar ----------
	const escena = document.getElementById('inicio');
	if (escena) {
		let pedido = false;
		function alejar() {
			pedido = false;
			const parte = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
			escena.style.setProperty('--salida', quieto.matches ? 0 : parte.toFixed(3));
		}
		window.addEventListener('scroll', function () {
			if (pedido) return;
			pedido = true;
			requestAnimationFrame(alejar);
		}, { passive: true });

		// Cuando el inicio ya no se ve, el túnel se detiene para no gastar batería
		if (hayObservador) {
			new IntersectionObserver(function (entradas) {
				escena.classList.toggle('fuera', !entradas[0].isIntersecting);
			}).observe(escena);
		}
	}

	// ---------- Ficha de misión: se cierra al tocar fuera ----------
	const ficha = document.getElementById('ficha-mision');
	if (ficha) {
		ficha.addEventListener('click', function (evento) {
			if (evento.target === ficha && ficha.close) ficha.close();
		});
	}
})();
