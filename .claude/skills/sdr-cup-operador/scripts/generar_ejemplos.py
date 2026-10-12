"""Genera estados de ejemplo con datos FICTICIOS para maquetar la página y probar el sistema.

Uso (desde la raíz del repo):
	python3 .claude/skills/sdr-cup-operador/scripts/generar_ejemplos.py

Pasa los lotes ficticios por registrar.py y calcular_estado.py, igual que una corrida real,
y deja los resultados en datos/ejemplos/. Las empresas son inventadas.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from calcular_estado import calcular_estado  # noqa: E402
from registrar import REGISTRO_VACIO, registrar  # noqa: E402
from reglas import guardar_json  # noqa: E402

RAIZ = Path(__file__).resolve().parents[4]
SALIDA = RAIZ / "datos" / "ejemplos"


def origen(fecha_hora):
	"""Origen ficticio con el mismo formato de id que produce leer_chat.py."""
	return {"mensaje": fecha_hora.replace("-", "").replace(":", "") + "-0", "autor": None, "hora": fecha_hora[11:]}


def agendada(fecha_hora, sdr, empresa, tmp=None, **extra):
	evento = {"tipo": "reunion_agendada", "fecha_hora": fecha_hora, "sdr": sdr, "empresa": empresa, "origen": origen(fecha_hora), **extra}
	if tmp:
		evento["tmp"] = tmp
	return evento


def mision(fecha_hora, sdr, desafio, puntos, ref=None):
	return {"tipo": "mision", "fecha_hora": fecha_hora, "sdr": sdr, "desafio": desafio, "puntos": puntos, "ref": ref, "origen": origen(fecha_hora)}


LOTE_DIA_1_Y_2 = {
	"alias": {"Apodo Inventado": "matias-palma"},
	"desafios": [
		{
			"id": "mision-2026-10-13", "tipo": "mision", "fecha": "2026-10-13", "nombre": "Primer saque",
			"descripcion": "La primera reunión que agende cada integrante hoy suma un punto adicional.",
			"puntos_texto": "+1 extra por la primera reunión del día",
			"desde": "2026-10-13T09:00:00", "hasta": "2026-10-13T23:59:59", "origen": origen("2026-10-13T09:00:00"),
		},
		{
			"id": "flash-2026-10-13-1", "tipo": "flash", "fecha": "2026-10-13", "nombre": "Sprint de las 15:00",
			"descripcion": "El primer squad que agende dos reuniones entre las 15:00 y las 16:00 se lleva los puntos.",
			"puntos_texto": "+3 al primer squad",
			"desde": "2026-10-13T15:00:00", "hasta": "2026-10-13T16:00:00", "origen": origen("2026-10-13T15:00:00"),
		},
		{
			"id": "mision-2026-10-14", "tipo": "mision", "fecha": "2026-10-14", "nombre": "Liga mayor",
			"descripcion": "Cada reunión agendada hoy con una empresa de más de 1.000 colaboradores suma puntos adicionales.",
			"puntos_texto": "+2 por reunión",
			"desde": "2026-10-14T09:00:00", "hasta": "2026-10-14T23:59:59", "origen": origen("2026-10-14T09:00:00"),
		},
	],
	"eventos": [
		agendada("2026-10-13T10:34:00", "matias-palma", "Empresa Ficticia Uno", tmp="palma1"),
		mision("2026-10-13T10:34:00", "matias-palma", "mision-2026-10-13", 1, "tmp:palma1"),
		agendada("2026-10-13T11:20:00", "isidora-b", "Empresa Ficticia Dos"),
		mision("2026-10-13T11:20:00", "isidora-b", "mision-2026-10-13", 1),
		agendada("2026-10-13T12:05:00", "benjamin-allel", "Empresa Ficticia Tres"),
		mision("2026-10-13T12:05:00", "benjamin-allel", "mision-2026-10-13", 1),
		agendada("2026-10-13T15:20:00", "alberto-m", "Empresa Ficticia Cuatro"),
		mision("2026-10-13T15:20:00", "alberto-m", "mision-2026-10-13", 1),
		agendada("2026-10-13T15:41:00", "pedro-pablo-m", "Empresa Ficticia Cinco"),
		mision("2026-10-13T15:41:00", "pedro-pablo-m", "mision-2026-10-13", 1),
		{"tipo": "flash", "fecha_hora": "2026-10-13T15:41:30", "squad": "squad-2", "desafio": "flash-2026-10-13-1", "puntos": 3, "origen": origen("2026-10-13T15:41:30")},
		agendada("2026-10-13T16:30:00", "matias-rauque", "Empresa Ficticia Seis", tmp="rauque1", en_revision=True, nota="Captura poco legible: fecha de la reunión dudosa."),
		agendada("2026-10-13T17:10:00", "matias-hernandez", "Empresa Ficticia Siete", tmp="hernandez1"),
		{"tipo": "anulacion", "fecha_hora": "2026-10-14T09:15:00", "ref": "tmp:hernandez1", "motivo": "El árbitro dijo que el lead es junior", "detalle_publico": "El lead no calificaba", "origen": origen("2026-10-14T09:15:00")},
		{"tipo": "reunion_realizada", "fecha_hora": "2026-10-14T09:40:00", "ref": "tmp:palma1", "origen": origen("2026-10-14T09:40:00")},
		agendada("2026-10-14T10:15:00", "isidora-b", "Empresa Ficticia Ocho"),
		mision("2026-10-14T10:15:00", "isidora-b", "mision-2026-10-14", 2),
		{"tipo": "ajuste", "fecha_hora": "2026-10-14T11:00:00", "squad": "squad-1", "puntos": 1, "motivo": "Fallo del árbitro por una reunión reagendada", "detalle_publico": "Reunión reagendada a partir de un lead de otro integrante", "origen": origen("2026-10-14T11:00:00")},
		agendada("2026-10-14T12:30:00", "matias-palma", "Empresa Ficticia Nueve"),
	],
	"pendientes": [
		{"id": "p-001", "estado": "abierto", "mensaje": "20261013T163000-0", "motivo": "Fecha de la reunión ilegible en la captura."},
	],
}

LOTE_DIA_3_Y_4 = {
	"eventos": [
		{"tipo": "confirmacion", "fecha_hora": "2026-10-15T09:10:00", "ref": "LA_EN_REVISION", "origen": origen("2026-10-15T09:10:00")},
		agendada("2026-10-15T10:05:00", "matias-hernandez", "Empresa Ficticia Diez", tmp="hernandez2"),
		agendada("2026-10-15T10:50:00", "matias-rauque", "Empresa Ficticia Once"),
		agendada("2026-10-15T11:30:00", "alberto-cintolesi", "Empresa Ficticia Doce"),
		agendada("2026-10-15T16:45:00", "benjamin-allel", "Empresa Ficticia Trece"),
		{"tipo": "reunion_realizada", "fecha_hora": "2026-10-16T10:30:00", "ref": "tmp:hernandez2", "origen": origen("2026-10-16T10:30:00")},
		agendada("2026-10-16T11:15:00", "matias-palma", "Empresa Ficticia Catorce"),
		agendada("2026-10-16T12:40:00", "matias-rauque", "Empresa Ficticia Quince"),
		agendada("2026-10-16T15:55:00", "isidora-b", "Empresa Ficticia Dieciséis"),
	],
}

LOTE_CIERRE = {
	"eventos": [
		{"tipo": "legendario", "fecha_hora": "2026-10-16T18:30:00", "squad": "squad-1", "legendario": "colaboradores", "puntos": 10, "origen": {"correo": "hilo-ficticio"}},
	],
	"cierre": {"definitivo": True, "origen": {"correo": "hilo-ficticio"}},
}

# Variante: se cierra sin legendarios y con un ajuste que deja a los squads igualados.
LOTE_CIERRE_EMPATE = {
	"eventos": [
		{"tipo": "ajuste", "fecha_hora": "2026-10-16T18:30:00", "squad": "squad-2", "puntos": 4, "motivo": "Ajuste ficticio para mostrar un empate", "detalle_publico": "Ajuste ficticio para mostrar un empate", "origen": {"correo": "hilo-ficticio"}},
	],
	"cierre": {"definitivo": True, "origen": {"correo": "hilo-ficticio"}},
}


def aplicar(registro, config, lote, ahora):
	# Los mensajes de origen de cada evento se marcan como vistos, igual que en una corrida real.
	mensajes = [{"id": e["origen"]["mensaje"]} for e in lote.get("eventos", []) if e["origen"].get("mensaje")]
	errores, _ = registrar(registro, config, json.loads(json.dumps(lote)), mensajes, ahora)
	if errores:
		sys.exit("Ejemplo inválido:\n" + "\n".join(errores))


def main():
	config = json.loads((RAIZ / "datos" / "config.json").read_text(encoding="utf-8"))
	config["publicar_empresa"] = "--con-empresas" in sys.argv

	registro = json.loads(json.dumps(REGISTRO_VACIO))
	guardar_json(SALIDA / "estado-por-iniciar.json", calcular_estado(registro, config, "2026-10-12T18:00:00"))

	aplicar(registro, config, LOTE_DIA_1_Y_2, "2026-10-14T15:30:00")
	guardar_json(SALIDA / "estado-en-curso.json", calcular_estado(registro, config, "2026-10-14T15:30:00"))

	# La confirmación apunta a la reunión que quedó en revisión el primer día.
	en_revision = next(e["id"] for e in registro["eventos"] if e.get("en_revision"))
	LOTE_DIA_3_Y_4["eventos"][0]["ref"] = en_revision
	aplicar(registro, config, LOTE_DIA_3_Y_4, "2026-10-16T17:05:00")
	empate = json.loads(json.dumps(registro))

	aplicar(registro, config, LOTE_CIERRE, "2026-10-16T19:00:00")
	guardar_json(SALIDA / "estado-cerrada.json", calcular_estado(registro, config, "2026-10-16T19:00:00"))

	aplicar(empate, config, LOTE_CIERRE_EMPATE, "2026-10-16T19:00:00")
	guardar_json(SALIDA / "estado-cerrada-empate.json", calcular_estado(empate, config, "2026-10-16T19:00:00"))

	sys.stdout.reconfigure(encoding="utf-8")
	for archivo in sorted(SALIDA.glob("estado-*.json")):
		estado = json.loads(archivo.read_text(encoding="utf-8"))
		marcador = " / ".join(f"{s['nombre']} {s['puntos']}" for s in estado["squads"])
		print(f"{archivo.name}: {marcador} · fase {estado['cup']['fase']} · ganador {estado['cup']['ganador']}")


if __name__ == "__main__":
	main()
