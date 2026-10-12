"""Reglas de puntaje y utilidades compartidas por registrar.py y calcular_estado.py.

Idea central: el registro funciona como un libro contable.
- Cada evento guarda sus puntos al momento de registrarse y nunca más cambia.
- El total de un squad es la suma de los puntos de sus eventos.
- Una corrección es siempre un evento nuevo que compensa (anulación con puntos negativos,
  confirmación con los puntos que estaban en espera, ajuste manual).
"""

import json
import os
import re
import unicodedata
from pathlib import Path

PUNTOS_AGENDADA = 1
PUNTOS_REALIZADA = 1   # adicional al punto de la agendada: agendada y realizada = 2
PUNTOS_COMBO = 2

# Tipos que escribe el Operador. "combo_diario" lo agrega solo registrar.py.
TIPOS_OPERADOR = (
	"reunion_agendada", "reunion_realizada", "mision", "flash",
	"legendario", "ajuste", "anulacion", "confirmacion",
)

# A qué casilla del desglose va cada tipo de evento.
CASILLA = {
	"reunion_agendada": "agendadas",
	"reunion_realizada": "realizadas",
	"combo_diario": "combos",
	"mision": "misiones",
	"flash": "flash",
	"legendario": "legendarios",
	"ajuste": "ajustes",
}

LEGENDARIOS = {
	"colaboradores": {"nombre": "+5.000 colaboradores", "puntos": 10},
	"seniority": {"nombre": "Seniority ≥ 1,5", "puntos": 10},
}


REGISTRO_VACIO = {
	"version": 1,
	"alias": {},
	"mensajes_vistos": [],
	"desafios": [],
	"eventos": [],
	"pendientes": [],
	"corridas": [],
	"cierre": None,
}


def leer_json(ruta):
	return json.loads(Path(ruta).read_text(encoding="utf-8"))


def leer_registro(ruta):
	"""Lee el registro; si todavía no existe (primera corrida), parte de uno vacío."""
	vacio = json.loads(json.dumps(REGISTRO_VACIO))
	if not Path(ruta).exists():
		return vacio
	return {**vacio, **leer_json(ruta)}


def guardar_json(ruta, datos):
	"""Escribe a un archivo temporal y lo renombra: nadie ve nunca un JSON a medias."""
	ruta = Path(ruta)
	ruta.parent.mkdir(parents=True, exist_ok=True)
	temporal = ruta.with_name(ruta.name + ".tmp")
	temporal.write_text(json.dumps(datos, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
	os.replace(temporal, ruta)


def situacion(eventos):
	"""Devuelve (anulados, pendientes): ids de eventos anulados y de eventos aún en revisión.

	Se recorre del último al primero porque una anulación solo vale si ella misma no fue
	anulada después.
	"""
	anulados = set()
	for evento in reversed(eventos):
		if evento["tipo"] == "anulacion" and evento["id"] not in anulados:
			anulados.add(evento["ref"])
	confirmados = {e["ref"] for e in eventos if e["tipo"] == "confirmacion" and e["id"] not in anulados}
	pendientes = {
		e["id"] for e in eventos
		if e.get("en_revision") and e["id"] not in confirmados and e["id"] not in anulados
	}
	return anulados, pendientes


def puntos_netos(evento, eventos, anulados):
	"""Lo que hoy aporta un evento: sus puntos más los de su confirmación, si la tuvo."""
	confirmacion = sum(
		c["puntos"] for c in eventos
		if c["tipo"] == "confirmacion" and c.get("ref") == evento["id"] and c["id"] not in anulados
	)
	return evento["puntos"] + confirmacion


def evento_raiz(evento, por_id):
	"""Evento original al que apunta una anulación o una confirmación."""
	while evento["tipo"] in ("anulacion", "confirmacion") and evento.get("ref") in por_id:
		evento = por_id[evento["ref"]]
	return evento


def squad_de_cada_sdr(config):
	return {sdr["id"]: squad["id"] for squad in config["squads"] for sdr in squad["integrantes"]}


def sin_tildes(texto):
	"""Minúsculas, sin tildes ni signos: para comparar nombres escritos de formas distintas."""
	texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
	return " ".join(re.sub(r"[^a-z0-9 ]", " ", texto).split())


# Palabras que sobran al comparar nombres de empresas ("Brolly & Empresa Uno S.A." = "empresa uno").
SOBRAN_EN_EMPRESA = ("brolly", "sa", "spa", "ltda", "limitada", "s", "a", "y", "de", "del", "la", "el", "los", "las")
# Palabras tan comunes que por sí solas no identifican a una empresa.
GENERICAS = (
	"empresa", "empresas", "grupo", "compania", "sociedad", "servicios", "comercial", "industrial",
	"industrias", "inversiones", "distribuidora", "constructora", "inmobiliaria", "transportes",
	"chile", "nacional", "internacional", "global", "asociados", "hermanos", "holding", "banco",
	"clinica", "hospital", "colegio", "universidad", "municipalidad",
)


def normalizar(empresa):
	"""Nombre de empresa reducido a sus palabras propias, para comparar escrituras distintas."""
	return " ".join(palabra for palabra in sin_tildes(empresa).split() if palabra not in SOBRAN_EN_EMPRESA)


def empresa_mencionada(texto, empresas):
	"""Devuelve la primera empresa del registro que aparece dentro de un texto, o None.

	Sirve para que ningún texto público (detalle de un ajuste, descripción de un desafío)
	publique por accidente el nombre de un prospecto. Es deliberadamente estricto: basta
	el nombre completo o una sola palabra distintiva del nombre (4 letras o más y que no sea
	genérica), sin importar mayúsculas, tildes, espacios ni sufijos como "S.A.".
	"""
	palabras_texto = set(sin_tildes(texto).split())
	limpio = f" {normalizar(texto)} "
	for empresa in empresas:
		nombre = normalizar(empresa)
		if not nombre:
			continue
		if len(nombre) >= 3 and f" {nombre} " in limpio:
			return empresa
		distintivas = [p for p in nombre.split() if len(p) >= 4 and p not in GENERICAS]
		if any(palabra in palabras_texto for palabra in distintivas):
			return empresa
	return None
