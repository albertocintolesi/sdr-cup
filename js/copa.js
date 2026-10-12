/* Copa giratoria de la SDR Cup.
   Se dibuja en canvas 2D, sin librerías ni imágenes, a partir del perfil de un
   trofeo clásico con tapa: base de madera, pedestal, nudo, cáliz con franja
   labrada y nervios, tapa y remate con medalla.

   - El cuerpo es igual desde cualquier ángulo, así que se pinta una sola vez
     por tamaño de pantalla, en franjas con un degradado que imita el metal.
   - Lo que cambia al girar se calcula en cada cuadro: los labrados, las
     orejas, el remate y la inscripción.
   - Encima se compone la escena: luz en el piso, reflejo, destellos y polvo
     de luz. El resplandor y los rayos de fondo son CSS (ver css/estilos.css). */
(function () {
	'use strict';

	const lienzo = document.getElementById('copa');
	const marco = document.getElementById('copa-marco');
	if (!lienzo || !lienzo.getContext || !marco) return;
	const principal = lienzo.getContext('2d');	// lo que se ve
	const copa = document.createElement('canvas');	// la copa sola, fuera de pantalla
	const ctx = copa.getContext('2d');
	const reflejo = document.createElement('canvas');
	const pincelReflejo = reflejo.getContext('2d');

	// ---------- Parámetros que se pueden ajustar ----------
	const SEGUNDOS_POR_VUELTA = 32;
	const INCLINACION = 0.17;	// radianes: cuánto se mira la copa desde arriba
	const DISTANCIA = 7;		// distancia de la cámara (perspectiva suave)
	const PUNTOS_ANILLO = 96;	// puntos con que se traza cada franja del cuerpo
	const PARADAS = 56;			// pasos del degradado de cada franja
	const POLVO = 34;			// cantidad de motas de luz

	// Inscripción. "y" es la línea base del texto y "alto" la altura de las
	// mayúsculas, en las unidades del perfil (la copa mide 2,5 de alto).
	// "arco" es el ángulo máximo que puede ocupar la línea, en radianes.
	// Las líneas del mismo "grupo" quedan del mismo tamaño.
	const INSCRIPCION = [
		{ texto: 'SDR CUP', fuente: '600 100px Chillax, sans-serif', alto: 0.075, y: 0.03, espacio: 0.05, arco: 2.0, grupo: 'caliz' },
		{ texto: 'NEW', fuente: '600 100px "General Sans", sans-serif', alto: 0.046, y: -0.778, espacio: 0.2, arco: 2.1, grupo: 'pedestal' },
		{ texto: 'GENERATION', fuente: '600 100px "General Sans", sans-serif', alto: 0.046, y: -0.862, espacio: 0.2, arco: 2.1, grupo: 'pedestal' }
	];

	// Nervios horizontales de la parte alta del cáliz
	function nervios(y0, y1, r0, r1, cuantos) {
		const pts = [];
		const porNervio = 8;
		const pasos = cuantos * porNervio;
		for (let k = 0; k <= pasos; k++) {
			const u = k / pasos;
			const dentro = (k % porNervio) / porNervio;
			const bulto = k % porNervio === 0 ? 0 : Math.sqrt(Math.sin(Math.PI * dentro));
			pts.push([r0 + (r1 - r0) * u + 0.011 * bulto, y0 + (y1 - y0) * u]);
		}
		return pts;
	}

	// Perfil de la copa: pares [radio, altura] de abajo hacia arriba.
	// Cada tramo es una curva suave; entre tramos queda una arista.
	const TRAMOS = [
		// Base de madera
		{ pts: [[0.296, -1.25], [0.310, -1.235], [0.313, -1.19], [0.304, -1.15]], sub: 4, material: 'base' },
		{ pts: [[0.304, -1.15], [0.292, -1.135], [0.288, -1.10]], sub: 2, material: 'base' },
		{ pts: [[0.288, -1.10], [0.290, -1.07], [0.276, -1.055]], sub: 3, material: 'base' },
		{ pts: [[0.276, -1.055], [0.236, -1.05]], sub: 1, material: 'base' },
		// Pedestal: franja labrada abajo, placa lisa para la inscripción y borde redondeado
		{ pts: [[0.236, -1.05], [0.240, -1.045], [0.240, -1.035], [0.234, -1.03]], sub: 2 },
		{ pts: [[0.234, -1.03], [0.234, -0.925]], sub: 1, brillo: -0.05 },
		{ pts: [[0.234, -0.925], [0.240, -0.918], [0.240, -0.907], [0.231, -0.90]], sub: 2 },
		{ pts: [[0.231, -0.90], [0.231, -0.70]], sub: 1 },
		{ pts: [[0.231, -0.70], [0.236, -0.69], [0.236, -0.675], [0.226, -0.662]], sub: 3 },
		{ pts: [[0.226, -0.662], [0.176, -0.656]], sub: 1 },
		// Collar labrado y escalones
		{ pts: [[0.176, -0.656], [0.176, -0.648], [0.170, -0.645]], sub: 1 },
		{ pts: [[0.170, -0.645], [0.170, -0.585]], sub: 1, brillo: -0.05 },
		{ pts: [[0.170, -0.585], [0.177, -0.578], [0.177, -0.566], [0.166, -0.56]], sub: 2 },
		{ pts: [[0.166, -0.56], [0.150, -0.545], [0.150, -0.53], [0.128, -0.52], [0.128, -0.508], [0.105, -0.50]], sub: 1 },
		{ pts: [[0.105, -0.50], [0.082, -0.485], [0.060, -0.45], [0.050, -0.41], [0.048, -0.395]], sub: 5 },
		// Nudo
		{ pts: [[0.048, -0.395], [0.062, -0.39], [0.062, -0.38], [0.056, -0.374]], sub: 2 },
		{ pts: [[0.056, -0.374], [0.080, -0.355], [0.089, -0.325], [0.080, -0.295], [0.056, -0.276]], sub: 5 },
		{ pts: [[0.056, -0.276], [0.064, -0.27], [0.064, -0.26], [0.050, -0.253]], sub: 2 },
		{ pts: [[0.050, -0.253], [0.047, -0.235], [0.055, -0.215], [0.072, -0.202]], sub: 3 },
		// Cáliz: parte baja pulida, franja labrada y nervios
		{ pts: [[0.072, -0.202], [0.118, -0.165], [0.168, -0.095], [0.210, -0.01], [0.240, 0.07], [0.256, 0.125], [0.262, 0.15]], sub: 6 },
		{ pts: [[0.262, 0.15], [0.270, 0.157], [0.270, 0.168], [0.265, 0.175]], sub: 2 },
		{ pts: [[0.265, 0.175], [0.268, 0.268]], sub: 1, brillo: -0.05 },
		{ pts: [[0.268, 0.268], [0.275, 0.275], [0.275, 0.286], [0.268, 0.293]], sub: 2 },
		{ pts: nervios(0.293, 0.632, 0.268, 0.283, 5), sub: 1 },
		{ pts: [[0.283, 0.632], [0.293, 0.640], [0.295, 0.654], [0.287, 0.664]], sub: 3 },
		// Tapa
		{ pts: [[0.287, 0.664], [0.279, 0.678], [0.262, 0.708], [0.236, 0.733], [0.214, 0.745]], sub: 4 },
		{ pts: [[0.214, 0.745], [0.214, 0.760], [0.196, 0.764]], sub: 1 },
		{ pts: [[0.196, 0.764], [0.185, 0.795], [0.160, 0.835], [0.125, 0.866], [0.094, 0.88]], sub: 4 },
		{ pts: [[0.094, 0.88], [0.066, 0.90], [0.048, 0.935], [0.042, 0.968]], sub: 4 },
		{ pts: [[0.042, 0.968], [0.052, 0.975], [0.052, 0.988], [0.036, 0.995], [0.030, 1.02], [0, 1.025]], sub: 1 }
	];

	// Orejas: una pieza plana que nace del cáliz y sube abriéndose, en punta.
	// La curva va en el plano [distancia al eje, altura].
	const OREJA = [[0.25, 0.525], [0.335, 0.50], [0.372, 0.585], [0.398, 0.712]];
	const OREJA_TRAMOS = 22;
	const OREJA_LADOS = 12;

	// ---------- Utilidades ----------
	function escalon(a, b, x) {
		const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
		return t * t * (3 - 2 * t);
	}

	// Suaviza una lista de puntos con una curva Catmull-Rom
	function suavizar(pts, sub) {
		if (sub <= 1) return pts;
		const salida = [];
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(i - 1, 0)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(i + 2, pts.length - 1)];
			for (let k = 0; k < sub; k++) {
				const t = k / sub;
				const t2 = t * t;
				const t3 = t2 * t;
				const punto = [0, 0];
				for (let e = 0; e < 2; e++) {
					punto[e] = 0.5 * (2 * p1[e] + (p2[e] - p0[e]) * t +
						(2 * p0[e] - 5 * p1[e] + 4 * p2[e] - p3[e]) * t2 +
						(3 * p1[e] - p0[e] - 3 * p2[e] + p3[e]) * t3);
				}
				salida.push(punto);
			}
		}
		salida.push(pts[pts.length - 1]);
		return salida;
	}

	// Convierte una lista de paradas [posición, r, g, b] en 256 colores listos
	function rampa(paradas) {
		const colores = [];
		for (let i = 0; i < 256; i++) {
			const t = i / 255;
			let k = 1;
			while (k < paradas.length - 1 && paradas[k][0] < t) k++;
			const a = paradas[k - 1];
			const b = paradas[k];
			const f = (t - a[0]) / (b[0] - a[0]);
			colores.push('rgb(' +
				Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
				Math.round(a[2] + (b[2] - a[2]) * f) + ',' +
				Math.round(a[3] + (b[3] - a[3]) * f) + ')');
		}
		return colores;
	}

	// Rampas de color, de la sombra al brillo: azul metalizado y base oscura
	const RAMPA_METAL = rampa([
		[0.00, 3, 5, 24],
		[0.16, 16, 22, 92],
		[0.36, 38, 58, 176],
		[0.54, 44, 104, 214],
		[0.70, 74, 156, 240],
		[0.85, 166, 208, 255],
		[1.00, 255, 255, 255]
	]);
	const RAMPA_BASE = rampa([
		[0.00, 2, 2, 8],
		[0.30, 12, 10, 30],
		[0.60, 30, 26, 68],
		[0.85, 78, 84, 150],
		[1.00, 196, 210, 255]
	]);

	function indice(t) {
		return t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;
	}

	function metal(t) {
		return RAMPA_METAL[indice(t)];
	}

	// Tono del metal pulido según hacia dónde mira la superficie
	// (nx: derecha, ny: arriba). Son las franjas de luz de un metal espejado.
	function tono(nx, ny) {
		let t = 0.27 + 0.22 * ny;
		t += 0.26 * Math.exp(-((nx + 0.30) * (nx + 0.30)) / 0.09);	// reflejo amplio
		t += 0.52 * Math.exp(-((nx + 0.36) * (nx + 0.36)) / 0.014);	// brillo principal
		t += 0.34 * Math.exp(-((nx + 0.80) * (nx + 0.80)) / 0.004);	// franja fina a la izquierda
		t -= 0.14 * Math.exp(-((nx + 0.62) * (nx + 0.62)) / 0.006);	// banda oscura entre ambas
		t += 0.30 * Math.exp(-((nx - 0.70) * (nx - 0.70)) / 0.008);	// franja a la derecha
		t -= 0.12 * Math.exp(-((nx - 0.40) * (nx - 0.40)) / 0.03);	// centro derecho más profundo
		// Contraluz: los bordes de la silueta se encienden con la luz que viene de atrás
		const borde = Math.abs(nx);
		if (borde > 0.86) t += (borde - 0.86) * (borde - 0.86) * 22;
		return t;
	}

	const CT = Math.cos(INCLINACION);
	const ST = Math.sin(INCLINACION);

	// ---------- Perfil ----------
	const filas = [];		// { r, y }
	const franjas = [];		// franja entre la fila i y la i + 1
	TRAMOS.forEach(function (tramo, n) {
		const pts = suavizar(tramo.pts, tramo.sub);
		for (let i = (n === 0 ? 0 : 1); i < pts.length; i++) {
			if (filas.length) franjas.push({ tramo: tramo });
			filas.push({ r: Math.max(pts[i][0], 0), y: pts[i][1] });
		}
	});
	franjas.forEach(function (franja, i) {
		const a = filas[i];
		const b = filas[i + 1];
		const largo = Math.hypot(b.r - a.r, b.y - a.y) || 1;
		franja.a = a;
		franja.b = b;
		// Normal de la franja en el plano del perfil, hacia afuera
		franja.nr = (b.y - a.y) / largo;
		franja.ny = -(b.r - a.r) / largo;
		franja.brillo = franja.tramo.brillo || 0;
		franja.rampa = franja.tramo.material === 'base' ? RAMPA_BASE : RAMPA_METAL;
	});

	function radioEn(y) {
		for (let i = 0; i < franjas.length; i++) {
			const f = franjas[i];
			if (y >= f.a.y && y <= f.b.y && f.b.y > f.a.y) {
				return f.a.r + (f.b.r - f.a.r) * (y - f.a.y) / (f.b.y - f.a.y);
			}
		}
		return 0.2;
	}

	// ---------- Labrados ----------
	// Cada motivo se dibuja en un cuadro de 1 × 1 centrado en el origen (y hacia arriba)
	// y después se repite alrededor de su franja.
	function elipse(trazo, x, y, rx, ry, giro) {
		trazo.moveTo(x + rx * Math.cos(giro), y + rx * Math.sin(giro));
		trazo.ellipse(x, y, rx, ry, giro, 0, Math.PI * 2);
	}

	const VOLUTA = (function () {
		const linea = new Path2D();
		linea.moveTo(-0.48, -0.05);
		linea.bezierCurveTo(-0.34, 0.46, -0.04, 0.40, 0, 0);
		linea.bezierCurveTo(0.04, -0.40, 0.34, -0.46, 0.48, 0.05);
		linea.moveTo(-0.20, 0.10);
		linea.arc(-0.27, 0.10, 0.07, 0, Math.PI * 1.5);
		linea.moveTo(0.20, -0.10);
		linea.arc(0.27, -0.10, 0.07, Math.PI, Math.PI * 2.5);
		const relleno = new Path2D();
		elipse(relleno, -0.37, 0.34, 0.12, 0.05, 0.5);
		elipse(relleno, -0.12, -0.30, 0.12, 0.05, -0.6);
		elipse(relleno, 0.37, -0.34, 0.12, 0.05, 0.5);
		elipse(relleno, 0.12, 0.30, 0.12, 0.05, -0.6);
		return { linea: linea, relleno: relleno, grosor: 0.075 };
	})();

	const HOJAS = (function () {
		const relleno = new Path2D();
		elipse(relleno, -0.2, 0.04, 0.27, 0.11, 0.55);
		elipse(relleno, 0.2, 0.04, 0.27, 0.11, -0.55);
		elipse(relleno, 0, -0.32, 0.07, 0.07, 0);
		return { linea: null, relleno: relleno, grosor: 0 };
	})();

	const BANDAS = [
		{ y0: -1.03, y1: -0.925, r: 0.234, cuantos: 12, motivo: VOLUTA },
		{ y0: -0.645, y1: -0.585, r: 0.170, cuantos: 16, motivo: HOJAS },
		{ y0: 0.175, y1: 0.268, r: 0.2665, cuantos: 10, motivo: VOLUTA }
	];

	// ---------- Remate: corona de laurel y medalla ----------
	// Es una pieza plana sobre la tapa. Se dibuja en unidades de la copa.
	const REMATE = (function () {
		const ramas = new Path2D();
		const hojas = new Path2D();
		[1, -1].forEach(function (lado) {
			const p = [[0.012 * lado, 0.985], [0.115 * lado, 0.995], [0.125 * lado, 1.07], [0.074 * lado, 1.112]];
			ramas.moveTo(p[0][0], p[0][1]);
			ramas.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
			for (let n = 0; n < 7; n++) {
				const t = 0.22 + n * 0.12;
				const u = 1 - t;
				const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
				const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
				const dx = 3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]);
				const dy = 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1]);
				const rumbo = Math.atan2(dy, dx);
				const afuera = n % 2 ? 1 : -1;
				elipse(hojas,
					x + Math.cos(rumbo + afuera * 1.2) * 0.016,
					y + Math.sin(rumbo + afuera * 1.2) * 0.016,
					0.026, 0.0105, rumbo + afuera * 0.55);
			}
		});
		const feston = new Path2D();
		for (let n = 0; n < 12; n++) {
			const a = (n / 12) * Math.PI * 2;
			elipse(feston, Math.cos(a) * 0.076, 1.147 + Math.sin(a) * 0.076, 0.02, 0.02, 0);
		}
		const disco = new Path2D();
		elipse(disco, 0, 1.147, 0.079, 0.079, 0);
		const aro = new Path2D();
		elipse(aro, 0, 1.147, 0.063, 0.063, 0);
		const centro = new Path2D();
		elipse(centro, 0, 1.147, 0.055, 0.055, 0);
		const brote = new Path2D();
		const broteHojas = new Path2D();
		brote.moveTo(0, 1.108);
		brote.lineTo(0, 1.186);
		[[1.128, 0.019], [1.148, 0.022], [1.168, 0.017]].forEach(function (par) {
			elipse(broteHojas, par[1], par[0] + 0.008, 0.019, 0.008, 0.7);
			elipse(broteHojas, -par[1], par[0] + 0.008, 0.019, 0.008, Math.PI - 0.7);
		});
		return { ramas: ramas, hojas: hojas, feston: feston, disco: disco, aro: aro, centro: centro, brote: brote, broteHojas: broteHojas };
	})();

	// ---------- Malla de las orejas ----------
	const vx = [];
	const vy = [];
	const vz = [];
	const caras = [];	// { a, b, c, d, n, nIzq, nDer }

	function normalDeCara(cara) {
		const e1x = vx[cara.c] - vx[cara.a];
		const e1y = vy[cara.c] - vy[cara.a];
		const e1z = vz[cara.c] - vz[cara.a];
		const e2x = vx[cara.d] - vx[cara.b];
		const e2y = vy[cara.d] - vy[cara.b];
		const e2z = vz[cara.d] - vz[cara.b];
		return unitario([e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x]);
	}
	function unitario(v) {
		const largo = Math.hypot(v[0], v[1], v[2]) || 1;
		return [v[0] / largo, v[1] / largo, v[2] / largo];
	}
	function mezcla(a, b) {
		return unitario([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
	}
	function bezier(t, eje) {
		const u = 1 - t;
		return u * u * u * OREJA[0][eje] + 3 * u * u * t * OREJA[1][eje] + 3 * u * t * t * OREJA[2][eje] + t * t * t * OREJA[3][eje];
	}
	function bezierDerivada(t, eje) {
		const u = 1 - t;
		return 3 * u * u * (OREJA[1][eje] - OREJA[0][eje]) + 6 * u * t * (OREJA[2][eje] - OREJA[1][eje]) + 3 * t * t * (OREJA[3][eje] - OREJA[2][eje]);
	}
	[1, -1].forEach(function (lado) {
		const base = vx.length;
		for (let k = 0; k <= OREJA_TRAMOS; k++) {
			const t = k / OREJA_TRAMOS;
			const ro = bezier(t, 0);
			const y = bezier(t, 1);
			let dr = bezierDerivada(t, 0);
			let dy = bezierDerivada(t, 1);
			const largo = Math.hypot(dr, dy) || 1;
			dr /= largo;
			dy /= largo;
			// Ancha y delgada como una hoja: angosta al nacer, llena al medio y en punta
			const anchoHoja = 0.008 + 0.046 * Math.pow(4 * t * (1 - t), 0.6) * (1 - 0.3 * t);
			const espesor = 0.016 * (1 - 0.5 * t);
			for (let u = 0; u < OREJA_LADOS; u++) {
				const giro = (u / OREJA_LADOS) * Math.PI * 2;
				const enPlano = Math.cos(giro) * anchoHoja;
				const alCostado = Math.sin(giro) * espesor;
				vx.push(lado * (ro - dy * enPlano));
				vy.push(y + dr * enPlano);
				vz.push(-lado * alCostado);
			}
		}
		// Cada cara une el anillo k con el k + 1. Sus bordes "izquierdo" y "derecho"
		// son esos dos anillos, para que el degradado corra a lo largo de la pieza.
		const tubo = [];
		for (let k = 0; k < OREJA_TRAMOS; k++) {
			const t = (k + 0.5) / OREJA_TRAMOS;
			const anillo = [];
			for (let u = 0; u < OREJA_LADOS; u++) {
				const sig = (u + 1) % OREJA_LADOS;
				const cara = {
					a: base + k * OREJA_LADOS + u,
					b: base + (k + 1) * OREJA_LADOS + u,
					c: base + (k + 1) * OREJA_LADOS + sig,
					d: base + k * OREJA_LADOS + sig
				};
				// La normal debe apuntar hacia afuera de la pieza
				const n = normalDeCara(cara);
				const mx = (vx[cara.a] + vx[cara.b] + vx[cara.c] + vx[cara.d]) / 4;
				const my = (vy[cara.a] + vy[cara.b] + vy[cara.c] + vy[cara.d]) / 4;
				const mz = (vz[cara.a] + vz[cara.b] + vz[cara.c] + vz[cara.d]) / 4;
				const haciaAfuera = n[0] * (mx - lado * bezier(t, 0)) + n[1] * (my - bezier(t, 1)) + n[2] * mz;
				cara.n = haciaAfuera < 0 ? [-n[0], -n[1], -n[2]] : n;
				// Las caras que quedan enterradas en el cáliz no se dibujan
				cara.oculta = Math.hypot(mx, mz) < radioEn(my);
				anillo.push(cara);
			}
			tubo.push(anillo);
		}
		tubo.forEach(function (anillo, k) {
			anillo.forEach(function (cara, u) {
				cara.nIzq = k > 0 ? mezcla(cara.n, tubo[k - 1][u].n) : cara.n;
				cara.nDer = k < OREJA_TRAMOS - 1 ? mezcla(cara.n, tubo[k + 1][u].n) : cara.n;
				if (!cara.oculta) caras.push(cara);
			});
		});
	});

	// Copias en arreglos tipados para el dibujo cuadro a cuadro
	const NV = vx.length;
	const NC = caras.length;
	const MX = Float32Array.from(vx);
	const MY = Float32Array.from(vy);
	const MZ = Float32Array.from(vz);
	const QA = Uint16Array.from(caras, function (q) { return q.a; });
	const QB = Uint16Array.from(caras, function (q) { return q.b; });
	const QC = Uint16Array.from(caras, function (q) { return q.c; });
	const QD = Uint16Array.from(caras, function (q) { return q.d; });
	// Por cara: normal propia, normal del borde izquierdo y del derecho (3 × 3 valores)
	const NORMALES = new Float32Array(NC * 9);
	caras.forEach(function (q, i) {
		NORMALES.set(q.n, i * 9);
		NORMALES.set(q.nIzq, i * 9 + 3);
		NORMALES.set(q.nDer, i * 9 + 6);
	});
	const VX = new Float32Array(NV);
	const VY = new Float32Array(NV);
	const VZ = new Float32Array(NV);
	const SX = new Float32Array(NV);
	const SY = new Float32Array(NV);
	const TONO_IZQ = new Uint8Array(NC);
	const TONO_DER = new Uint8Array(NC);
	const PROF = new Float32Array(NC);
	const ORDEN = new Uint16Array(NC);

	// Caja que ocupa la copa en pantalla con escala 1
	const caja = (function () {
		let maxX = 0;
		let minY = Infinity;
		let maxY = -Infinity;
		function medir(x, y, z) {
			const y2 = y * CT - z * ST;
			const p = DISTANCIA / (DISTANCIA - (y * ST + z * CT));
			maxX = Math.max(maxX, Math.abs(x * p));
			minY = Math.min(minY, y2 * p);
			maxY = Math.max(maxY, y2 * p);
		}
		filas.forEach(function (fila) {
			medir(fila.r, fila.y, 0);
			medir(0, fila.y, fila.r);
			medir(0, fila.y, -fila.r);
		});
		medir(0.13, 1.24, 0);	// remate
		// Las orejas se miden girándolas media vuelta
		for (let paso = 0; paso < 16; paso++) {
			const giro = (paso / 16) * Math.PI;
			const cf = Math.cos(giro);
			const sf = Math.sin(giro);
			for (let v = 0; v < NV; v++) {
				medir(MX[v] * cf + MZ[v] * sf, MY[v], -MX[v] * sf + MZ[v] * cf);
			}
		}
		return { maxX: maxX, minY: minY - 0.03, maxY: maxY + 0.02 };
	})();

	// ---------- Estado ----------
	const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
	let ancho = 0;
	let alto = 0;
	let dpr = 1;
	let escala = 1;
	let cx = 0;
	let cy = 0;
	let capaCuerpo = null;	// cuerpo de la copa ya pintado
	let fi = 0.6;			// ángulo de giro actual
	let velocidad = 0;		// radianes por segundo
	let lineas = null;		// inscripción ya medida
	let sucio = true;
	let fiDibujado = null;
	let arrastrando = false;
	let ultimoX = 0;
	let ultimoT = 0;
	let costo = 0;
	let medioRitmo = false;
	let alterna = false;
	let tiempo = 0;			// segundos de animación acumulados
	let pendiente = 0;		// tiempo sin dibujar, para el polvo
	let ySuelo = 0;			// punto más bajo de la copa en pantalla
	let yBase = 0;			// centro de la base en pantalla
	let degradadoReflejo = null;
	const motas = [];
	for (let i = 0; i < POLVO; i++) {
		motas.push({
			x: (Math.random() * 2 - 1) * 1.3,
			y: -1.3 + Math.random() * 3,
			sube: 0.02 + Math.random() * 0.055,
			radio: 0.005 + Math.random() * 0.009,
			fase: Math.random() * 6.28,
			ritmo: 0.6 + Math.random() * 1.4
		});
	}

	function velocidadBase() {
		// Negativa: la superficie avanza hacia la izquierda y el texto entra por su primera letra
		return movimientoReducido.matches ? 0 : -(Math.PI * 2) / SEGUNDOS_POR_VUELTA;
	}

	// Proyecta a la pantalla un punto de la copa que está de frente (sin giro)
	function enPantalla(x, y, z) {
		const p = DISTANCIA / (DISTANCIA - (y * ST + z * CT));
		return { x: cx + escala * x * p, y: cy - escala * (y * CT - z * ST) * p, p: p };
	}

	function encuadrar() {
		const rect = lienzo.getBoundingClientRect();
		const zona = marco.getBoundingClientRect();	// espacio reservado para la copa
		if (!rect.width || !rect.height || !zona.width || !zona.height) return;
		ancho = rect.width;
		alto = rect.height;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		[lienzo, copa].forEach(function (c) {
			c.width = Math.round(ancho * dpr);
			c.height = Math.round(alto * dpr);
		});

		// Si bajo la zona casi no queda pantalla, se guarda un poco para el reflejo
		const debajo = rect.bottom - zona.bottom;
		const reserva = Math.min(Math.max(zona.height * 0.12 - debajo, 0), zona.height * 0.12);
		const altoUtil = zona.height - reserva;
		escala = Math.min((zona.width * 0.95) / (2 * caja.maxX), (altoUtil * 0.98) / (caja.maxY - caja.minY));
		cx = zona.left - rect.left + zona.width / 2;
		cy = zona.top - rect.top + altoUtil / 2 + escala * (caja.maxY + caja.minY) / 2;

		ySuelo = enPantalla(0, -1.25, 0.296).y;
		yBase = enPantalla(0, -1.25, 0).y;
		degradadoReflejo = null;

		// El fondo (CSS) necesita saber dónde quedó la copa
		const raiz = document.documentElement.style;
		raiz.setProperty('--copa-x', (rect.left + cx).toFixed(1) + 'px');
		raiz.setProperty('--copa-y', (rect.top + enPantalla(0, 0.2, 0).y).toFixed(1) + 'px');
		raiz.setProperty('--copa-u', escala.toFixed(1) + 'px');
		raiz.setProperty('--suelo-y', (rect.top + yBase - escala * 0.13).toFixed(1) + 'px');

		pintarCuerpo();
		sucio = true;
	}

	// Pinta el cuerpo de la copa en una capa que luego se copia en cada cuadro.
	// Solo depende del tamaño del lienzo, no del giro.
	function pintarCuerpo() {
		capaCuerpo = document.createElement('canvas');
		capaCuerpo.width = lienzo.width;
		capaCuerpo.height = lienzo.height;
		const pincel = capaCuerpo.getContext('2d');
		pincel.setTransform(dpr, 0, 0, dpr, 0, 0);
		pincel.lineWidth = 0.7;
		pincel.lineJoin = 'round';
		// De abajo hacia arriba: lo de más arriba tapa a lo de abajo
		franjas.forEach(function (franja) {
			pintarFranja(franja, pincel);
		});
	}

	// Traza una franja del perfil como anillo y la rellena con su degradado
	function pintarFranja(franja, pincel) {
		const px = [[], []];
		const py = [[], []];
		const visible = [];
		let cuantas = 0;
		for (let k = 0; k < PUNTOS_ANILLO; k++) {
			const angulo = (k / PUNTOS_ANILLO) * Math.PI * 2;
			const s = Math.sin(angulo);
			const c = Math.cos(angulo);
			[franja.a, franja.b].forEach(function (fila, e) {
				const z = fila.r * c;
				const p = DISTANCIA / (DISTANCIA - (fila.y * ST + z * CT));
				px[e].push(cx + escala * fila.r * s * p);
				py[e].push(cy - escala * (fila.y * CT - z * ST) * p);
			});
			// ¿Mira a la cámara el trozo que parte en este punto?
			const medio = angulo + Math.PI / PUNTOS_ANILLO;
			const sm = Math.sin(medio);
			const cm = Math.cos(medio);
			const r = (franja.a.r + franja.b.r) / 2;
			const y = (franja.a.y + franja.b.y) / 2;
			const nz = franja.nr * cm;
			const vistaNy = franja.ny * CT - nz * ST;
			const vistaNz = franja.ny * ST + nz * CT;
			const z = r * cm;
			const deFrente = vistaNz * (DISTANCIA - (y * ST + z * CT)) - franja.nr * sm * (r * sm) - vistaNy * (y * CT - z * ST) > 0;
			visible.push(deFrente);
			if (deFrente) cuantas++;
		}
		if (!cuantas) return;

		const trazo = new Path2D();
		let regla = 'nonzero';
		if (cuantas === PUNTOS_ANILLO) {
			// Se ve entera: es una corona entre los dos círculos
			regla = 'evenodd';
			for (let e = 0; e < 2; e++) {
				for (let k = 0; k < PUNTOS_ANILLO; k++) {
					if (k === 0) trazo.moveTo(px[e][k], py[e][k]);
					else trazo.lineTo(px[e][k], py[e][k]);
				}
				trazo.closePath();
			}
		} else {
			let inicio = 0;
			while (!(visible[inicio] && !visible[(inicio + PUNTOS_ANILLO - 1) % PUNTOS_ANILLO])) inicio++;
			for (let k = 0; k <= cuantas; k++) {
				const j = (inicio + k) % PUNTOS_ANILLO;
				if (k === 0) trazo.moveTo(px[0][j], py[0][j]);
				else trazo.lineTo(px[0][j], py[0][j]);
			}
			for (let k = cuantas; k >= 0; k--) {
				const j = (inicio + k) % PUNTOS_ANILLO;
				trazo.lineTo(px[1][j], py[1][j]);
			}
			trazo.closePath();
		}

		// Degradado horizontal: el tono en cada punto según hacia dónde mira ahí la superficie
		const fila = franja.a.r >= franja.b.r ? franja.a : franja.b;
		const radio = escala * fila.r * DISTANCIA / (DISTANCIA - fila.y * ST);
		let relleno;
		if (radio < 0.5) {
			relleno = franja.rampa[indice(tono(0, franja.ny * CT - Math.abs(franja.nr) * ST) + franja.brillo)];
		} else {
			relleno = pincel.createLinearGradient(cx - radio, 0, cx + radio, 0);
			for (let k = 0; k <= PARADAS; k++) {
				const s = -1 + (2 * k) / PARADAS;
				const haciaCamara = Math.abs(franja.nr) * Math.sqrt(1 - s * s);
				const t = tono(franja.nr * s, franja.ny * CT - haciaCamara * ST) + franja.brillo;
				relleno.addColorStop(k / PARADAS, franja.rampa[indice(t)]);
			}
		}
		pincel.fillStyle = relleno;
		pincel.strokeStyle = relleno;
		pincel.fill(trazo, regla);
		pincel.stroke(trazo);	// tapa las rendijas entre franjas vecinas
	}

	// Mide la inscripción con las tipografías ya cargadas
	function prepararTexto() {
		const medidas = INSCRIPCION.map(function (linea) {
			ctx.font = linea.fuente;
			const altoPx = ctx.measureText('H').actualBoundingBoxAscent || 70;
			const letras = Array.from(linea.texto);
			const extra = linea.espacio * 100;
			const anchos = letras.map(function (letra) {
				return ctx.measureText(letra).width;
			});
			const total = anchos.reduce(function (suma, w) { return suma + w + extra; }, -extra);
			const yMedio = linea.y + linea.alto / 2;
			const radio = radioEn(yMedio) * 1.004;
			return {
				linea: linea, letras: letras, anchos: anchos, extra: extra, total: total, radio: radio,
				// unidades de la copa por píxel de fuente, sin pasarse del arco permitido
				unidad: Math.min(linea.alto / altoPx, (linea.arco * radio) / total),
				// cuánto se abre la superficie hacia arriba en esa altura (a la mitad:
				// con la inclinación completa las letras parecen cursivas)
				pendiente: 0.5 * (radioEn(yMedio + 0.02) - radioEn(yMedio - 0.02)) / 0.04
			};
		});
		lineas = medidas.map(function (m) {
			// Las líneas de un mismo grupo usan el tamaño de la más ajustada
			const unidad = Math.min.apply(null, medidas.filter(function (otra) {
				return otra.linea.grupo === m.linea.grupo;
			}).map(function (otra) { return otra.unidad; }));
			const angulos = [];
			let x = -m.total / 2;
			m.anchos.forEach(function (w) {
				angulos.push(((x + w / 2) * unidad) / m.radio);
				x += w + m.extra;
			});
			const norma = Math.hypot(1, m.pendiente);
			return {
				letras: m.letras, angulos: angulos, unidad: unidad, radio: m.radio,
				y: m.linea.y, fuente: m.linea.fuente,
				abre: m.pendiente / norma, sube: 1 / norma
			};
		});
		sucio = true;
	}

	function copiarCapa(capa) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(capa, 0, 0);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function dibujarCara(q) {
		const a = QA[q];
		const b = QB[q];
		const c = QC[q];
		const d = QD[q];
		let relleno = RAMPA_METAL[TONO_IZQ[q]];
		if (TONO_IZQ[q] !== TONO_DER[q]) {
			// Degradado del borde izquierdo al derecho de la cara
			const x1 = (SX[a] + SX[d]) / 2;
			const y1 = (SY[a] + SY[d]) / 2;
			const x2 = (SX[b] + SX[c]) / 2;
			const y2 = (SY[b] + SY[c]) / 2;
			if (Math.abs(x2 - x1) + Math.abs(y2 - y1) > 0.75) {
				relleno = ctx.createLinearGradient(x1, y1, x2, y2);
				relleno.addColorStop(0, RAMPA_METAL[TONO_IZQ[q]]);
				relleno.addColorStop(1, RAMPA_METAL[TONO_DER[q]]);
			}
		}
		ctx.fillStyle = relleno;
		ctx.strokeStyle = relleno;
		ctx.beginPath();
		ctx.moveTo(SX[a], SY[a]);
		ctx.lineTo(SX[b], SY[b]);
		ctx.lineTo(SX[c], SY[c]);
		ctx.lineTo(SX[d], SY[d]);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	// Pinta un motivo labrado con una tinta, corrido lo que se indique
	function pintarMotivo(motivo, tinta, dx, dy) {
		ctx.translate(dx, dy);
		ctx.fillStyle = tinta;
		ctx.fill(motivo.relleno);
		if (motivo.linea) {
			ctx.strokeStyle = tinta;
			ctx.lineWidth = motivo.grosor;
			ctx.stroke(motivo.linea);
		}
		ctx.translate(-dx, -dy);
	}

	// Franjas labradas: el motivo se repite alrededor y gira con la copa
	function dibujarBandas() {
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		for (let n = 0; n < BANDAS.length; n++) {
			const banda = BANDAS[n];
			const yMedio = (banda.y0 + banda.y1) / 2;
			const anchoMotivo = ((2 * Math.PI * banda.r) / banda.cuantos) * 0.94;
			const altoMotivo = (banda.y1 - banda.y0) * 0.78;
			for (let k = 0; k < banda.cuantos; k++) {
				const angulo = (k / banda.cuantos) * Math.PI * 2 + fi;
				const c = Math.cos(angulo);
				if (c < 0.1) continue;
				const s = Math.sin(angulo);
				const z = banda.r * c;
				const p = DISTANCIA / (DISTANCIA - (yMedio * ST + z * CT));
				const lado = escala * p * dpr;
				const espejo = k % 2 ? -1 : 1;
				ctx.setTransform(lado * anchoMotivo * c * espejo, -lado * anchoMotivo * s * ST * espejo,
					0, -lado * altoMotivo * CT,
					(cx + escala * banda.r * s * p) * dpr,
					(cy - escala * (yMedio * CT - z * ST) * p) * dpr);
				ctx.globalAlpha = escalon(0.1, 0.42, c);
				const t = tono(s * 0.97, 0);
				// Primero la sombra del relieve, después el relieve
				pintarMotivo(banda.motivo, metal(t - 0.34), 0.035 * espejo, -0.06);
				pintarMotivo(banda.motivo, metal(t + 0.22), 0, 0);
			}
		}
		ctx.globalAlpha = 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.lineWidth = 0.7;
		ctx.lineCap = 'butt';
	}

	// Remate: corona de laurel y medalla, una pieza plana que gira con la copa
	function dibujarRemate() {
		const c = Math.cos(fi);
		const s = Math.sin(fi);
		// De canto no desaparece: conserva un espesor mínimo
		const frente = Math.abs(c) < 0.07 ? (c < 0 ? -0.07 : 0.07) : c;
		const p = DISTANCIA / (DISTANCIA - 1.1 * ST);
		const lado = escala * p * dpr;
		const t = tono(s * (c < 0 ? -0.9 : 0.9), 0.05);
		ctx.lineCap = 'round';
		for (let pasada = 0; pasada < 2; pasada++) {
			// Pasada 0: sombra corrida. Pasada 1: la pieza.
			const corrida = pasada === 0 ? 0.007 : 0;
			const baja = pasada === 0 ? -0.34 : 0;
			ctx.setTransform(lado * frente, -lado * s * ST, 0, -lado * CT,
				(cx + corrida * escala) * dpr, (cy + corrida * escala) * dpr);
			ctx.strokeStyle = metal(t + baja);
			ctx.lineWidth = 0.022;
			ctx.beginPath();
			ctx.moveTo(0, 0.99);
			ctx.lineTo(0, 1.075);
			ctx.stroke();
			ctx.lineWidth = 0.011;
			ctx.stroke(REMATE.ramas);
			ctx.fillStyle = metal(t + 0.12 + baja);
			ctx.fill(REMATE.hojas);
			ctx.fillStyle = metal(t - 0.04 + baja);
			ctx.fill(REMATE.feston);
			ctx.fillStyle = metal(t + 0.08 + baja);
			ctx.fill(REMATE.disco);
		}
		ctx.strokeStyle = metal(t - 0.26);
		ctx.lineWidth = 0.006;
		ctx.stroke(REMATE.aro);
		ctx.fillStyle = metal(t + 0.26);
		ctx.fill(REMATE.centro);
		ctx.strokeStyle = metal(t - 0.42);
		ctx.fillStyle = metal(t - 0.42);
		ctx.lineWidth = 0.007;
		ctx.stroke(REMATE.brote);
		ctx.fill(REMATE.broteHojas);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.lineWidth = 0.7;
		ctx.lineCap = 'butt';
	}

	function dibujarTexto() {
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		lineas.forEach(function (linea) {
			ctx.font = linea.fuente;
			// La inscripción va dos veces: por delante y por detrás
			for (let copia = 0; copia < 2; copia++) {
				for (let i = 0; i < linea.letras.length; i++) {
					if (linea.letras[i] === ' ') continue;
					const angulo = copia * Math.PI + linea.angulos[i] + fi;
					const c = Math.cos(angulo);
					if (c < 0.15) continue;
					const s = Math.sin(angulo);
					const z = linea.radio * c;
					const y2 = linea.y * CT - z * ST;
					const p = DISTANCIA / (DISTANCIA - (linea.y * ST + z * CT));
					const k = escala * p * linea.unidad * dpr;
					// La letra se apoya en la superficie: sigue su curva y su inclinación
					ctx.setTransform(k * c, -k * s * ST,
						-k * linea.abre * s, k * (linea.sube * CT - linea.abre * c * ST),
						(cx + escala * linea.radio * s * p) * dpr,
						(cy - escala * y2 * p) * dpr);
					const alfa = escalon(0.15, 0.6, c);
					ctx.fillStyle = 'rgba(3, 5, 28, ' + (0.6 * alfa).toFixed(3) + ')';
					ctx.fillText(linea.letras[i], 2.5, 3.5);
					ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.97 * alfa).toFixed(3) + ')';
					ctx.fillText(linea.letras[i], 0, 0);
				}
			}
		});
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	// Dibuja la copa sola en su lienzo
	function dibujar() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, ancho, alto);
		ctx.lineWidth = 0.7;
		ctx.lineJoin = 'round';

		// 1. Vértices de las orejas: giro, inclinación y perspectiva
		const cf = Math.cos(fi);
		const sf = Math.sin(fi);
		for (let v = 0; v < NV; v++) {
			const x = MX[v] * cf + MZ[v] * sf;
			const z = -MX[v] * sf + MZ[v] * cf;
			const y2 = MY[v] * CT - z * ST;
			const z2 = MY[v] * ST + z * CT;
			const p = DISTANCIA / (DISTANCIA - z2);
			VX[v] = x;
			VY[v] = y2;
			VZ[v] = z2;
			SX[v] = cx + escala * x * p;
			SY[v] = cy - escala * y2 * p;
		}

		// 2. Caras de las orejas que miran a la cámara, con el tono de sus dos bordes y su profundidad
		let visibles = 0;
		for (let q = 0; q < NC; q++) {
			const a = QA[q];
			const b = QB[q];
			const c = QC[q];
			const d = QD[q];
			const mx = (VX[a] + VX[b] + VX[c] + VX[d]) * 0.25;
			const my = (VY[a] + VY[b] + VY[c] + VY[d]) * 0.25;
			const mz = (VZ[a] + VZ[b] + VZ[c] + VZ[d]) * 0.25;
			let base = q * 9;
			let nx = NORMALES[base] * cf + NORMALES[base + 2] * sf;
			let nz = -NORMALES[base] * sf + NORMALES[base + 2] * cf;
			let ny = NORMALES[base + 1] * CT - nz * ST;
			nz = NORMALES[base + 1] * ST + nz * CT;
			if (nz * (DISTANCIA - mz) - nx * mx - ny * my <= 0) continue;

			base += 3;
			nx = NORMALES[base] * cf + NORMALES[base + 2] * sf;
			nz = -NORMALES[base] * sf + NORMALES[base + 2] * cf;
			ny = NORMALES[base + 1] * CT - nz * ST;
			TONO_IZQ[q] = indice(tono(nx, ny));

			base += 3;
			nx = NORMALES[base] * cf + NORMALES[base + 2] * sf;
			nz = -NORMALES[base] * sf + NORMALES[base + 2] * cf;
			ny = NORMALES[base + 1] * CT - nz * ST;
			TONO_DER[q] = indice(tono(nx, ny));

			PROF[q] = mz;
			ORDEN[visibles++] = q;
		}
		const orden = ORDEN.subarray(0, visibles);
		orden.sort(function (p, q) { return PROF[p] - PROF[q]; });

		// 3. De atrás hacia adelante: oreja de atrás, cuerpo, labrados, texto, remate y oreja de adelante
		for (let i = 0; i < visibles; i++) {
			if (PROF[orden[i]] < 0) dibujarCara(orden[i]);
		}
		copiarCapa(capaCuerpo);
		dibujarBandas();
		if (lineas) dibujarTexto();
		dibujarRemate();
		for (let i = 0; i < visibles; i++) {
			if (PROF[orden[i]] >= 0) dibujarCara(orden[i]);
		}

		fiDibujado = fi;
		sucio = false;
	}

	// Elipse de luz o sombra apoyada en el piso
	function manchaEnPiso(radio, paradas) {
		principal.save();
		principal.translate(cx, yBase);
		principal.scale(1, ST * 1.5);
		const degradado = principal.createRadialGradient(0, 0, 0, 0, 0, radio);
		paradas.forEach(function (parada) {
			degradado.addColorStop(parada[0], parada[1]);
		});
		principal.fillStyle = degradado;
		principal.beginPath();
		principal.arc(0, 0, radio, 0, Math.PI * 2);
		principal.fill();
		principal.restore();
	}

	// Copia invertida de la base de la copa, que se desvanece hacia abajo.
	// Es corta a propósito: más arriba aparecería la inscripción al revés.
	function dibujarReflejo() {
		const yPx = Math.round(ySuelo * dpr);
		const altoPx = Math.min(Math.round(escala * 0.4 * dpr), yPx, lienzo.height - yPx);
		if (altoPx < 8) return;
		if (reflejo.width !== lienzo.width || reflejo.height !== altoPx) {
			reflejo.width = lienzo.width;
			reflejo.height = altoPx;
			degradadoReflejo = null;
		}
		if (!degradadoReflejo) {
			degradadoReflejo = pincelReflejo.createLinearGradient(0, 0, 0, altoPx);
			degradadoReflejo.addColorStop(0, 'rgba(0, 0, 0, .46)');
			degradadoReflejo.addColorStop(0.5, 'rgba(0, 0, 0, .14)');
			degradadoReflejo.addColorStop(1, 'rgba(0, 0, 0, 0)');
		}
		pincelReflejo.globalCompositeOperation = 'source-over';
		pincelReflejo.setTransform(1, 0, 0, 1, 0, 0);
		pincelReflejo.clearRect(0, 0, reflejo.width, altoPx);
		pincelReflejo.setTransform(1, 0, 0, -1, 0, altoPx);
		pincelReflejo.drawImage(copa, 0, yPx - altoPx, copa.width, altoPx, 0, 0, copa.width, altoPx);
		pincelReflejo.setTransform(1, 0, 0, 1, 0, 0);
		pincelReflejo.globalCompositeOperation = 'destination-in';
		pincelReflejo.fillStyle = degradadoReflejo;
		pincelReflejo.fillRect(0, 0, reflejo.width, altoPx);
		principal.setTransform(1, 0, 0, 1, 0, 0);
		principal.drawImage(reflejo, 0, yPx);
		principal.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	// Destello de cuatro puntas sobre un brillo del metal
	function dibujarDestello(punto, medida, fase) {
		const pulso = 0.72 + 0.28 * Math.sin(tiempo * 1.3 + fase);
		const radio = escala * medida * pulso;
		const halo = principal.createRadialGradient(punto.x, punto.y, 0, punto.x, punto.y, radio);
		halo.addColorStop(0, 'rgba(255, 255, 255, ' + (0.85 * pulso).toFixed(3) + ')');
		halo.addColorStop(0.25, 'rgba(170, 210, 255, ' + (0.35 * pulso).toFixed(3) + ')');
		halo.addColorStop(1, 'rgba(120, 170, 255, 0)');
		principal.fillStyle = halo;
		principal.beginPath();
		principal.arc(punto.x, punto.y, radio, 0, Math.PI * 2);
		principal.fill();
		// Las puntas: dos rombos muy finos
		principal.fillStyle = 'rgba(235, 244, 255, ' + (0.8 * pulso).toFixed(3) + ')';
		[[radio * 2.3, radio * 0.07], [radio * 0.07, radio * 1.5]].forEach(function (brazo) {
			principal.beginPath();
			principal.moveTo(punto.x - brazo[0], punto.y);
			principal.lineTo(punto.x, punto.y - brazo[1]);
			principal.lineTo(punto.x + brazo[0], punto.y);
			principal.lineTo(punto.x, punto.y + brazo[1]);
			principal.closePath();
			principal.fill();
		});
	}

	// Una mota es un punto de luz difuso; se dibuja una vez y después se copia
	const MOTA = (function () {
		const lado = 48;
		const dibujo = document.createElement('canvas');
		dibujo.width = lado;
		dibujo.height = lado;
		const pincel = dibujo.getContext('2d');
		const luz = pincel.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
		luz.addColorStop(0, 'rgba(240, 247, 255, 1)');
		luz.addColorStop(0.16, 'rgba(205, 228, 255, .8)');
		luz.addColorStop(0.42, 'rgba(130, 185, 255, .2)');
		luz.addColorStop(1, 'rgba(130, 185, 255, 0)');
		pincel.fillStyle = luz;
		pincel.fillRect(0, 0, lado, lado);
		return dibujo;
	})();

	// Motas de luz que suben lentamente alrededor de la copa
	function dibujarPolvo(dt) {
		for (let i = 0; i < motas.length; i++) {
			const mota = motas[i];
			mota.y += mota.sube * dt;
			if (mota.y > 1.7) {
				mota.y = -1.3;
				mota.x = (Math.random() * 2 - 1) * 1.3;
			}
			const x = cx + escala * (mota.x + 0.05 * Math.sin(tiempo * 0.35 + mota.fase));
			const y = cy - escala * mota.y;
			const brillo = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(tiempo * mota.ritmo + mota.fase))) *
				escalon(-1.3, -0.9, mota.y) * (1 - escalon(1.3, 1.7, mota.y));
			const radio = escala * mota.radio * 4;
			principal.globalAlpha = brillo;
			principal.drawImage(MOTA, x - radio, y - radio, radio * 2, radio * 2);
		}
		principal.globalAlpha = 1;
	}

	// Arma lo que se ve: piso, reflejo, copa, destellos y polvo
	function componer(dt) {
		principal.setTransform(dpr, 0, 0, dpr, 0, 0);
		principal.globalCompositeOperation = 'source-over';
		principal.clearRect(0, 0, ancho, alto);

		manchaEnPiso(escala * 1.15, [
			[0, 'rgba(90, 160, 255, .50)'],
			[0.45, 'rgba(70, 100, 235, .17)'],
			[1, 'rgba(60, 80, 220, 0)']
		]);
		manchaEnPiso(escala * 0.42, [
			[0, 'rgba(1, 3, 16, .80)'],
			[0.7, 'rgba(1, 3, 16, .46)'],
			[1, 'rgba(1, 3, 16, 0)']
		]);
		dibujarReflejo();

		principal.setTransform(1, 0, 0, 1, 0, 0);
		principal.drawImage(copa, 0, 0);
		principal.setTransform(dpr, 0, 0, dpr, 0, 0);

		// Destellos sobre el brillo principal del borde, del nudo y del pedestal
		principal.globalCompositeOperation = 'lighter';
		dibujarDestello(enPantalla(-0.36 * 0.295, 0.654, 0.93 * 0.295), 0.075, 0);
		dibujarDestello(enPantalla(-0.36 * 0.089, -0.325, 0.93 * 0.089), 0.04, 2.1);
		dibujarDestello(enPantalla(-0.36 * 0.236, -0.68, 0.93 * 0.236), 0.045, 4.2);
		dibujarPolvo(dt);
		principal.globalCompositeOperation = 'source-over';
	}

	let previo = 0;
	function cuadro(ahora) {
		requestAnimationFrame(cuadro);
		const dt = Math.min((ahora - previo) / 1000, 0.1);
		previo = ahora;
		if (!ancho) return;

		const quieta = movimientoReducido.matches;
		if (!arrastrando) {
			// Tras soltarla, la copa vuelve de a poco a su giro lento
			velocidad += (velocidadBase() - velocidad) * (1 - Math.exp(-dt / 1.3));
			if (Math.abs(velocidad) < 0.0005) velocidad = 0;
			fi += velocidad * dt;
		}
		// Con movimiento reducido solo se redibuja si algo cambió
		if (quieta && !sucio && fi === fiDibujado) return;

		pendiente += quieta ? 0 : dt;
		alterna = !alterna;
		if (medioRitmo && alterna && !sucio) return;

		const t0 = performance.now();
		tiempo += pendiente;
		dibujar();
		componer(pendiente);
		pendiente = 0;
		// Si el equipo es lento, se dibuja un cuadro por medio
		costo = costo * 0.92 + (performance.now() - t0) * 0.08;
		if (!medioRitmo && costo > 13) medioRitmo = true;
	}

	// ---------- Arrastrar para girar ----------
	lienzo.addEventListener('pointerdown', function (evento) {
		arrastrando = true;
		ultimoX = evento.clientX;
		ultimoT = performance.now();
		velocidad = 0;
		lienzo.classList.add('arrastrando');
		if (lienzo.setPointerCapture) lienzo.setPointerCapture(evento.pointerId);
	});
	lienzo.addEventListener('pointermove', function (evento) {
		if (!arrastrando) return;
		const ahora = performance.now();
		const delta = (evento.clientX - ultimoX) / (escala * 0.27);
		const dt = Math.max((ahora - ultimoT) / 1000, 0.001);
		fi += delta;
		velocidad = velocidad * 0.6 + (delta / dt) * 0.4;
		velocidad = Math.max(-9, Math.min(9, velocidad));
		ultimoX = evento.clientX;
		ultimoT = ahora;
	});
	function soltar() {
		if (!arrastrando) return;
		arrastrando = false;
		if (performance.now() - ultimoT > 120) velocidad = 0;
		lienzo.classList.remove('arrastrando');
	}
	lienzo.addEventListener('pointerup', soltar);
	lienzo.addEventListener('pointercancel', soltar);

	// ---------- Arranque ----------
	if (movimientoReducido.matches) fi = 0;	// quieta y con la inscripción al frente

	if ('ResizeObserver' in window) {
		const observador = new ResizeObserver(encuadrar);
		observador.observe(lienzo);
		observador.observe(marco);
	} else {
		window.addEventListener('resize', encuadrar);
	}
	encuadrar();

	// La inscripción espera a las tipografías; si tardan, usa la de respaldo
	// y se vuelve a medir cuando llegan
	function activarTexto() {
		prepararTexto();
		lienzo.classList.add('lista');
	}
	if (document.fonts && document.fonts.load) {
		Promise.all(INSCRIPCION.map(function (linea) {
			return document.fonts.load(linea.fuente);
		})).then(activarTexto, activarTexto);
		setTimeout(activarTexto, 2500);
	} else {
		activarTexto();
	}

	// Para depurar desde la consola: window.copaSDR.costo() entrega los ms por cuadro
	window.copaSDR = {
		costo: function () { return { ms: Math.round(costo * 100) / 100, medioRitmo: medioRitmo }; },
		girar: function (angulo) { fi = angulo; velocidad = 0; sucio = true; }
	};

	requestAnimationFrame(cuadro);
})();
