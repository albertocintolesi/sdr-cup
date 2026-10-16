/* Pinta la página con el estado de la Cup.
   No calcula puntos ni valida nada: muestra lo que trae el estado.
   Lo único que deduce por su cuenta es lo que depende de la hora
   (qué día es hoy y qué misiones están vigentes), usando RelojCup. */
(function () {
	'use strict';

	const ZONA = 'America/Santiago';
	const ACTIVIDAD_INICIAL = 8;
	const ACTIVIDAD_PASO = 10;

	const hora = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
	const diaCorto = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'short', day: 'numeric' });
	const diaLargo = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'long', day: 'numeric' });
	const claveDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

	const NOMBRES_DESGLOSE = [
		['agendadas', 'Reuniones agendadas'],
		['realizadas', 'Bonus por reunión realizada'],
		['combos', 'Combos diarios'],
		['misiones', 'Misiones'],
		['flash', 'Flash Challenges'],
		['legendarios', 'Legendarios'],
		['ajustes', 'Ajustes']
	];

	let estado = null;
	let equipos = {};			// id del squad → { nombre, clase }
	let actividadVisible = ACTIVIDAD_INICIAL;
	let filtro = 'activas';
	let firmaMisiones = '';
	const eventosVistos = new Set();
	let primeraPintada = true;

	// ---------- Utilidades ----------
	function id(nombre) {
		return document.getElementById(nombre);
	}

	// Crea un elemento. El texto siempre entra como texto, nunca como HTML.
	function el(etiqueta, clase, texto) {
		const nodo = document.createElement(etiqueta);
		if (clase) nodo.className = clase;
		if (texto !== undefined && texto !== null) nodo.textContent = texto;
		return nodo;
	}

	function vaciar(nodo) {
		while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
	}

	function conSigno(numero) {
		if (numero > 0) return '+' + numero;
		if (numero < 0) return '−' + Math.abs(numero);
		return '0';
	}

	function mayuscula(texto) {
		return texto.charAt(0).toUpperCase() + texto.slice(1);
	}

	function ahora() {
		return window.RelojCup ? window.RelojCup.ahora() : Date.now();
	}

	function esHoy(fecha) {
		return claveDia.format(new Date(fecha)) === claveDia.format(new Date(ahora()));
	}

	// "hoy 14:05" si es de hoy, "mar 13, 14:05" si es de otro día
	function cuando(fecha) {
		const d = new Date(fecha);
		return (esHoy(d) ? 'hoy' : diaCorto.format(d)) + ' ' + hora.format(d);
	}

	function nombreDe(squad) {
		return equipos[squad] ? equipos[squad].nombre : '';
	}

	function claseDe(squad) {
		return equipos[squad] ? equipos[squad].clase : '';
	}

	// Escribe un número del marcador. Los efectos solo le agregan el movimiento de entrada.
	function ponerNumero(nodo, valor) {
		if (window.Efectos) window.Efectos.contar(nodo, valor);
		else nodo.textContent = valor;
	}

	function revelar(nodo) {
		nodo.classList.add('revelar');
		if (window.Efectos) window.Efectos.observar(nodo);
		return nodo;
	}

	// ---------- Marcador resumido del inicio ----------
	function pintarMini() {
		const mini = id('mini');
		vaciar(mini);
		estado.squads.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (squad, i) {
			if (i > 0) mini.appendChild(el('span', 'mini-vs', 'vs'));
			const lado = el('div', 'mini-lado ' + claseDe(squad.id));
			lado.appendChild(el('span', 'mini-nombre', squad.nombre));
			const puntos = el('span', 'mini-puntos');
			ponerNumero(puntos, squad.puntos);
			lado.appendChild(puntos);
			mini.appendChild(lado);
		});
		mini.hidden = false;
	}

	// ---------- Actividad ----------
	function filaDeEvento(evento, indice) {
		const fila = el('li', 'evento ' + claseDe(evento.squad));
		if (evento.anulado) fila.classList.add('anulado');
		if (evento.en_revision) fila.classList.add('en-revision');
		if (!primeraPintada && !eventosVistos.has(evento.id)) fila.classList.add('nuevo');
		fila.style.setProperty('--i', Math.min(indice, 10));

		fila.appendChild(el('time', 'evento-hora', cuando(evento.fecha_hora)));

		const cuerpo = el('div', 'evento-cuerpo');
		cuerpo.appendChild(el('p', 'evento-titulo', evento.titulo));
		if (evento.detalle) cuerpo.appendChild(el('p', 'evento-detalle', evento.detalle));
		if (evento.empresa) cuerpo.appendChild(el('p', 'evento-detalle', evento.empresa));
		const etiquetas = el('div', 'evento-etiquetas');
		if (nombreDe(evento.squad)) etiquetas.appendChild(el('span', 'chapa equipo', nombreDe(evento.squad)));
		if (evento.anulado) etiquetas.appendChild(el('span', 'chapa', 'Anulado'));
		if (evento.en_revision) etiquetas.appendChild(el('span', 'chapa', 'En revisión'));
		cuerpo.appendChild(etiquetas);
		fila.appendChild(cuerpo);

		// En revisión: los puntos todavía no cuentan, se muestran como pendientes
		const pendiente = evento.en_revision && evento.puntos_en_revision;
		const puntos = el('div', 'evento-puntos');
		puntos.appendChild(el('span', 'evento-numero', conSigno(pendiente ? evento.puntos_en_revision : evento.puntos)));
		puntos.appendChild(el('span', 'evento-unidad', pendiente ? 'pendiente' : Math.abs(evento.puntos) === 1 ? 'punto' : 'puntos'));
		fila.appendChild(puntos);
		return fila;
	}

	function pintarActividad() {
		const lista = id('lista-actividad');
		const eventos = estado.eventos;
		vaciar(lista);
		eventos.slice(0, actividadVisible).forEach(function (evento, i) {
			lista.appendChild(filaDeEvento(evento, i));
		});
		eventos.forEach(function (evento) { eventosVistos.add(evento.id); });
		id('actividad-vacia').hidden = eventos.length > 0;
		const boton = id('ver-mas');
		boton.hidden = eventos.length <= actividadVisible;
		boton.textContent = 'Ver más (' + (eventos.length - actividadVisible) + ')';
	}

	// ---------- Puntajes ----------
	function fraseDelMarcador() {
		const cup = estado.cup;
		const fase = window.RelojCup ? window.RelojCup.fase() : 'en_curso';
		if (cup.resultado_definitivo) {
			return cup.ganador ? 'Resultado definitivo: ganó ' + nombreDe(cup.ganador) + '.' : 'Resultado definitivo: sin ganador.';
		}
		if (fase === 'cerrada') return 'La Cup terminó. El resultado está en revisión.';
		if (fase === 'por_iniciar') return 'La Cup todavía no parte. Gana el squad con más puntos, con un mínimo de ' + cup.minimo_para_ganar + '.';
		if (!estado.lider) return 'Los squads van empatados.';
		return nombreDe(estado.lider) + ' lidera por ' + estado.diferencia + (estado.diferencia === 1 ? ' punto.' : ' puntos.');
	}

	function pintarTablero() {
		const tablero = id('tablero');
		const minimo = estado.cup.minimo_para_ganar;
		vaciar(tablero);
		estado.squads.forEach(function (squad) {
			const panel = el('article', 'panel ' + claseDe(squad.id));
			const cabeza = el('div', 'panel-cabeza');
			cabeza.appendChild(el('h3', 'panel-nombre', squad.nombre));
			if (estado.lider === squad.id) cabeza.appendChild(el('span', 'chapa equipo', 'Líder'));
			panel.appendChild(cabeza);

			const puntos = el('p', 'panel-puntos');
			ponerNumero(puntos, squad.puntos);
			panel.appendChild(puntos);

			// Barra hacia el mínimo para ganar: solo dibuja la proporción
			const meta = el('div', 'meta');
			const barra = el('div', 'meta-barra');
			const relleno = el('span', 'meta-relleno');
			relleno.style.setProperty('--parte', Math.min(squad.puntos / minimo, 1));
			barra.appendChild(relleno);
			meta.appendChild(barra);
			meta.appendChild(el('p', 'meta-texto', squad.puntos >= minimo ? 'Mínimo de ' + minimo + ' alcanzado' : squad.puntos + ' de ' + minimo + ' para el mínimo'));
			panel.appendChild(meta);

			const lineas = el('ul', 'panel-datos');
			lineas.appendChild(el('li', null, squad.reuniones_agendadas + (squad.reuniones_agendadas === 1 ? ' reunión agendada' : ' reuniones agendadas')));
			lineas.appendChild(el('li', null, squad.reuniones_realizadas + (squad.reuniones_realizadas === 1 ? ' realizada' : ' realizadas')));
			if (squad.puntos_en_revision) lineas.appendChild(el('li', 'en-espera', conSigno(squad.puntos_en_revision) + ' en revisión'));
			panel.appendChild(lineas);
			tablero.appendChild(panel);
		});
	}

	function pintarDesglose() {
		const caja = id('desglose');
		vaciar(caja);
		const cabeza = el('div', 'desglose-fila desglose-cabeza');
		cabeza.appendChild(el('span', null, ''));
		estado.squads.forEach(function (squad) {
			cabeza.appendChild(el('span', 'desglose-valor ' + claseDe(squad.id), squad.nombre));
		});
		caja.appendChild(cabeza);
		NOMBRES_DESGLOSE.forEach(function (par) {
			const valores = estado.squads.map(function (squad) { return (squad.desglose || {})[par[0]] || 0; });
			if (valores.every(function (v) { return v === 0; })) return;
			const fila = el('div', 'desglose-fila');
			fila.appendChild(el('span', 'desglose-nombre', par[1]));
			valores.forEach(function (valor) {
				fila.appendChild(el('span', 'desglose-valor', valor));
			});
			caja.appendChild(fila);
		});
		if (caja.children.length === 1) caja.appendChild(el('p', 'vacio', 'Aún no hay puntos que desglosar.'));
	}

	function pintarIntegrantes() {
		const caja = id('integrantes');
		vaciar(caja);
		estado.squads.forEach(function (squad) {
			const grupo = el('div', 'grupo ' + claseDe(squad.id));
			grupo.appendChild(el('p', 'grupo-nombre', squad.nombre));
			const lista = el('ol', 'grupo-lista');
			squad.integrantes.forEach(function (persona) {
				const fila = el('li', 'persona');
				fila.appendChild(el('span', 'persona-nombre', persona.nombre));
				fila.appendChild(el('span', 'persona-reuniones', persona.reuniones_agendadas + ' ag. · ' + persona.reuniones_realizadas + ' real.'));
				fila.appendChild(el('span', 'persona-puntos', persona.puntos));
				lista.appendChild(fila);
			});
			grupo.appendChild(lista);
			caja.appendChild(grupo);
		});
	}

	function pintarLegendarios() {
		const caja = id('legendarios');
		vaciar(caja);
		(estado.legendarios || []).forEach(function (legendario) {
			const fila = el('div', 'legendario');
			fila.appendChild(el('span', 'legendario-nombre', legendario.nombre));
			let texto = 'Se define al cierre';
			if (legendario.estado === 'logrado') texto = 'Logrado por ' + nombreDe(legendario.squad);
			if (legendario.estado === 'no_logrado') texto = 'No logrado';
			fila.appendChild(el('span', 'legendario-estado', texto));
			fila.appendChild(el('span', 'legendario-puntos', conSigno(legendario.puntos)));
			caja.appendChild(fila);
		});
	}

	// ---------- Día a día ----------
	function pintarDias() {
		const caja = id('lista-dias');
		vaciar(caja);
		const hoy = claveDia.format(new Date(ahora()));
		// La barra más larga corresponde al mejor día de cualquier squad
		let tope = 1;
		estado.dias.forEach(function (dia) {
			if (!dia.puntos) return;
			Object.keys(dia.puntos).forEach(function (squad) { tope = Math.max(tope, dia.puntos[squad]); });
		});

		estado.dias.forEach(function (dia, i) {
			const fecha = new Date(dia.fecha + 'T12:00:00-03:00');
			const tarjeta = revelar(el('article', 'dia'));
			tarjeta.style.setProperty('--i', i);
			if (dia.fecha === hoy) tarjeta.classList.add('hoy');

			const cabeza = el('div', 'dia-cabeza');
			cabeza.appendChild(el('h3', 'dia-nombre', mayuscula(diaLargo.format(fecha))));
			if (dia.fecha === hoy) cabeza.appendChild(el('span', 'chapa', 'Hoy'));
			tarjeta.appendChild(cabeza);

			if (!dia.puntos) {
				tarjeta.classList.add('futuro');
				tarjeta.appendChild(el('p', 'dia-espera', dia.fecha < hoy ? 'Sin datos' : 'Por jugar'));
				caja.appendChild(tarjeta);
				return;
			}

			const barras = el('div', 'dia-barras');
			estado.squads.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (squad) {
				const puntos = dia.puntos[squad.id] || 0;
				const fila = el('div', 'dia-fila ' + claseDe(squad.id));
				fila.appendChild(el('span', 'dia-squad', squad.nombre));
				const pista = el('span', 'dia-pista');
				const barra = el('span', 'dia-barra');
				barra.style.setProperty('--parte', puntos / tope);
				pista.appendChild(barra);
				fila.appendChild(pista);
				fila.appendChild(el('span', 'dia-puntos', conSigno(puntos)));
				if (dia.combo && dia.combo[squad.id]) fila.appendChild(el('span', 'chapa equipo', 'Combo'));
				barras.appendChild(fila);
			});
			tarjeta.appendChild(barras);

			// Datos del día: la misión, los Flash y el acumulado
			const notas = el('ul', 'dia-notas');
			const delDia = (estado.desafios || []).filter(function (d) { return d.fecha === dia.fecha; });
			delDia.filter(function (d) { return d.tipo === 'mision'; }).forEach(function (mision) {
				notas.appendChild(el('li', null, 'Misión: ' + mision.nombre));
			});
			const flash = delDia.filter(function (d) { return d.tipo === 'flash'; });
			if (flash.length) notas.appendChild(el('li', null, flash.length === 1 ? 'Flash: ' + flash[0].nombre : flash.length + ' Flash Challenges'));
			if (dia.acumulado) {
				const acumulado = estado.squads.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).map(function (squad) {
					return squad.nombre + ' ' + (dia.acumulado[squad.id] || 0);
				}).join(' · ');
				notas.appendChild(el('li', null, 'Acumulado: ' + acumulado));
			}
			tarjeta.appendChild(notas);
			caja.appendChild(tarjeta);
		});
	}

	// ---------- Misiones ----------
	// Flash sin ventana: queda abierto desde que cae hasta que un squad lo cumple o cierra la Cup
	function flashAbierto(desafio) {
		return desafio.tipo === 'flash' && desafio.desde && !desafio.hasta;
	}

	// Hasta cuándo puede estar vigente. Un Flash abierto, a más tardar hasta el cierre;
	// si ya tiene ganador no hay fin y se ordena por su fecha.
	function finDe(desafio) {
		if (desafio.hasta) return desafio.hasta;
		return flashAbierto(desafio) && !desafio.ganador ? estado.cup.cierre : null;
	}

	// La vigencia sale del reloj contra "desde" y "hasta". Un Flash con ganador ya terminó.
	function situacionDe(desafio) {
		const t = ahora();
		const fin = finDe(desafio);
		if (desafio.tipo === 'flash' && desafio.ganador) return 'terminada';
		if (desafio.desde && t < new Date(desafio.desde).getTime()) return 'proxima';
		if (fin && t > new Date(fin).getTime()) return 'terminada';
		if (!desafio.desde && !desafio.hasta) return esHoy(desafio.fecha + 'T12:00:00-03:00') ? 'activa' : 'terminada';
		return 'activa';
	}

	function ventanaDe(desafio) {
		if (flashAbierto(desafio)) {
			const desde = 'Desde ' + cuando(desafio.desde);
			return situacionDe(desafio) === 'terminada' ? desde : desde + ' · hasta que un squad lo cumpla';
		}
		if (!desafio.desde || !desafio.hasta) return mayuscula(diaLargo.format(new Date(desafio.fecha + 'T12:00:00-03:00')));
		const desde = new Date(desafio.desde);
		const hasta = new Date(desafio.hasta);
		const dia = esHoy(desde) ? 'Hoy' : mayuscula(diaCorto.format(desde));
		return dia + ', ' + hora.format(desde) + ' a ' + hora.format(hasta);
	}

	function restante(hasta) {
		const segundos = Math.max(0, Math.floor((new Date(hasta).getTime() - ahora()) / 1000));
		const dos = function (n) { return String(n).padStart(2, '0'); };
		return dos(Math.floor(segundos / 3600)) + ':' + dos(Math.floor(segundos / 60) % 60) + ':' + dos(segundos % 60);
	}

	const TEXTO_SITUACION = { activa: 'Vigente', proxima: 'Por comenzar', terminada: 'Terminada' };

	function pintarMisiones() {
		const caja = id('lista-misiones');
		const vacio = id('misiones-vacias');
		const orden = { activa: 0, proxima: 1, terminada: 2 };
		const todas = (estado.desafios || []).map(function (desafio) {
			return { desafio: desafio, situacion: situacionDe(desafio) };
		});
		firmaMisiones = todas.map(function (m) { return m.desafio.id + m.situacion; }).join('|');

		const visibles = todas.filter(function (m) {
			if (filtro === 'activas') return m.situacion === 'activa';
			if (filtro === 'inactivas') return m.situacion !== 'activa';
			return true;
		}).sort(function (a, b) {
			// Primero las vigentes, después las por comenzar y al final las terminadas.
			// Dentro de cada grupo, por inicio, la más reciente primero.
			if (orden[a.situacion] !== orden[b.situacion]) return orden[a.situacion] - orden[b.situacion];
			// Sin inicio, cuenta el mediodía de su fecha en Chile (la fecha sola se leería en UTC)
			const ta = new Date(a.desafio.desde || a.desafio.fecha + 'T12:00:00-03:00').getTime();
			const tb = new Date(b.desafio.desde || b.desafio.fecha + 'T12:00:00-03:00').getTime();
			return tb - ta;
		});

		vaciar(caja);
		visibles.forEach(function (m, i) {
			const desafio = m.desafio;
			const tarjeta = el('button', 'mision ' + m.situacion + (desafio.tipo === 'flash' ? ' flash' : ''));
			tarjeta.type = 'button';
			tarjeta.style.setProperty('--i', Math.min(i, 8));
			const cabeza = el('span', 'mision-cabeza');
			cabeza.appendChild(el('span', 'mision-tipo', desafio.tipo === 'flash' ? 'Flash Challenge' : 'Misión diaria'));
			cabeza.appendChild(el('span', 'chapa', TEXTO_SITUACION[m.situacion]));
			tarjeta.appendChild(cabeza);
			tarjeta.appendChild(el('span', 'mision-nombre', desafio.nombre));
			if (desafio.puntos_texto) tarjeta.appendChild(el('span', 'mision-puntos', desafio.puntos_texto));
			const pie = el('span', 'mision-pie');
			pie.appendChild(el('span', null, ventanaDe(desafio)));
			if (m.situacion === 'activa' && desafio.hasta) {
				const cuenta = el('span', 'mision-cuenta', 'Termina en ' + restante(desafio.hasta));
				cuenta.dataset.hasta = desafio.hasta;
				pie.appendChild(cuenta);
			}
			if (desafio.ganador) pie.appendChild(el('span', 'mision-ganador ' + claseDe(desafio.ganador), 'Ganó ' + nombreDe(desafio.ganador)));
			tarjeta.appendChild(pie);
			tarjeta.addEventListener('click', function () { abrirFicha(desafio, m.situacion); });
			caja.appendChild(tarjeta);
		});

		caja.hidden = visibles.length === 0;
		vacio.hidden = visibles.length > 0;
		if (!visibles.length) {
			vacio.textContent = filtro === 'activas'
				? 'No hay misiones activas en este momento. La misión del día se revela en la mañana y los Flash llegan sin aviso.'
				: filtro === 'inactivas' ? 'Todavía no hay misiones terminadas.' : 'Todavía no se ha anunciado ninguna misión.';
		}
	}

	function abrirFicha(desafio, situacion) {
		const ficha = id('ficha-mision');
		id('ficha-tipo').textContent = desafio.tipo === 'flash' ? 'Flash Challenge' : 'Misión diaria';
		id('ficha-nombre').textContent = desafio.nombre;
		id('ficha-descripcion').textContent = desafio.descripcion || '';
		const datos = id('ficha-datos');
		vaciar(datos);
		const filas = [
			['Puntos', desafio.puntos_texto],
			['Cuándo', ventanaDe(desafio)],
			['Estado', TEXTO_SITUACION[situacion]],
			['Ganador', desafio.ganador ? nombreDe(desafio.ganador) : null],
			// El estado puede traer una regla propia del desafío; si no, la de las bases
			['Regla', desafio.regla || (desafio.tipo === 'flash' ? 'Solo suma el primer squad que la cumple.' : 'No es exclusiva: pueden cumplirla ambos squads.')]
		];
		filas.forEach(function (fila) {
			if (!fila[1]) return;
			const grupo = el('div');
			grupo.appendChild(el('dt', null, fila[0]));
			grupo.appendChild(el('dd', null, fila[1]));
			datos.appendChild(grupo);
		});
		if (ficha.showModal) ficha.showModal();
		else ficha.setAttribute('open', '');
	}

	// ---------- Frescura y avisos ----------
	function pintarFrescura(info) {
		let texto = '';
		if (estado) {
			texto = 'Actualizado ' + cuando(estado.actualizado);
			if (estado.chat_hasta) texto += '. Chat procesado hasta ' + cuando(estado.chat_hasta);
			texto += '.';
		}
		if (info.situacion === 'guardado') texto = 'No pudimos traer el marcador más reciente. Estás viendo el último que cargó este teléfono. ' + texto;
		if (info.situacion === 'sin_estado') texto = 'El marcador todavía no está disponible. Vuelve a intentarlo en unos minutos.';
		id('frescura-inicio').textContent = texto;
		id('frescura-pie').textContent = texto;
		document.documentElement.dataset.situacion = info.situacion;
	}

	// ---------- Pintar todo ----------
	function pintar(info) {
		estado = info.estado;
		id('aviso-ejemplo').hidden = !info.ejemplo;
		pintarFrescura(info);
		if (!estado) return;

		equipos = {};
		estado.squads.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (squad, i) {
			equipos[squad.id] = { nombre: squad.nombre, clase: i === 0 ? 'eq-a' : 'eq-b' };
		});

		if (window.RelojCup) {
			// Un ejemplo trae su propia fecha: el reloj se pone ahí para que la página sea coherente
			if (info.ejemplo) window.RelojCup.simular(estado.actualizado);
			let resultado = 'Resultado en revisión';
			if (estado.cup.resultado_definitivo) resultado = estado.cup.ganador ? 'Ganó ' + nombreDe(estado.cup.ganador) : 'Sin ganador';
			window.RelojCup.fijar({ inicio: estado.cup.inicio, cierre: estado.cup.cierre, resultado: resultado });
		}

		pintarMini();
		pintarActividad();
		id('frase-lider').textContent = fraseDelMarcador();
		pintarTablero();
		pintarDesglose();
		pintarIntegrantes();
		pintarLegendarios();
		pintarDias();
		pintarMisiones();
		primeraPintada = false;
	}

	// ---------- Controles ----------
	id('ver-mas').addEventListener('click', function () {
		actividadVisible += ACTIVIDAD_PASO;
		if (estado) pintarActividad();
	});

	document.querySelectorAll('.filtro').forEach(function (boton) {
		boton.addEventListener('click', function () {
			filtro = boton.dataset.filtro;
			document.querySelectorAll('.filtro').forEach(function (otro) {
				const activo = otro === boton;
				otro.classList.toggle('activo', activo);
				otro.setAttribute('aria-pressed', activo ? 'true' : 'false');
			});
			if (estado) pintarMisiones();
		});
	});

	// Cada segundo: avanza la cuenta de las misiones vigentes y, si alguna
	// cambió de situación (empezó o terminó), se vuelven a pintar
	setInterval(function () {
		if (!estado || document.hidden) return;
		const firma = (estado.desafios || []).map(function (d) { return d.id + situacionDe(d); }).join('|');
		if (firma !== firmaMisiones) {
			pintarMisiones();
			return;
		}
		document.querySelectorAll('.mision-cuenta').forEach(function (nodo) {
			nodo.textContent = 'Termina en ' + restante(nodo.dataset.hasta);
		});
	}, 1000);

	if (window.RelojCup) {
		window.RelojCup.alCambiarFase(function () {
			if (!estado) return;
			id('frase-lider').textContent = fraseDelMarcador();
			pintarDias();
		});
	}

	if (window.EstadoCup) window.EstadoCup.iniciar(pintar);
})();
