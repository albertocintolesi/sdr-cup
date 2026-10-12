/* Copa giratoria de la SDR Cup.
   Se dibuja en un canvas 2D, sin librerías, a partir del perfil de la copa:

   - El cuerpo liso es igual desde cualquier ángulo, así que se arma una sola
     vez como "anillos" con un degradado horizontal que imita el metal pulido.
   - Los gallones de la parte baja, las asas y la inscripción sí cambian al
     girar: se calculan en cada cuadro. */
(function () {
	'use strict';

	const lienzo = document.getElementById('copa');
	if (!lienzo || !lienzo.getContext) return;
	const ctx = lienzo.getContext('2d');

	// ---------- Parámetros que se pueden ajustar ----------
	const SEGUNDOS_POR_VUELTA = 32;
	const INCLINACION = 0.24;	// radianes: cuánto se mira la copa desde arriba
	const DISTANCIA = 7;		// distancia de la cámara (perspectiva suave)
	const SEG = 96;				// divisiones alrededor del eje en la zona de gallones
	const GAJOS = 12;			// cantidad de gallones
	const PUNTOS_ANILLO = 96;	// puntos con que se traza cada anillo liso
	const PARADAS = 40;			// pasos del degradado de cada anillo

	// "y" es la línea base del texto y "alto" la altura de las mayúsculas,
	// en las mismas unidades del perfil (la copa mide 2,5 de alto).
	const INSCRIPCION = [
		{ texto: 'SDR CUP', fuente: '600 100px Chillax, sans-serif', alto: 0.185, y: 0.74, espacio: 0.04 },
		{ texto: 'NEW GENERATION', fuente: '600 100px "General Sans", sans-serif', alto: 0.062, y: 0.56, espacio: 0.24 }
	];
	const ARCO_MAXIMO = 1.75;	// radianes que puede ocupar cada línea de texto

	// Perfil de la copa: pares [radio, altura], de abajo hacia arriba por fuera
	// y luego de vuelta hacia abajo por dentro del cáliz.
	const TRAMOS = [
		{ pts: [[0.43, -1.25], [0.43, -1.15]], sub: 1 },
		{ pts: [[0.43, -1.15], [0.37, -1.13]], sub: 1 },
		{ pts: [[0.37, -1.13], [0.37, -1.07]], sub: 1 },
		{ pts: [[0.37, -1.07], [0.30, -1.04], [0.19, -0.98], [0.11, -0.88], [0.075, -0.76]], sub: 14 },
		{ pts: [[0.075, -0.76], [0.115, -0.71], [0.14, -0.66], [0.115, -0.61], [0.075, -0.56]], sub: 12 },
		{ pts: [[0.075, -0.56], [0.068, -0.48], [0.085, -0.42]], sub: 8 },
		{ pts: [[0.085, -0.42], [0.17, -0.36], [0.27, -0.27], [0.36, -0.14], [0.42, 0.02], [0.445, 0.16]], sub: 4, gallon: true },
		{ pts: [[0.445, 0.16], [0.474, 0.18], [0.474, 0.215], [0.458, 0.235]], sub: 6 },
		{ pts: [[0.458, 0.235], [0.462, 0.45], [0.48, 0.75], [0.515, 1.02], [0.55, 1.17], [0.59, 1.235]], sub: 14 },
		{ pts: [[0.59, 1.235], [0.598, 1.25], [0.554, 1.25]], sub: 1, brillo: 0.3 },
		{ pts: [[0.554, 1.25], [0.515, 1.17], [0.485, 1.02], [0.452, 0.75], [0.432, 0.45], [0.40, 0.16], [0.33, -0.08], [0.22, -0.24], [0.09, -0.33], [0, -0.35]], sub: 8, interior: true }
	];

	// Asas: curva de Bézier en el plano [distancia al eje, altura]
	const ASA = [[0.48, 1.0], [0.86, 1.15], [0.88, 0.35], [0.36, 0.02]];
	const ASA_TRAMOS = 40;
	const ASA_LADOS = 14;

	// Rampa de color del metal, de la sombra al brillo (paleta de Brolly)
	const RAMPA_PARADAS = [
		[0.00, 19, 17, 62],
		[0.20, 45, 37, 142],
		[0.42, 75, 63, 191],
		[0.60, 60, 94, 200],
		[0.74, 46, 125, 209],
		[0.87, 150, 160, 244],
		[1.00, 255, 255, 255]
	];

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

	const RAMPA = (function () {
		const colores = [];
		for (let i = 0; i < 256; i++) {
			const t = i / 255;
			let k = 1;
			while (k < RAMPA_PARADAS.length - 1 && RAMPA_PARADAS[k][0] < t) k++;
			const a = RAMPA_PARADAS[k - 1];
			const b = RAMPA_PARADAS[k];
			const f = (t - a[0]) / (b[0] - a[0]);
			colores.push('rgb(' +
				Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
				Math.round(a[2] + (b[2] - a[2]) * f) + ',' +
				Math.round(a[3] + (b[3] - a[3]) * f) + ')');
		}
		return colores;
	})();

	function color(t) {
		return RAMPA[t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0];
	}

	// Tono del metal según hacia dónde mira la superficie (nx: derecha, ny: arriba)
	function tono(nx, ny) {
		let t = 0.33 + 0.27 * ny;
		t += 0.30 * Math.exp(-((nx + 0.40) * (nx + 0.40)) / 0.07);	// reflejo amplio
		t += 0.42 * Math.exp(-((nx + 0.47) * (nx + 0.47)) / 0.006);	// brillo principal
		t += 0.26 * Math.exp(-((nx - 0.63) * (nx - 0.63)) / 0.010);	// brillo secundario
		t -= 0.10 * Math.exp(-((nx - 0.18) * (nx - 0.18)) / 0.04);	// centro más profundo
		const borde = Math.abs(nx);
		if (borde > 0.82) t -= (borde - 0.82) * 1.3;
		return t;
	}

	const CT = Math.cos(INCLINACION);
	const ST = Math.sin(INCLINACION);

	// ---------- Perfil ----------
	const filas = [];		// { r, y, gallon }
	const franjas = [];		// franja entre la fila i y la i + 1
	TRAMOS.forEach(function (tramo, n) {
		const pts = suavizar(tramo.pts, tramo.sub);
		for (let i = (n === 0 ? 0 : 1); i < pts.length; i++) {
			const y = pts[i][1];
			if (filas.length) franjas.push({ tramo: tramo });
			filas.push({
				r: Math.max(pts[i][0], 0),
				y: y,
				gallon: tramo.gallon ? 0.085 * escalon(-0.42, -0.30, y) * (1 - escalon(0.0, 0.15, y)) : 0
			});
		}
	});
	franjas.forEach(function (franja, i) {
		const a = filas[i];
		const b = filas[i + 1];
		const largo = Math.hypot(b.r - a.r, b.y - a.y) || 1;
		franja.a = a;
		franja.b = b;
		// Normal de la franja en el plano del perfil: hacia afuera por fuera, hacia el eje por dentro
		franja.nr = (b.y - a.y) / largo;
		franja.ny = -(b.r - a.r) / largo;
		franja.gallon = !!franja.tramo.gallon;
		franja.brillo = franja.tramo.brillo || 0;
		// El interior del cáliz se oscurece hacia el fondo
		franja.luz = franja.tramo.interior ? 0.26 + 0.42 * escalon(-0.35, 1.25, (a.y + b.y) / 2) : 1;
	});
	const primeraGallon = franjas.findIndex(function (f) { return f.gallon; });

	function radioEn(y) {
		for (let i = 0; i < franjas.length; i++) {
			const f = franjas[i];
			if (f.tramo.interior) break;
			if (y >= f.a.y && y <= f.b.y && f.b.y > f.a.y) {
				return f.a.r + (f.b.r - f.a.r) * (y - f.a.y) / (f.b.y - f.a.y);
			}
		}
		return 0.5;
	}

	// ---------- Malla de lo que cambia al girar: gallones y asas ----------
	const vx = [];
	const vy = [];
	const vz = [];
	const caras = [];	// caras de las asas: { a, b, c, d, n, nIzq, nDer }

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
	function mezcla(a, pa, b, pb) {
		return unitario([a[0] * pa + b[0] * pb, a[1] * pa + b[1] * pb, a[2] * pa + b[2] * pb]);
	}

	// Gallones: las filas de ese tramo, repetidas alrededor del eje con el radio ondulado.
	// Sus vértices van primero: el vértice de la fila i y la columna j es i * SEG + j.
	const filasGallon = [];
	franjas.forEach(function (franja, i) {
		if (!franja.gallon) return;
		if (!filasGallon.length) filasGallon.push(filas[i]);
		filasGallon.push(filas[i + 1]);
	});
	filasGallon.forEach(function (fila) {
		for (let j = 0; j < SEG; j++) {
			const angulo = (j / SEG) * Math.PI * 2;
			const r = fila.r * (1 - fila.gallon * (1 - Math.abs(Math.cos(GAJOS * angulo / 2))));
			vx.push(r * Math.sin(angulo));
			vy.push(fila.y);
			vz.push(r * Math.cos(angulo));
		}
	});
	const NG = filasGallon.length - 1;	// franjas de gallón
	const NORMALES_GALLON = new Float32Array(NG * SEG * 3);
	for (let i = 0; i < NG; i++) {
		for (let j = 0; j < SEG; j++) {
			const sig = (j + 1) % SEG;
			NORMALES_GALLON.set(normalDeCara({ a: i * SEG + j, b: i * SEG + sig, c: (i + 1) * SEG + sig, d: (i + 1) * SEG + j }), (i * SEG + j) * 3);
		}
	}

	// Asas: un tubo que sigue la curva, una a cada lado
	function bezier(t, eje) {
		const u = 1 - t;
		return u * u * u * ASA[0][eje] + 3 * u * u * t * ASA[1][eje] + 3 * u * t * t * ASA[2][eje] + t * t * t * ASA[3][eje];
	}
	function bezierDerivada(t, eje) {
		const u = 1 - t;
		return 3 * u * u * (ASA[1][eje] - ASA[0][eje]) + 6 * u * t * (ASA[2][eje] - ASA[1][eje]) + 3 * t * t * (ASA[3][eje] - ASA[2][eje]);
	}
	[1, -1].forEach(function (lado) {
		const base = vx.length;
		for (let k = 0; k <= ASA_TRAMOS; k++) {
			const t = k / ASA_TRAMOS;
			const ro = bezier(t, 0);
			const y = bezier(t, 1);
			let dr = bezierDerivada(t, 0);
			let dy = bezierDerivada(t, 1);
			const largo = Math.hypot(dr, dy) || 1;
			dr /= largo;
			dy /= largo;
			const grosor = 0.03 + 0.022 * Math.sin(Math.PI * t);
			for (let u = 0; u < ASA_LADOS; u++) {
				const giro = (u / ASA_LADOS) * Math.PI * 2;
				const enPlano = Math.cos(giro) * grosor;
				const alCostado = Math.sin(giro) * grosor * 1.35;
				vx.push(lado * (ro - dy * enPlano));
				vy.push(y + dr * enPlano);
				vz.push(-lado * alCostado);
			}
		}
		// Cada cara une el anillo k con el k + 1. Sus bordes "izquierdo" y "derecho"
		// son esos dos anillos, para que el degradado corra a lo largo del tubo.
		const tubo = [];
		for (let k = 0; k < ASA_TRAMOS; k++) {
			const t = (k + 0.5) / ASA_TRAMOS;
			const anillo = [];
			for (let u = 0; u < ASA_LADOS; u++) {
				const sig = (u + 1) % ASA_LADOS;
				const cara = {
					a: base + k * ASA_LADOS + u,
					b: base + (k + 1) * ASA_LADOS + u,
					c: base + (k + 1) * ASA_LADOS + sig,
					d: base + k * ASA_LADOS + sig
				};
				// La normal debe apuntar hacia afuera del tubo
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
				cara.nIzq = k > 0 ? mezcla(cara.n, 1, tubo[k - 1][u].n, 1) : cara.n;
				cara.nDer = k < ASA_TRAMOS - 1 ? mezcla(cara.n, 1, tubo[k + 1][u].n, 1) : cara.n;
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
	const COLUMNAS = new Uint16Array(SEG);
	const PROF_COLUMNA = new Float32Array(SEG);
	const TONO_GALLON = new Uint8Array(NG);

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
		// Las asas se miden girándolas media vuelta
		for (let paso = 0; paso < 16; paso++) {
			const fi = (paso / 16) * Math.PI;
			const cf = Math.cos(fi);
			const sf = Math.sin(fi);
			for (let v = 0; v < NV; v++) {
				medir(MX[v] * cf + MZ[v] * sf, MY[v], -MX[v] * sf + MZ[v] * cf);
			}
		}
		return { maxX: maxX, minY: minY - 0.08, maxY: maxY + 0.02 };
	})();

	// ---------- Estado ----------
	const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
	let ancho = 0;
	let alto = 0;
	let dpr = 1;
	let escala = 1;
	let cx = 0;
	let cy = 0;
	let capaBaja = null;	// interior del cáliz y pie, ya pintados
	let capaAlta = null;	// moldura, cuerpo y borde, ya pintados
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

	function velocidadBase() {
		// Negativa: la superficie avanza hacia la izquierda y el texto entra por su primera letra
		return movimientoReducido.matches ? 0 : -(Math.PI * 2) / SEGUNDOS_POR_VUELTA;
	}

	function encuadrar() {
		const rect = lienzo.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		ancho = rect.width;
		alto = rect.height;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		lienzo.width = Math.round(ancho * dpr);
		lienzo.height = Math.round(alto * dpr);
		escala = Math.min((ancho * 0.95) / (2 * caja.maxX), (alto * 0.97) / (caja.maxY - caja.minY));
		cx = ancho / 2;
		cy = alto / 2 + escala * (caja.maxY + caja.minY) / 2;
		pintarCuerpo();
		sucio = true;
	}

	function nuevaCapa() {
		const capa = document.createElement('canvas');
		capa.width = lienzo.width;
		capa.height = lienzo.height;
		const pincel = capa.getContext('2d');
		pincel.setTransform(dpr, 0, 0, dpr, 0, 0);
		pincel.lineWidth = 0.7;
		pincel.lineJoin = 'round';
		return { lienzo: capa, pincel: pincel };
	}

	// Pinta el cuerpo liso en dos capas que luego se copian en cada cuadro.
	// Solo depende del tamaño del lienzo, no del giro.
	function pintarCuerpo() {
		capaBaja = nuevaCapa();
		capaAlta = nuevaCapa();
		// El interior va primero: todo lo demás lo tapa
		franjas.forEach(function (franja) {
			if (franja.tramo.interior) pintarFranja(franja, capaBaja.pincel);
		});
		franjas.forEach(function (franja, indice) {
			if (franja.tramo.interior || franja.gallon) return;
			pintarFranja(franja, indice < primeraGallon ? capaBaja.pincel : capaAlta.pincel);
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
			relleno = color((tono(0, franja.ny * CT - Math.abs(franja.nr) * ST) + franja.brillo) * franja.luz);
		} else {
			relleno = pincel.createLinearGradient(cx - radio, 0, cx + radio, 0);
			for (let k = 0; k <= PARADAS; k++) {
				const s = -1 + (2 * k) / PARADAS;
				const haciaCamara = Math.abs(franja.nr) * Math.sqrt(1 - s * s);
				const t = tono(franja.nr * s, franja.ny * CT - haciaCamara * ST) + franja.brillo;
				relleno.addColorStop(k / PARADAS, color(t * franja.luz));
			}
		}
		pincel.fillStyle = relleno;
		pincel.strokeStyle = relleno;
		pincel.fill(trazo, regla);
		pincel.stroke(trazo);	// tapa las rendijas entre franjas vecinas
	}

	// Mide la inscripción con las tipografías ya cargadas
	function prepararTexto() {
		lineas = INSCRIPCION.map(function (linea) {
			ctx.font = linea.fuente;
			const altoPx = ctx.measureText('H').actualBoundingBoxAscent || 70;
			let unidad = linea.alto / altoPx;	// unidades de la copa por píxel de fuente
			const letras = Array.from(linea.texto);
			const extra = linea.espacio * 100;
			const anchos = letras.map(function (letra) {
				return ctx.measureText(letra).width;
			});
			const total = anchos.reduce(function (suma, w) { return suma + w + extra; }, -extra);
			const radio = radioEn(linea.y + linea.alto / 2) * 1.004;
			if ((total * unidad) / radio > ARCO_MAXIMO) unidad = (ARCO_MAXIMO * radio) / total;
			const angulos = [];
			let x = -total / 2;
			anchos.forEach(function (w) {
				angulos.push(((x + w / 2) * unidad) / radio);
				x += w + extra;
			});
			return { letras: letras, angulos: angulos, unidad: unidad, radio: radio, y: linea.y, fuente: linea.fuente };
		});
		sucio = true;
	}

	function dibujarSombra() {
		const yBase = -1.25;
		const p = DISTANCIA / (DISTANCIA - yBase * ST);
		const radio = escala * 0.8 * p;
		ctx.save();
		ctx.translate(cx, cy - escala * yBase * CT * p + escala * 0.012);
		ctx.scale(1, ST * 1.15);
		const degradado = ctx.createRadialGradient(0, 0, radio * 0.3, 0, 0, radio);
		degradado.addColorStop(0, 'rgba(43, 35, 130, .36)');
		degradado.addColorStop(0.55, 'rgba(43, 35, 130, .12)');
		degradado.addColorStop(1, 'rgba(43, 35, 130, 0)');
		ctx.fillStyle = degradado;
		ctx.beginPath();
		ctx.arc(0, 0, radio, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	function copiarCapa(capa) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(capa.lienzo, 0, 0);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function dibujarCara(q) {
		const a = QA[q];
		const b = QB[q];
		const c = QC[q];
		const d = QD[q];
		let relleno = RAMPA[TONO_IZQ[q]];
		if (TONO_IZQ[q] !== TONO_DER[q]) {
			// Degradado del borde izquierdo al derecho de la cara
			const x1 = (SX[a] + SX[d]) / 2;
			const y1 = (SY[a] + SY[d]) / 2;
			const x2 = (SX[b] + SX[c]) / 2;
			const y2 = (SY[b] + SY[c]) / 2;
			if (Math.abs(x2 - x1) + Math.abs(y2 - y1) > 0.75) {
				relleno = ctx.createLinearGradient(x1, y1, x2, y2);
				relleno.addColorStop(0, RAMPA[TONO_IZQ[q]]);
				relleno.addColorStop(1, RAMPA[TONO_DER[q]]);
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

	// Los gallones se pintan por columnas, de arriba abajo: cada columna es una tira
	// con un degradado vertical, y así el brillo corre a lo largo del gallón.
	function dibujarGallones(cf, sf) {
		const filaMedia = (NG >> 1) * SEG;
		for (let j = 0; j < SEG; j++) {
			COLUMNAS[j] = j;
			PROF_COLUMNA[j] = VZ[filaMedia + j] + VZ[filaMedia + (j + 1) % SEG];
		}
		COLUMNAS.sort(function (p, q) { return PROF_COLUMNA[p] - PROF_COLUMNA[q]; });

		for (let n = 0; n < SEG; n++) {
			const j = COLUMNAS[n];
			const sig = (j + 1) % SEG;
			let desde = -1;
			for (let i = 0; i <= NG; i++) {
				let deFrente = false;
				if (i < NG) {
					const a = i * SEG + j;
					const b = i * SEG + sig;
					const c = a + SEG;
					const d = b + SEG;
					const base = (i * SEG + j) * 3;
					const nx = NORMALES_GALLON[base] * cf + NORMALES_GALLON[base + 2] * sf;
					let nz = -NORMALES_GALLON[base] * sf + NORMALES_GALLON[base + 2] * cf;
					const ny = NORMALES_GALLON[base + 1] * CT - nz * ST;
					nz = NORMALES_GALLON[base + 1] * ST + nz * CT;
					const mx = (VX[a] + VX[b] + VX[c] + VX[d]) * 0.25;
					const my = (VY[a] + VY[b] + VY[c] + VY[d]) * 0.25;
					const mz = (VZ[a] + VZ[b] + VZ[c] + VZ[d]) * 0.25;
					deFrente = nz * (DISTANCIA - mz) - nx * mx - ny * my > 0;
					if (deFrente) {
						const t = tono(nx, ny);
						TONO_GALLON[i] = t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;
					}
				}
				if (deFrente && desde < 0) desde = i;
				if (!deFrente && desde >= 0) {
					dibujarTira(j, sig, desde, i);
					desde = -1;
				}
			}
		}
	}

	// Tira de una columna de gallón entre las filas "desde" y "hasta"
	function dibujarTira(j, sig, desde, hasta) {
		const x1 = (SX[desde * SEG + j] + SX[desde * SEG + sig]) / 2;
		const y1 = (SY[desde * SEG + j] + SY[desde * SEG + sig]) / 2;
		const x2 = (SX[hasta * SEG + j] + SX[hasta * SEG + sig]) / 2;
		const y2 = (SY[hasta * SEG + j] + SY[hasta * SEG + sig]) / 2;
		const dx = x2 - x1;
		const dy = y2 - y1;
		const largo2 = dx * dx + dy * dy;
		let relleno = RAMPA[TONO_GALLON[desde]];
		if (hasta - desde > 1 && largo2 > 1) {
			relleno = ctx.createLinearGradient(x1, y1, x2, y2);
			let previo = 0;
			for (let i = desde; i < hasta; i++) {
				// Cada cara aporta su tono en el punto medio de su tramo
				const mx = (SX[i * SEG + j] + SX[i * SEG + sig] + SX[(i + 1) * SEG + j] + SX[(i + 1) * SEG + sig]) / 4;
				const my = (SY[i * SEG + j] + SY[i * SEG + sig] + SY[(i + 1) * SEG + j] + SY[(i + 1) * SEG + sig]) / 4;
				let donde = ((mx - x1) * dx + (my - y1) * dy) / largo2;
				donde = Math.min(Math.max(donde, previo), 1);
				relleno.addColorStop(donde, RAMPA[TONO_GALLON[i]]);
				previo = donde;
			}
		}
		ctx.fillStyle = relleno;
		ctx.strokeStyle = relleno;
		ctx.beginPath();
		ctx.moveTo(SX[desde * SEG + j], SY[desde * SEG + j]);
		for (let i = desde + 1; i <= hasta; i++) ctx.lineTo(SX[i * SEG + j], SY[i * SEG + j]);
		for (let i = hasta; i >= desde; i--) ctx.lineTo(SX[i * SEG + sig], SY[i * SEG + sig]);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
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
					ctx.setTransform(k * c, -k * s * ST, 0, k * CT,
						(cx + escala * linea.radio * s * p) * dpr,
						(cy - escala * y2 * p) * dpr);
					const alfa = escalon(0.15, 0.6, c);
					ctx.fillStyle = 'rgba(19, 17, 62, ' + (0.5 * alfa).toFixed(3) + ')';
					ctx.fillText(linea.letras[i], 2.5, 3.5);
					ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.97 * alfa).toFixed(3) + ')';
					ctx.fillText(linea.letras[i], 0, 0);
				}
			}
		});
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function dibujar() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, ancho, alto);
		ctx.lineWidth = 0.7;
		ctx.lineJoin = 'round';

		// 1. Vértices de gallones y asas: giro, inclinación y perspectiva
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

		// 2. Caras de las asas que miran a la cámara, con el tono de sus dos bordes y su profundidad
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
			let t = tono(nx, ny);
			TONO_IZQ[q] = t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;

			base += 3;
			nx = NORMALES[base] * cf + NORMALES[base + 2] * sf;
			nz = -NORMALES[base] * sf + NORMALES[base + 2] * cf;
			ny = NORMALES[base + 1] * CT - nz * ST;
			t = tono(nx, ny);
			TONO_DER[q] = t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;

			PROF[q] = mz;
			ORDEN[visibles++] = q;
		}
		const orden = ORDEN.subarray(0, visibles);
		orden.sort(function (p, q) { return PROF[p] - PROF[q]; });

		// 3. De atrás hacia adelante: sombra, asa de atrás, interior y pie, gallones, cáliz, texto y asa de adelante
		dibujarSombra();
		for (let i = 0; i < visibles; i++) {
			if (PROF[orden[i]] < 0) dibujarCara(orden[i]);
		}
		copiarCapa(capaBaja);
		dibujarGallones(cf, sf);
		copiarCapa(capaAlta);
		if (lineas) dibujarTexto();
		for (let i = 0; i < visibles; i++) {
			if (PROF[orden[i]] >= 0) dibujarCara(orden[i]);
		}

		fiDibujado = fi;
		sucio = false;
	}

	let previo = 0;
	function cuadro(ahora) {
		requestAnimationFrame(cuadro);
		const dt = Math.min((ahora - previo) / 1000, 0.1);
		previo = ahora;
		if (!ancho) return;

		if (!arrastrando) {
			// Tras soltarla, la copa vuelve de a poco a su giro lento
			velocidad += (velocidadBase() - velocidad) * (1 - Math.exp(-dt / 1.3));
			if (Math.abs(velocidad) < 0.0005) velocidad = 0;
			fi += velocidad * dt;
		}
		if (!sucio && fi === fiDibujado) return;

		alterna = !alterna;
		if (medioRitmo && alterna && !sucio) return;

		const t0 = performance.now();
		dibujar();
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
		const delta = (evento.clientX - ultimoX) / (escala * 0.5);
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
		new ResizeObserver(encuadrar).observe(lienzo);
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
