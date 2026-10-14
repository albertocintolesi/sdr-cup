"""Sortea los Flash Challenge automáticos de la Cup.

Uso:
	python3 -I sortear_flash.py <registro.json> --flash <flash.json> --config datos/config.json --ahora <AHORA>

`flash.json` es privado (vive junto a registro.json) y lo define Alberto:
	{"dias": ["AAAA-MM-DD", ...], "turnos": [10, 11, ...], "por_dia": 2,
	 "flash": [{"id", "nombre", "descripcion", "puntos", "puntos_texto"}, ...]}

El turno H va de H:07 a H+1:06:59 (el último se recorta al cierre de la Cup). Cada turno se
sortea una sola vez, en la primera corrida que cae dentro de él, y queda anotado en el
registro. La probabilidad de que caiga un Flash es (Flash que le quedan al día) / (turnos
que le quedan al día, contando el actual): así caen exactamente `por_dia` por día, a una
hora uniforme. Lo que no alcanzó a caer pasa al día siguiente; si quedan menos turnos que
Flash, caen varios en el mismo turno.

El Flash que cae se agrega a registro.json como desafío `flash` abierto: `desde` es ahora y no
tiene `hasta` (dura hasta que un squad lo gane o cierre la Cup).

Secreto: la salida dice solo si cayó un Flash y cuál. Nunca muestra los que no han caído ni
cuántos quedan.
"""

import argparse
import json
import math
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reglas import guardar_json, leer_json, leer_registro  # noqa: E402

MINUTO_DE_INICIO = 7


def turnos_del_dia(fecha, horas, cierre):
	"""Turnos (hora, inicio, fin) de un día; `fin` es exclusivo y no pasa del cierre de la Cup."""
	turnos = []
	for hora in sorted(horas):
		inicio = datetime.fromisoformat(f"{fecha}T{hora:02d}:{MINUTO_DE_INICIO:02d}:00")
		fin = min(inicio + timedelta(hours=1), cierre)
		if inicio < fin:
			turnos.append((hora, inicio, fin))
	return turnos


def completo(programa):
	flash = programa.get("flash") or []
	bien_escritos = all(
		f.get("id") and f.get("nombre") and isinstance(f.get("puntos"), int) and not isinstance(f.get("puntos"), bool)
		for f in flash
	)
	sin_plantilla = "<<" not in json.dumps(programa, ensure_ascii=False)
	return bool(flash and programa.get("dias") and programa.get("turnos")) and bien_escritos and sin_plantilla


def sortear(registro, programa, cup, ahora, azar=None):
	"""Devuelve el resultado de la corrida y deja `registro` actualizado. `azar` es solo para pruebas."""
	azar = azar or secrets.SystemRandom()
	resultado = {"turno": None, "nuevo": False, "cayeron": []}
	if registro.get("cierre"):
		return resultado
	if not completo(programa):
		resultado["aviso"] = "flash.json no existe o está incompleto: no se sortea"
		return resultado

	sorteo = registro.setdefault("sorteo", {"turnos": [], "cerrado": False})
	dias = sorted(programa["dias"])
	horas = programa["turnos"]
	por_dia = programa.get("por_dia", 2)
	momento = datetime.fromisoformat(ahora)
	cierre = datetime.fromisoformat(cup["cierre"])
	caidos = {d["flash"] for d in registro["desafios"] if (d.get("origen") or {}).get("sorteo")}
	pendientes = [f for f in programa["flash"] if f["id"] not in caidos]

	fecha = momento.date().isoformat()
	turnos = turnos_del_dia(fecha, horas, cierre) if fecha in dias else []
	turno = next((t for t in turnos if t[1] <= momento < t[2]), None)
	if turno is None:
		# Pasado el último turno del último día se informa, una sola vez, lo que no alcanzó a caer.
		ultimos = turnos_del_dia(dias[-1], horas, cierre)
		fin = ultimos[-1][2] if ultimos else cierre
		if momento >= fin and not sorteo.get("cerrado"):
			sorteo["cerrado"] = True
			resultado.update(nuevo=True, sobrante=len(pendientes))
		return resultado

	hora, inicio, _ = turno
	clave = f"{fecha}T{hora:02d}"
	resultado["turno"] = clave
	if any(t["turno"] == clave for t in sorteo["turnos"]):
		return resultado

	restantes = sum(1 for t in turnos if t[1] >= inicio)
	por_caer = max(0, min(len(pendientes), por_dia * (dias.index(fecha) + 1) - len(caidos)))
	if por_caer > restantes:
		cantidad = math.ceil(por_caer / restantes)
	else:
		cantidad = 1 if azar.randrange(restantes) < por_caer else 0

	ya_del_dia = sum(1 for d in registro["desafios"] if d["id"].startswith(f"flash-{fecha}-s"))
	nuevos = []
	for n, flash in enumerate(azar.sample(pendientes, cantidad), start=ya_del_dia + 1):
		desafio = {
			"id": f"flash-{fecha}-s{n}", "tipo": "flash", "fecha": fecha,
			"nombre": flash["nombre"], "descripcion": flash.get("descripcion"), "puntos_texto": flash.get("puntos_texto"),
			"puntos": flash["puntos"], "desde": ahora, "hasta": None,
			"origen": {"sorteo": clave}, "flash": flash["id"],
		}
		registro["desafios"].append(desafio)
		nuevos.append(desafio)
	sorteo["turnos"].append({"turno": clave, "corrida": ahora, "cayeron": [d["id"] for d in nuevos]})
	resultado.update(nuevo=True, cayeron=[{"id": d["id"], "nombre": d["nombre"], "puntos": d["puntos"]} for d in nuevos])
	return resultado


def main():
	parser = argparse.ArgumentParser(description="Sortea los Flash Challenge automáticos del turno actual.")
	parser.add_argument("registro")
	parser.add_argument("--flash", required=True, help="Archivo privado con los Flash de Alberto")
	parser.add_argument("--config", required=True)
	parser.add_argument("--ahora", required=True, help="Fecha y hora de Chile de la corrida, ISO")
	args = parser.parse_args()

	registro = leer_registro(args.registro)
	programa = leer_json(args.flash) if Path(args.flash).exists() else {}
	resultado = sortear(registro, programa, leer_json(args.config)["cup"], args.ahora)
	if resultado["nuevo"]:
		guardar_json(args.registro, registro)
	sys.stdout.reconfigure(encoding="utf-8")
	print(json.dumps(resultado, ensure_ascii=False))


if __name__ == "__main__":
	main()
