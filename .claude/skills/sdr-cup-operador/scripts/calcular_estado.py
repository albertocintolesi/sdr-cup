"""Calcula el estado público de la Cup (lo que lee la landing) a partir del registro privado.

Uso:
	python3 calcular_estado.py REGISTRO.json --config CONFIG.json --salida datos/estado.json --ahora 2026-10-13T14:05:00

La página no calcula nada: todo total sale de aquí. Los puntos de cada evento ya vienen
fijados en el registro (ver reglas.py); este script solo suma, ordena y arma los textos.

Al estado público NO pasan: apodos, notas internas, motivos internos, pendientes ni
(salvo que config.json lo permita) nombres de empresas.
"""

import argparse
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reglas import (  # noqa: E402
	CASILLA, LEGENDARIOS, empresa_mencionada, evento_raiz, guardar_json, leer_json, leer_registro, situacion,
)

# Textos que se dejaron fuera del estado por nombrar a una empresa (se informan al final).
OMITIDOS = []


def con_offset(fecha_hora, offset):
	"""'2026-10-13T10:34:00' -> '2026-10-13T10:34:00-03:00'."""
	return fecha_hora + offset if fecha_hora else None


def texto_publico(texto, empresas, donde=""):
	"""Devuelve el texto solo si no nombra a una empresa del registro (protege a los prospectos).

	registrar.py ya lo impide al entrar; esto es la última barrera antes de publicar.
	"""
	if not texto:
		return None
	if empresa_mencionada(texto, empresas):
		OMITIDOS.append(donde)
		return None
	return texto


def titulo_de(evento, raiz, nombres_sdr, nombres_squad, desafios, empresa):
	"""Título listo para mostrar. No usa notas internas ni citas del chat.

	Lo que se registró en revisión lleva un título que no da el hecho por cierto.
	"""
	tipo = evento["tipo"]
	en_duda = bool(evento.get("en_revision"))
	quien = nombres_sdr.get(evento.get("sdr")) or nombres_squad.get(evento.get("squad"), "")
	nombre = desafios.get(evento.get("desafio"), {}).get("nombre", "")
	if tipo == "reunion_agendada":
		hecho = "informó una reunión" if en_duda else "agendó una reunión"
		return f"{quien} {hecho}" + (f" con {empresa}" if empresa else "")
	if tipo == "reunion_realizada":
		return f"Se informó como realizada una reunión de {quien}" if en_duda else f"Se realizó una reunión de {quien}"
	if tipo == "combo_diario":
		return f"Combo diario de {quien}"
	if tipo == "mision":
		hecho = "podría sumar la misión" if en_duda else "cumplió la misión"
		return f"{quien} {hecho}" + (f": {nombre}" if nombre else "")
	if tipo == "flash":
		hecho = "reclamó el Flash Challenge" if en_duda else "ganó el Flash Challenge"
		return f"{quien} {hecho}" + (f": {nombre}" if nombre else "")
	if tipo == "legendario":
		return f"{quien} logró el legendario {LEGENDARIOS[evento['legendario']]['nombre']}"
	if tipo == "ajuste":
		return f"Ajuste del árbitro para {quien}"
	que = "el combo diario" if raiz["tipo"] == "combo_diario" else "un puntaje"
	verbo = "Se anuló" if tipo == "anulacion" else "Se confirmó"
	return f"{verbo} {que} de {quien}"


