"""Agrega al registro los eventos que el Operador interpretó en esta corrida.

Uso:
	python3 registrar.py REGISTRO.json --config CONFIG.json --nuevos NUEVOS.json --mensajes MENSAJES.json
		--ahora 2026-10-13T14:05:00 --export "ID_DRIVE|FECHA_MODIFICACION"

- REGISTRO.json  registro persistente y privado (se crea si no existe).
- CONFIG.json    datos fijos de la Cup: fechas, squads e integrantes.
- NUEVOS.json    lo que el Operador dedujo de los mensajes nuevos (formato en SKILL.md).
- MENSAJES.json  salida de leer_chat.py; todos sus mensajes quedan marcados como vistos.

Lo que este script garantiza:
- Los eventos solo se agregan. Nunca se edita ni se borra uno existente.
- Un mismo hecho no entra dos veces (mismo tipo, origen, SDR o squad y referencia). Una
  reunión del mismo SDR a ±2 s de otra ya registrada (misma empresa o referencia) también se
  da por repetida: es el mismo mensaje en un export con la hora corrida.
- Los puntos de cada evento se fijan aquí, según las bases, y no cambian después.
- Los combos diarios se deducen solos, y se revierten solos con un evento compensatorio.
- Si algo no valida, no se escribe nada y se listan todos los errores.
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reglas import (  # noqa: E402
	LEGENDARIOS, PUNTOS_AGENDADA, PUNTOS_COMBO, PUNTOS_REALIZADA, REGISTRO_VACIO, TIPOS_OPERADOR,
	empresa_mencionada, guardar_json, leer_json, leer_registro, normalizar, puntos_netos, situacion,
	squad_de_cada_sdr,
)

FORMATO_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")
# Tope de cordura para puntos escritos a mano (misiones, Flash y ajustes).
MAXIMO_PUNTOS = 20
# Diferencia de hora máxima para reconocer una reunión ya registrada con la hora corrida.
TOLERANCIA_SEGUNDOS = 2


def clave(evento):
	"""Identifica un hecho para no registrarlo dos veces."""
	origen = evento.get("origen") or {}
	return (
		evento.get("tipo"),
		origen.get("mensaje") or origen.get("correo") or origen.get("instruccion"),
		evento.get("sdr") or evento.get("squad"),
		evento.get("ref"),
		evento.get("desafio") or evento.get("legendario"),
		evento.get("puntos") if evento.get("tipo") == "ajuste" else None,
		evento.get("n"),
	)


def repetido_cercano(evento, eventos):
	"""Id de una reunión ya registrada que es el mismo hecho con la hora corrida, o None.

	Mismo tipo y SDR, otro mensaje de origen, a ±2 s, y sin contradecirse en empresa ni en
	referencia (dos capturas de empresas distintas enviadas juntas son dos reuniones).
	"""
	if evento.get("tipo") not in ("reunion_agendada", "reunion_realizada") or not evento.get("sdr"):
		return None
	hora = datetime.fromisoformat(evento["fecha_hora"])
	mensaje = (evento.get("origen") or {}).get("mensaje")
	for previo in eventos:
		if previo["tipo"] != evento["tipo"] or previo.get("sdr") != evento["sdr"]:
			continue
		if (previo.get("origen") or {}).get("mensaje") == mensaje:
			continue
		if abs((hora - datetime.fromisoformat(previo["fecha_hora"])).total_seconds()) > TOLERANCIA_SEGUNDOS:
			continue
		empresas = normalizar(previo.get("empresa")), normalizar(evento.get("empresa"))
		if all(empresas) and empresas[0] != empresas[1]:
			continue
		if previo.get("ref") and evento.get("ref") and previo["ref"] != evento["ref"]:
			continue
		return previo["id"]
	return None


def agregar(registro, evento):
	"""Agrega el evento al final con el siguiente id correlativo."""
	evento = {"id": f"ev-{len(registro['eventos']) + 1:04d}", **evento}
	registro["eventos"].append(evento)
	return evento


def validar(evento, registro, config, squads):
	"""Completa squad y SDR del evento. Devuelve (problemas, descarte).

	`problemas` son errores que el Operador debe corregir. `descarte` es el motivo cuando el
	evento está bien escrito pero las bases dicen que no suma (p. ej. un Flash ya ganado):
	en ese caso no se registra y el resto del lote sigue.
	"""
	problemas = []
	descarte = None
	marcado_por_operador = bool(evento.get("en_revision"))
	tipo = evento["tipo"]
	eventos = registro["eventos"]
	por_id = {e["id"]: e for e in eventos}
	anulados, pendientes = situacion(eventos)
	inicio, cierre = config["cup"]["inicio"], config["cup"]["cierre"]

	origen = evento.get("origen") or {}
	if not (origen.get("mensaje") or origen.get("correo") or origen.get("instruccion")):
		problemas.append("falta el origen (mensaje del chat, correo o instrucción directa de Alberto)")
	if not FORMATO_FECHA.match(evento.get("fecha_hora") or ""):
		return problemas + ["fecha_hora debe tener el formato 2026-10-13T10:34:00 (hora de Chile)"], None

	# Una "realizada", una anulación o una confirmación heredan squad y SDR del evento al que apuntan.
	if tipo in ("reunion_realizada", "anulacion", "confirmacion"):
		referido = por_id.get(evento.get("ref"))
		if not referido:
			return problemas + [f"ref '{evento.get('ref')}' no existe en el registro"], None
		evento["sdr"] = referido.get("sdr")
		evento["squad"] = referido.get("squad")
		if referido["id"] in anulados:
			problemas.append(f"{referido['id']} ya está anulado")
		if tipo == "reunion_realizada":
			if referido["tipo"] != "reunion_agendada":
				problemas.append("ref debe apuntar a una reunion_agendada")
			ya = [e for e in eventos if e["tipo"] == "reunion_realizada" and e.get("ref") == referido["id"] and e["id"] not in anulados]
			if ya:
				descarte = f"la reunión {referido['id']} ya estaba marcada como realizada ({ya[0]['id']})"
		if tipo == "anulacion" and not evento.get("motivo"):
			problemas.append("una anulación necesita motivo")
		if tipo == "anulacion" and referido["tipo"] in ("anulacion", "confirmacion"):
			problemas.append("no se anula una anulación ni una confirmación: usa un ajuste con los puntos que correspondan")
		if tipo == "confirmacion" and referido["id"] not in pendientes:
			problemas.append(f"{referido['id']} no está en revisión: no hay nada que confirmar")

	# Una misión o un Flash pueden apoyarse en una reunión: si la citan, tiene que existir.
	if tipo in ("mision", "flash") and evento.get("ref") is not None:
		reunion = por_id.get(evento["ref"])
		if not reunion or reunion["tipo"] != "reunion_agendada":
			return problemas + [f"ref '{evento['ref']}' debe apuntar a una reunion_agendada del registro"], None
		if reunion["id"] in anulados:
			problemas.append(f"la reunión {reunion['id']} está anulada")

	# Lo que depende de un evento en revisión espera igual que él (no suma hasta que se confirme).
	depende = tipo in ("reunion_realizada", "mision", "flash") and evento.get("ref") in pendientes
	if depende and not evento.get("en_revision"):
		evento["en_revision"] = True
		evento["espera_a"] = evento["ref"]

	sdr = evento.get("sdr")
	if sdr:
		if sdr not in squads:
			return problemas + [f"el SDR '{sdr}' no está en config.json"], None
		if evento.get("squad") not in (None, squads[sdr]):
			problemas.append(f"el SDR '{sdr}' no pertenece a '{evento['squad']}'")
		evento["squad"] = squads[sdr]
	elif evento.get("squad") not in set(squads.values()):
		problemas.append("falta un squad válido")

	# Ventana de la Cup: lo anterior al inicio no cuenta y no se registra; lo posterior al
	# cierre solo entra en revisión, para el conteo final con Alberto.
	if tipo in ("reunion_agendada", "reunion_realizada", "mision", "flash"):
		if evento["fecha_hora"] < inicio:
			descarte = f"es anterior al inicio de la Cup ({inicio.replace('T', ' ')}): no cuenta y no se registra"
		elif evento["fecha_hora"] > cierre and not evento.get("en_revision"):
			problemas.append("es posterior al cierre de la Cup: solo puede entrar con en_revision")

	if tipo == "reunion_agendada":
		if not sdr:
			problemas.append("una reunión agendada necesita SDR")
		if not evento.get("empresa") and not evento.get("en_revision"):
			problemas.append("falta la empresa (o marca en_revision)")
		repetida = next((
			e for e in eventos
			if e["tipo"] == "reunion_agendada" and e["id"] not in anulados
			and normalizar(e.get("empresa")) and normalizar(e.get("empresa")) == normalizar(evento.get("empresa"))
		), None)
		if repetida and not evento.get("en_revision"):
			problemas.append(
				f"la empresa ya está registrada en {repetida['id']}: un reagendamiento no se registra; "
				"si la subió otro SDR, márcala en_revision y escala"
			)

	if tipo in ("mision", "flash"):
		desafio = next((d for d in registro["desafios"] if d["id"] == evento.get("desafio")), None)
		if not desafio:
			problemas.append(f"el desafío '{evento.get('desafio')}' no está registrado")
		elif desafio["tipo"] != tipo:
			problemas.append(f"'{desafio['id']}' es de tipo {desafio['tipo']}, no {tipo}")
		elif tipo == "flash" and desafio.get("modo") == "mejor_del_dia":
			# Lo decide Alberto (correo o instrucción directa) entre los candidatos, al terminar el día.
			ganado = [e for e in eventos if e["tipo"] == "flash" and e.get("desafio") == desafio["id"] and e["id"] not in anulados]
			if not (origen.get("correo") or origen.get("instruccion")):
				problemas.append(f"'{desafio['id']}' lo decide Alberto: un reclamo del chat va en 'candidatos', no como evento")
			elif evento.get("puntos") != desafio.get("puntos"):
				problemas.append(f"el Flash '{desafio['id']}' vale {desafio.get('puntos')} puntos")
			elif not evento.get("ref"):
				problemas.append("el ganador va con 'ref' a la reunión del candidato elegido")
			elif not any(
				c["desafio"] == desafio["id"] and c["ref"] == evento["ref"] and c["sdr"] == evento.get("sdr")
				for c in registro.get("candidatos") or []
			):
				problemas.append("el ganador debe ser un candidato registrado de este Flash: su 'sdr' y 'ref' a su reunión")
			elif not desafio["desde"] <= evento["fecha_hora"] <= desafio["hasta"]:
				problemas.append("usa la fecha_hora del candidato elegido, que está dentro de la ventana")
			elif ganado:
				descarte = f"el Flash ya tiene ganador ({ganado[0]['id']}): no se reemplaza"
		elif tipo == "flash" and not marcado_por_operador:
			del_desafio = [e for e in eventos if e["tipo"] == "flash" and e.get("desafio") == desafio["id"] and e["id"] not in anulados]
			ganado = [e for e in del_desafio if e["id"] not in pendientes]
			# Un Flash sorteado no tiene hora de término: vale hasta el cierre de la Cup.
			sorteado = bool((desafio.get("origen") or {}).get("sorteo"))
			fin = desafio.get("hasta") or (cierre if sorteado else None)
			if not (desafio.get("desde") and fin):
				problemas.append(f"el Flash '{desafio['id']}' no tiene ventana (desde/hasta)")
			elif sorteado and evento.get("puntos") != desafio.get("puntos"):
				problemas.append(f"el Flash '{desafio['id']}' vale {desafio.get('puntos')} puntos")
			elif not desafio["desde"] <= evento["fecha_hora"] <= fin:
				descarte = "está fuera de la ventana del Flash: no suma el Flash (la reunión sí)"
			elif ganado:
				descarte = f"el Flash ya lo ganó {ganado[0]['squad']} ({ganado[0]['id']}): el segundo no suma"
			elif del_desafio and not evento.get("en_revision"):
				# Alguien lo reclamó antes con un caso que sigue en revisión: nadie gana todavía.
				evento["en_revision"] = True
				evento["espera_flash"] = True
				evento["nota"] = f"Depende de un caso anterior en revisión ({del_desafio[0]['id']})"

	if tipo == "legendario" and evento.get("legendario") not in LEGENDARIOS:
		problemas.append(f"'legendario' debe ser uno de {list(LEGENDARIOS)}")
	if tipo in ("mision", "flash", "legendario", "ajuste"):
		puntos = evento.get("puntos")
		if not isinstance(puntos, int) or isinstance(puntos, bool):
			problemas.append("'puntos' debe ser un número entero")
		elif tipo == "legendario" and evento.get("legendario") in LEGENDARIOS and puntos != LEGENDARIOS[evento["legendario"]]["puntos"]:
			problemas.append(f"ese legendario vale {LEGENDARIOS[evento['legendario']]['puntos']} puntos")
		elif tipo != "legendario" and abs(puntos) > MAXIMO_PUNTOS:
			problemas.append(f"{puntos} puntos supera el tope de {MAXIMO_PUNTOS}: revisa el número")
		elif tipo in ("mision", "flash") and puntos < 0:
			problemas.append("una misión o un Flash no restan puntos")
	if tipo == "ajuste" and not evento.get("motivo"):
		problemas.append("un ajuste necesita motivo")
	return problemas, descarte


def fijar_puntos(evento, registro):
	"""Deja en el evento los puntos que aporta. Lo que entra en revisión aporta 0 por ahora."""
	tipo = evento["tipo"]
	eventos = registro["eventos"]
	anulados, pendientes = situacion(eventos)
	por_id = {e["id"]: e for e in eventos}
	if tipo == "anulacion":
		referido = por_id[evento["ref"]]
		evento["puntos"] = 0 if referido["id"] in pendientes else -puntos_netos(referido, eventos, anulados)
		return
	if tipo == "confirmacion":
		evento["puntos"] = por_id[evento["ref"]].get("puntos_en_revision", 0)
		return
	valor = {"reunion_agendada": PUNTOS_AGENDADA, "reunion_realizada": PUNTOS_REALIZADA}.get(tipo, evento.get("puntos"))
	if evento.get("en_revision"):
		evento["puntos"], evento["puntos_en_revision"] = 0, valor
	else:
		evento["puntos"] = valor


def anular_dependientes(registro, anulacion):
	"""Si se anula una reunión, también caen su 'realizada' y los desafíos que se apoyaban en ella."""
	anulados, pendientes = situacion(registro["eventos"])
	for evento in list(registro["eventos"]):
		depende = evento.get("ref") == anulacion["ref"] and evento["tipo"] in ("reunion_realizada", "mision", "flash")
		if depende and evento["id"] not in anulados:
			agregar(registro, {
				"tipo": "anulacion",
				"fecha_hora": anulacion["fecha_hora"],
				"ref": evento["id"],
				"sdr": evento.get("sdr"),
				"squad": evento.get("squad"),
				"puntos": 0 if evento["id"] in pendientes else -puntos_netos(evento, registro["eventos"], anulados),
				"motivo": "Se anuló la reunión de la que dependía",
				"origen": anulacion.get("origen"),
				"auto": True,
			})


def confirmar_dependientes(registro, confirmacion):
	"""Al confirmar un evento, también se confirma lo que quedó esperando solo por él."""
	eventos = registro["eventos"]
	anulados, pendientes = situacion(eventos)
	for evento in list(eventos):
		if evento.get("espera_a") != confirmacion["ref"] or evento["id"] not in pendientes:
			continue
		if evento["tipo"] == "flash":
			# Si mientras tanto otro squad ganó el Flash, este no se confirma solo.
			ganado = any(
				e["tipo"] == "flash" and e.get("desafio") == evento.get("desafio")
				and e["id"] not in anulados and e["id"] not in pendientes
				for e in eventos
			)
			if ganado:
				continue
		agregar(registro, {
			"tipo": "confirmacion",
			"fecha_hora": confirmacion["fecha_hora"],
			"ref": evento["id"],
			"sdr": evento.get("sdr"),
			"squad": evento.get("squad"),
			"puntos": evento.get("puntos_en_revision", 0),
			"origen": confirmacion.get("origen"),
			"auto": True,
		})


def resolver_flash(registro, disparador):
	"""Decide los Flash que quedaron esperando por un reclamo anterior en revisión.

	Si el reclamo anterior se confirma, el que esperaba se anula (el Flash ya tiene ganador).
	Si el anterior se cae, el que esperaba pasa a ganar.
	"""
	eventos = registro["eventos"]
	for espera in [e for e in eventos if e.get("espera_flash")]:
		anulados, pendientes = situacion(eventos)
		if espera["id"] not in pendientes:
			continue
		otros = [
			e for e in eventos
			if e["tipo"] == "flash" and e.get("desafio") == espera.get("desafio")
			and e["id"] != espera["id"] and e["id"] not in anulados
		]
		hay_ganador = any(e["id"] not in pendientes for e in otros)
		hay_anterior = any(e["id"] in pendientes and eventos.index(e) < eventos.index(espera) for e in otros)
		if not hay_ganador and hay_anterior:
			continue
		agregar(registro, {
			"tipo": "anulacion" if hay_ganador else "confirmacion",
			"fecha_hora": disparador["fecha_hora"],
			"ref": espera["id"],
			"sdr": espera.get("sdr"),
			"squad": espera.get("squad"),
			"puntos": 0 if hay_ganador else espera.get("puntos_en_revision", 0),
			"motivo": "El Flash lo ganó otro squad" if hay_ganador else "Se cayó el reclamo anterior del Flash",
			"origen": disparador.get("origen"),
			"auto": True,
		})


def ajustar_combos(registro, disparador):
	"""Otorga o revierte el combo diario según las reuniones válidas de cada squad y día.

	Combo: 2 o más integrantes del squad con al menos una reunión agendada válida el mismo día
	(día del mensaje con la captura). Se otorga una vez por día. Si una corrección deja a un
	solo integrante con reunión válida, se revierte con una anulación automática.
	"""
	eventos = registro["eventos"]
	anulados, pendientes = situacion(eventos)
	agendaron = {}
	for evento in eventos:
		if evento["tipo"] == "reunion_agendada" and evento["id"] not in anulados and evento["id"] not in pendientes:
			agendaron.setdefault((evento["fecha_hora"][:10], evento["squad"]), set()).add(evento["sdr"])
	combos = {(e["dia"], e["squad"]): e for e in eventos if e["tipo"] == "combo_diario" and e["id"] not in anulados}

	for (dia, squad), quienes in sorted(agendaron.items()):
		if len(quienes) >= 2 and (dia, squad) not in combos:
			agregar(registro, {
				"tipo": "combo_diario",
				"fecha_hora": disparador["fecha_hora"],
				"dia": dia,
				"squad": squad,
				"sdr": None,
				"puntos": PUNTOS_COMBO,
				"origen": disparador.get("origen"),
				"auto": True,
			})
	for (dia, squad), combo in sorted(combos.items()):
		if len(agendaron.get((dia, squad), ())) < 2:
			agregar(registro, {
				"tipo": "anulacion",
				"fecha_hora": disparador["fecha_hora"],
				"ref": combo["id"],
				"sdr": None,
				"squad": squad,
				"puntos": -combo["puntos"],
				"motivo": "Quedó un solo integrante con reunión válida ese día",
				"origen": disparador.get("origen"),
				"auto": True,
			})


def registrar(registro, config, nuevos, mensajes, ahora=None, export=None, desplazados=()):
	"""Devuelve (errores, resumen). Si no hay errores, `registro` queda actualizado.

	`desplazados` son mensajes ya vistos que volvieron con la hora corrida (salida de
	leer_chat.py): su id nuevo también queda como visto.
	"""
	errores = []
	squads = squad_de_cada_sdr(config)
	# Se trabaja sobre una copia: si algo falla, el registro original queda intacto.
	trabajo = json.loads(json.dumps({**REGISTRO_VACIO, **registro}))
	antes = len(trabajo["eventos"])

	# 1. Apodos nuevos (privados: solo viven en el registro).
	for apodo, sdr in (nuevos.get("alias") or {}).items():
		if sdr is not None and sdr not in squads:
			errores.append(f"alias '{apodo}': el SDR '{sdr}' no está en config.json")
		trabajo["alias"][apodo] = sdr

	# El cierre definitivo solo lo da Alberto por correo o instrucción directa, nunca el chat.
	if nuevos.get("cierre"):
		origen_cierre = nuevos["cierre"].get("origen") or {}
		if not (origen_cierre.get("correo") or origen_cierre.get("instruccion")):
			errores.append("cierre: solo vale con origen 'correo' o 'instruccion' de Alberto; un mensaje del grupo no cierra la Cup")

	# 2. Desafíos anunciados (misiones y Flash), en el chat o por instrucción directa de Alberto.
	#    Solo se agregan, nunca se reemplazan: un día tiene una sola misión y la segunda no entra.
	conocidos = {d["id"]: d for d in trabajo["desafios"]}
	desafios_nuevos = []
	desafios_omitidos = []
	for desafio in nuevos.get("desafios") or []:
		origen = desafio.get("origen") or {}
		completo = desafio.get("id") and desafio.get("nombre") and desafio.get("fecha") and (origen.get("mensaje") or origen.get("instruccion"))
		if desafio.get("tipo") not in ("mision", "flash"):
			errores.append(f"desafío '{desafio.get('id')}': tipo debe ser mision o flash")
		elif not completo:
			errores.append(f"desafío '{desafio.get('id')}': faltan id, nombre, fecha u origen (mensaje del chat o instrucción directa de Alberto)")
		elif desafio["tipo"] == "flash" and not (desafio.get("desde") and desafio.get("hasta")):
			errores.append(f"desafío '{desafio['id']}': un Flash necesita ventana (desde/hasta); si el anuncio no la trae, no la inventes: quítalo y escala")
		elif desafio["id"] in conocidos:
			if (conocidos[desafio["id"]].get("origen") or {}) != origen:
				desafios_omitidos.append({"id": desafio["id"], "motivo": "ya existe un desafío con ese id y no se reemplaza"})
		else:
			mision_del_dia = next((
				d for d in trabajo["desafios"]
				if desafio["tipo"] == "mision" and d["tipo"] == "mision" and d["fecha"] == desafio["fecha"]
			), None)
			if mision_del_dia:
				desafios_omitidos.append({
					"id": desafio["id"],
					"motivo": f"el {desafio['fecha']} ya tiene misión ({mision_del_dia['id']}): la segunda no entra",
				})
			else:
				conocidos[desafio["id"]] = desafio
				desafios_nuevos.append(desafio["id"])
				trabajo["desafios"].append(desafio)

	# Privacidad: ningún texto público puede nombrar a una empresa (salvo que config lo permita).
	if not config.get("publicar_empresa"):
		lote_crudo = nuevos.get("eventos") or []
		empresas = [e.get("empresa") for e in trabajo["eventos"] + lote_crudo if e.get("empresa")]
		publicos = [
			(f"evento {i} ({e.get('tipo')}), detalle_publico", e.get("detalle_publico"))
			for i, e in enumerate(lote_crudo, start=1)
		]
		for desafio in nuevos.get("desafios") or []:
			for campo in ("nombre", "descripcion", "puntos_texto"):
				publicos.append((f"desafío '{desafio.get('id')}', {campo}", desafio.get(campo)))
		for donde, texto in publicos:
			if empresa_mencionada(texto, empresas):
				errores.append(f"{donde}: nombra a una empresa del registro; reescríbelo sin el nombre (ese texto es público)")

	# 3. Eventos, en orden cronológico. Uno nuevo puede referirse a otro del mismo lote
	#    con "tmp": "etiqueta" en el primero y "ref": "tmp:etiqueta" en el segundo.
	claves = {clave(e): e["id"] for e in trabajo["eventos"]}
	temporales = {}
	repetidos = 0
	descartados = []
	etiquetas_descartadas = set()
	ajustes_del_lote = {}
	lote = [dict(e) for e in nuevos.get("eventos") or []]
	for posicion, evento in enumerate(lote, start=1):
		evento["_donde"] = f"evento {posicion} ({evento.get('tipo')})"
	for evento in sorted(lote, key=lambda e: str(e.get("fecha_hora"))):
		donde = evento.pop("_donde")
		etiqueta = evento.pop("tmp", None)
		if evento.get("tipo") not in TIPOS_OPERADOR:
			errores.append(f"{donde}: tipo desconocido")
			continue
		ref = evento.get("ref")
		if isinstance(ref, str) and ref.startswith("tmp:"):
			if ref[4:] in etiquetas_descartadas:
				descartados.append(f"{donde}: depende de un evento descartado")
				continue
			if ref[4:] not in temporales:
				errores.append(f"{donde}: la etiqueta '{ref}' no existe o su evento fue rechazado")
				continue
			evento["ref"] = temporales[ref[4:]]
		problemas, descarte = validar(evento, trabajo, config, squads)
		if evento["tipo"] == "ajuste":
			# Dos ajustes iguales nacidos del mismo mensaje son dos hechos: se numeran.
			base = clave(evento)
			ajustes_del_lote[base] = ajustes_del_lote.get(base, 0) + 1
			if ajustes_del_lote[base] > 1:
				evento["n"] = ajustes_del_lote[base]
		ya_registrado = claves.get(clave(evento))
		if not ya_registrado and FORMATO_FECHA.match(evento.get("fecha_hora") or ""):
			ya_registrado = repetido_cercano(evento, trabajo["eventos"])
		if ya_registrado:
			# Ya estaba registrado en una corrida anterior: no es un error, solo se ignora.
			repetidos += 1
			if etiqueta:
				temporales[etiqueta] = ya_registrado
			continue
		if problemas:
			errores.extend(f"{donde}: {problema}" for problema in problemas)
			continue
		if descarte:
			descartados.append(f"{donde}: {descarte}")
			if etiqueta:
				etiquetas_descartadas.add(etiqueta)
			continue
		fijar_puntos(evento, trabajo)
		evento = agregar(trabajo, evento)
		claves[clave(evento)] = evento["id"]
		if etiqueta:
			temporales[etiqueta] = evento["id"]
		if evento["tipo"] == "anulacion":
			anular_dependientes(trabajo, evento)
		if evento["tipo"] == "confirmacion":
			confirmar_dependientes(trabajo, evento)
		resolver_flash(trabajo, evento)
		ajustar_combos(trabajo, evento)

	# Candidatos de un Flash "mejor del día": privados y sin puntos; Alberto elige al terminar el día.
	trabajo.setdefault("candidatos", [])
	candidatos_nuevos = 0
	for posicion, candidato in enumerate(nuevos.get("candidatos") or [], start=1):
		donde = f"candidato {posicion}"
		desafio = next((d for d in trabajo["desafios"] if d["id"] == candidato.get("desafio")), None)
		ref = candidato.get("ref")
		if isinstance(ref, str) and ref.startswith("tmp:"):
			if ref[4:] in etiquetas_descartadas:
				descartados.append(f"{donde}: su reunión fue descartada")
				continue
			ref = temporales.get(ref[4:])
		reunion = next((e for e in trabajo["eventos"] if e["id"] == ref and e["tipo"] == "reunion_agendada"), None)
		if not desafio or desafio.get("modo") != "mejor_del_dia":
			errores.append(f"{donde}: '{candidato.get('desafio')}' no es un Flash que decide Alberto")
		elif candidato.get("sdr") not in squads:
			errores.append(f"{donde}: el SDR '{candidato.get('sdr')}' no está en config.json")
		elif not reunion:
			errores.append(f"{donde}: 'ref' debe apuntar a la reunión agendada del candidato")
		elif not (candidato.get("fecha_hora") and (candidato.get("origen") or {}).get("mensaje")):
			errores.append(f"{donde}: faltan fecha_hora u origen (mensaje del chat)")
		elif not desafio["desde"] <= candidato["fecha_hora"] <= desafio["hasta"]:
			descartados.append(f"{donde}: está fuera de la ventana de '{desafio['id']}': no es candidato")
		elif not any(c["desafio"] == desafio["id"] and c["ref"] == reunion["id"] for c in trabajo["candidatos"]):
			trabajo["candidatos"].append({
				**candidato, "ref": reunion["id"], "squad": squads[candidato["sdr"]],
				"empresa": candidato.get("empresa") or reunion.get("empresa"),
			})
			candidatos_nuevos += 1

	if errores:
		return errores, None

	# 4. Pendientes, cierre, mensajes vistos e historial de corridas.
	for pendiente in nuevos.get("pendientes") or []:
		existente = next((p for p in trabajo["pendientes"] if p["id"] == pendiente["id"]), None)
		if existente:
			existente.update(pendiente)
		else:
			trabajo["pendientes"].append(pendiente)
	# Observaciones privadas para el cierre con Alberto (p. ej. una misión que nadie declaró).
	ya_anotadas = {(o.get("mensaje"), o.get("nota")) for o in trabajo["observaciones"]}
	for observacion in nuevos.get("observaciones") or []:
		if (observacion.get("mensaje"), observacion.get("nota")) not in ya_anotadas:
			trabajo["observaciones"].append(observacion)
	if nuevos.get("cierre"):
		# Cierre de la Cup: solo cuando Alberto confirma el resultado final.
		trabajo["cierre"] = nuevos["cierre"]
	vistos = set(trabajo["mensajes_vistos"])
	ids_nuevos = [m["id"] for m in mensajes if m["id"] not in vistos]
	trabajo["mensajes_vistos"].extend(ids_nuevos)
	ids_desplazados = [d["id"] for d in desplazados if d["id"] not in vistos and d["id"] not in ids_nuevos]
	trabajo["mensajes_vistos"].extend(ids_desplazados)
	huellas = trabajo.setdefault("huellas", {})
	for mensaje in list(mensajes) + list(desplazados):
		if mensaje.get("huella"):
			huellas[mensaje["id"]] = mensaje["huella"]
	agregados = trabajo["eventos"][antes:]
	resumen = {
		"fecha_hora": ahora,
		"export": export,
		"mensajes_nuevos": len(ids_nuevos),
		"mensajes_desplazados": len(ids_desplazados),
		"eventos_nuevos": [e["id"] for e in agregados],
		"eventos_automaticos": [e["id"] for e in agregados if e.get("auto")],
		"eventos_repetidos": repetidos,
		"eventos_descartados": descartados,
		"desafios_nuevos": desafios_nuevos,
		"desafios_omitidos": desafios_omitidos,
		"candidatos_nuevos": candidatos_nuevos,
	}
	trabajo["corridas"].append(resumen)
	registro.clear()
	registro.update(trabajo)
	return [], resumen


def main():
	parser = argparse.ArgumentParser(description="Agrega eventos nuevos al registro de la Cup.")
	parser.add_argument("registro")
	parser.add_argument("--config", required=True)
	parser.add_argument("--nuevos", required=True)
	parser.add_argument("--mensajes", required=True)
	parser.add_argument("--ahora", help="Fecha y hora de Chile de la corrida, ISO")
	parser.add_argument("--export", help="Identificador del export procesado: id de Drive + fecha de modificación")
	args = parser.parse_args()

	registro = leer_registro(args.registro)
	lectura = leer_json(args.mensajes)
	errores, resumen = registrar(
		registro, leer_json(args.config), leer_json(args.nuevos), lectura["mensajes"],
		args.ahora, args.export, lectura.get("desplazados") or [],
	)
	sys.stdout.reconfigure(encoding="utf-8")
	if errores:
		print("NO SE REGISTRÓ NADA. Corrige NUEVOS.json y vuelve a correr:")
		for error in errores:
			print(" -", error)
		sys.exit(1)
	guardar_json(args.registro, registro)
	print(json.dumps(resumen, ensure_ascii=False, indent="\t"))


if __name__ == "__main__":
	main()