def calcular_estado(registro, config, ahora):
	cup = config["cup"]
	offset = cup["utc_offset"]
	squads_config = config["squads"]
	nombres_squad = {s["id"]: s["nombre"] for s in squads_config}
	nombres_sdr = {i["id"]: i["nombre"] for s in squads_config for i in s["integrantes"]}
	desafios = {d["id"]: d for d in registro["desafios"]}
	publicar_empresa = bool(config.get("publicar_empresa"))

	eventos = registro["eventos"]
	por_id = {e["id"]: e for e in eventos}
	anulados, pendientes = situacion(eventos)
	# Nombres de empresas que no deben colarse en los textos públicos.
	empresas = set() if publicar_empresa else {e["empresa"] for e in eventos if e.get("empresa")}

	# Acumuladores por squad, por SDR y por día.
	casillas = {casilla: 0 for casilla in dict.fromkeys(CASILLA.values())}
	squads = {
		s["id"]: {"puntos": 0, "en_revision": 0, "desglose": dict(casillas), "agendadas": 0, "realizadas": 0}
		for s in squads_config
	}
	sdrs = {sdr: {"puntos": 0, "agendadas": 0, "realizadas": 0, "ultima": None} for sdr in nombres_sdr}
	dias_cup = []
	dia = date.fromisoformat(cup["inicio"][:10])
	while dia <= date.fromisoformat(cup["cierre"][:10]):
		# Sábado y domingo no son días de la Cup (importa si el cierre se extiende a la semana siguiente).
		if dia.weekday() < 5:
			dias_cup.append(dia.isoformat())
		dia += timedelta(days=1)
	por_dia = {d: {s: 0 for s in squads} for d in dias_cup}
	combo_dia = {d: {s: False for s in squads} for d in dias_cup}

	feed = []
	orden = sorted(range(len(eventos)), key=lambda i: (eventos[i]["fecha_hora"], i))
	for evento in (eventos[i] for i in orden):
		tipo, squad, sdr = evento["tipo"], evento.get("squad"), evento.get("sdr")
		raiz = evento_raiz(evento, por_id)
		puntos = evento["puntos"]
		anulado = evento["id"] in anulados
		pendiente = evento["id"] in pendientes
		vigente = not anulado and not pendiente
		dia = evento["fecha_hora"][:10]

		if squad in squads:
			squads[squad]["puntos"] += puntos
			squads[squad]["desglose"][CASILLA[raiz["tipo"]]] += puntos
			if pendiente:
				squads[squad]["en_revision"] += evento.get("puntos_en_revision", 0)
			# Un día fuera de la Cup (p. ej. un ajuste posterior al cierre o de un fin de semana) se
			# carga al último día hábil anterior, o al primero si es anterior al inicio.
			dia_grafico = max((d for d in dias_cup if d <= dia), default=dias_cup[0])
			por_dia[dia_grafico][squad] += puntos
			if tipo == "combo_diario" and vigente and evento["dia"] in combo_dia:
				combo_dia[evento["dia"]][squad] = True
			if tipo == "reunion_agendada" and vigente:
				squads[squad]["agendadas"] += 1
			if tipo == "reunion_realizada" and vigente:
				squads[squad]["realizadas"] += 1
		if sdr in sdrs:
			sdrs[sdr]["puntos"] += puntos
			if tipo in ("reunion_agendada", "reunion_realizada", "mision", "flash") and vigente:
				sdrs[sdr]["ultima"] = con_offset(evento["fecha_hora"], offset)
			if tipo == "reunion_agendada" and vigente:
				sdrs[sdr]["agendadas"] += 1
			if tipo == "reunion_realizada" and vigente:
				sdrs[sdr]["realizadas"] += 1

		# El detalle público lo escribe el Operador aparte del motivo interno. Los eventos
		# automáticos (combos y sus reversas) traen textos fijos que sí se pueden mostrar.
		detalle = evento.get("detalle_publico")
		if tipo == "combo_diario":
			detalle = "Dos o más integrantes agendaron el mismo día"
		elif evento.get("auto"):
			detalle = evento.get("motivo")
		empresa = evento.get("empresa") if publicar_empresa and tipo == "reunion_agendada" else None
		origen = evento.get("origen") or {}
		feed.append({
			"id": evento["id"],
			"tipo": tipo,
			"fecha_hora": con_offset(evento["fecha_hora"], offset),
			"squad": squad,
			"sdr": sdr,
			"puntos": puntos,
			"puntos_en_revision": evento.get("puntos_en_revision", 0) if pendiente else 0,
			"titulo": titulo_de(evento, raiz, nombres_sdr, nombres_squad, desafios, empresa),
			"detalle": texto_publico(detalle, empresas, evento["id"]),
			"empresa": empresa,
			"ref": evento.get("ref"),
			"anulado": anulado,
			"en_revision": pendiente,
			"origen": {
				"mensaje": origen.get("mensaje"),
				"hora": evento["fecha_hora"][11:16],
				"fuente": "correo" if origen.get("correo") else "instruccion" if origen.get("instruccion") else "chat",
			},
		})
	feed.reverse()

	# Posiciones: en empate, los squads comparten posición.
	lista_squads = []
	for s in sorted(squads_config, key=lambda s: -squads[s["id"]]["puntos"]):
		datos = squads[s["id"]]
		integrantes = sorted(s["integrantes"], key=lambda i: -sdrs[i["id"]]["puntos"])
		lista_squads.append({
			"id": s["id"],
			"nombre": s["nombre"],
			"posicion": 1 + sum(1 for otro in squads.values() if otro["puntos"] > datos["puntos"]),
			"puntos": datos["puntos"],
			"puntos_en_revision": datos["en_revision"],
			"desglose": datos["desglose"],
			"reuniones_agendadas": datos["agendadas"],
			"reuniones_realizadas": datos["realizadas"],
			"integrantes": [{
				"id": i["id"],
				"nombre": i["nombre"],
				"puntos": sdrs[i["id"]]["puntos"],
				"reuniones_agendadas": sdrs[i["id"]]["agendadas"],
				"reuniones_realizadas": sdrs[i["id"]]["realizadas"],
				"ultima_actividad": sdrs[i["id"]]["ultima"],
			} for i in integrantes],
		})
	puntajes = [s["puntos"] for s in lista_squads]
	empate = len(puntajes) > 1 and puntajes[0] == puntajes[1]
	diferencia = puntajes[0] - puntajes[1] if len(puntajes) > 1 else 0

	# Evolución por día: siempre todos los días de la Cup; los futuros van en null.
	hoy = ahora[:10]
	dias, acumulado = [], {s: 0 for s in squads}
	for d in dias_cup:
		futuro = d > hoy
		for s in squads:
			acumulado[s] += por_dia[d][s]
		dias.append({
			"fecha": d,
			"puntos": None if futuro else dict(por_dia[d]),
			"acumulado": None if futuro else dict(acumulado),
			"combo": None if futuro else dict(combo_dia[d]),
		})

	# Fase y resultado. El ganador solo existe cuando Alberto cierra la Cup (registro["cierre"]).
	if ahora < cup["inicio"]:
		fase = "por_iniciar"
	elif ahora <= cup["cierre"]:
		fase = "en_curso"
	else:
		fase = "cerrada"
	definitivo = bool((registro.get("cierre") or {}).get("definitivo"))
	ganador = None
	if definitivo and not empate and puntajes[0] >= cup["minimo_para_ganar"]:
		ganador = lista_squads[0]["id"]

	lista_desafios = []
	for d in sorted(registro["desafios"], key=lambda d: (d.get("desde") or d["fecha"], d["id"])):
		ganado = next((
			e for e in eventos
			if e["tipo"] == "flash" and e.get("desafio") == d["id"] and e["id"] not in anulados and e["id"] not in pendientes
		), None)
		# La ventana de todo desafío se recorta al tramo entre el inicio y el cierre de la Cup.
		desde = max(d["desde"], cup["inicio"]) if d.get("desde") else None
		hasta = min(d["hasta"], cup["cierre"]) if d.get("hasta") else None
		# Un Flash sorteado no tiene `hasta`: queda abierto hasta que alguien lo gane o cierre la Cup.
		abierto = not hasta and bool((d.get("origen") or {}).get("sorteo"))
		vigente = bool(desde and (hasta or abierto) and desde <= ahora <= (hasta or cup["cierre"]))
		lista_desafios.append({
			"id": d["id"],
			"tipo": d["tipo"],
			"fecha": d["fecha"],
			"nombre": texto_publico(d["nombre"], empresas, d["id"]) or "Desafío",
			"descripcion": texto_publico(d.get("descripcion"), empresas, d["id"]),
			"puntos_texto": d.get("puntos_texto"),
			# Un Flash que decide Alberto explica en `regla` cómo se gana.
			**({"regla": texto_publico(d["regla"], empresas, d["id"])} if d.get("regla") else {}),
			"desde": con_offset(desde, offset),
			"hasta": con_offset(hasta, offset),
			"vigente": vigente and not ganado,
			"ganador": ganado["squad"] if ganado else None,
		})

	logrados = {e["legendario"]: e["squad"] for e in eventos if e["tipo"] == "legendario" and e["id"] not in anulados}
	legendarios = []
	for clave, datos in LEGENDARIOS.items():
		if clave in logrados:
			estado = "logrado"
		else:
			estado = "no_logrado" if definitivo else "se_define_al_cierre"
		legendarios.append({"id": clave, **datos, "estado": estado, "squad": logrados.get(clave)})

	vistos = registro.get("mensajes_vistos") or []
	chat_hasta = None
	if vistos:
		marca = datetime.strptime(max(vistos).split("-")[0], "%Y%m%dT%H%M%S")
		chat_hasta = con_offset(marca.isoformat(), offset)

	return {
		"version": 1,
		"cup": {
			"numero": cup["numero"],
			"nombre": cup["nombre"],
			"inicio": con_offset(cup["inicio"], offset),
			"cierre": con_offset(cup["cierre"], offset),
			"cierre_final": con_offset(cup.get("cierre_final"), offset),
			"minimo_para_ganar": cup["minimo_para_ganar"],
			"premio": cup.get("premio"),
			"mensaje": cup.get("mensaje"),
			"fase": fase,
			"ganador": ganador,
			"resultado_definitivo": definitivo,
		},
		"actualizado": con_offset(ahora, offset),
		"chat_hasta": chat_hasta,
		"lider": None if empate else lista_squads[0]["id"],
		"diferencia": diferencia,
		"squads": lista_squads,
		"dias": dias,
		"desafios": lista_desafios,
		"legendarios": legendarios,
		"eventos": feed,
	}


def main():
	parser = argparse.ArgumentParser(description="Calcula el estado público de la Cup.")
	parser.add_argument("registro")
	parser.add_argument("--config", required=True)
	parser.add_argument("--salida", required=True)
	parser.add_argument("--ahora", required=True, help="Fecha y hora de Chile de la corrida: 2026-10-13T14:05:00")
	args = parser.parse_args()

	try:
		datetime.strptime(args.ahora, "%Y-%m-%dT%H:%M:%S")
	except ValueError:
		sys.exit("--ahora debe tener el formato 2026-10-13T14:05:00")
	estado = calcular_estado(leer_registro(args.registro), leer_json(args.config), args.ahora)
	guardar_json(args.salida, estado)
	sys.stdout.reconfigure(encoding="utf-8")
	marcador = ", ".join(f"{s['nombre']} {s['puntos']}" for s in estado["squads"])
	print(f"Estado escrito en {args.salida}: {marcador} ({len(estado['eventos'])} eventos, fase {estado['cup']['fase']})")
	if OMITIDOS:
		print("AVISO DE PRIVACIDAD: se omitieron textos que nombraban a una empresa en:", ", ".join(sorted(set(OMITIDOS))))


if __name__ == "__main__":
	main()
