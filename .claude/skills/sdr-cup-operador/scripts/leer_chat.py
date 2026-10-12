"""Lee el `_chat.txt` de un export de WhatsApp (iPhone, es-CL) y lo deja como lista de mensajes.

Uso:
	python3 leer_chat.py CARPETA_EXPORT [--vistos REGISTRO.json] [--apodos APODOS.json] [--contexto 30] [--salida MENSAJES.json]

Cada mensaje queda así:
	{
		"id": "20261013T100500-0",      # fecha-hora + orden dentro del mismo segundo
		"fecha": "2026-10-13",
		"hora": "10:05:00",
		"autor": "apodo tal como sale en el chat",
		"texto": "texto sin caracteres invisibles",
		"adjuntos": ["00000011-PHOTO-2026-10-13-10-05-00.jpg"],
		"sistema": false,
		"editado": false,
		"sdr": "matias-palma"           # solo con --apodos: id del SDR, null si no juega
	}

Con --apodos cada mensaje trae además "autor_conocido" (false si el apodo no está en el mapa)
y el resultado lista los "autores_desconocidos".

El id no depende del apodo ni del texto, así que se puede publicar sin exponer nada privado
y es estable entre exports (cada export trae el historial completo).
"""

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reglas import sin_tildes  # noqa: E402

# Caracteres invisibles que WhatsApp mete en cabeceras, autores, menciones y adjuntos
# (marcas de dirección de texto y BOM). Se escriben por código para que se vean en el editor.
INVISIBLES = dict.fromkeys([0x200E, 0x200F, 0x202A, 0x202C, 0x2068, 0x2069, 0xFEFF])
# Espacios especiales que van dentro de la hora ("9:01:30 p. m."): se pasan a espacio normal.
ESPACIOS = {0x202F: " ", 0x00A0: " "}
LIMPIEZA = {**INVISIBLES, **ESPACIOS}

CRLF = chr(13) + chr(10)
LF = chr(10)

# [13-10-26, 9:01:30 p. m.] Autor: texto   (o en 24 horas: [13-10-26, 21:01:30] Autor: texto)
CABECERA = re.compile(
	r"^\[(\d{2})-(\d{2})-(\d{2}), (\d{1,2}):(\d{2}):(\d{2})(?:\s*([ap])\.\s*m\.)?\] ([^:]+?): ?(.*)$",
	re.DOTALL,
)
# Los avisos automáticos de WhatsApp ("Creaste el grupo", "Añadiste a...") traen una marca
# invisible (U+200E) justo al inicio del texto y nunca llevan adjunto.
AVISO_SISTEMA = re.compile(r"^[^\[]?\[[^\]]+\] [^:]+: " + chr(0x200E))
ADJUNTO = re.compile(r"<adjunto: ([^>]+)>")
EDITADO = "<Se editó este mensaje.>"


def limpiar(texto):
	"""Quita los caracteres invisibles y normaliza los espacios especiales."""
	return texto.translate(LIMPIEZA)


def normalizar_espacios(texto):
	"""Solo pasa los espacios especiales a espacio normal (conserva las marcas invisibles)."""
	return texto.translate(ESPACIOS)


def separar_mensajes(contenido):
	"""Parte el archivo en mensajes.

	En el export de iPhone cada mensaje termina en CRLF y los saltos internos de un mensaje
	multilínea son LF. Esa es la señal confiable: una línea interna que parezca cabecera
	(por ejemplo, un chat pegado dentro de un mensaje) no se confunde con un mensaje nuevo.
	Si el archivo no trae CRLF, se separa por líneas que empiezan con una cabecera.
	"""
	if CRLF in contenido:
		return [trozo for trozo in contenido.split(CRLF) if trozo.strip()]
	trozos = []
	for linea in contenido.split(LF):
		if CABECERA.match(limpiar(linea)) or not trozos:
			trozos.append(linea)
		else:
			trozos[-1] += LF + linea
	return [trozo for trozo in trozos if trozo.strip()]


def leer_chat(ruta_chat):
	"""Devuelve la lista de mensajes del archivo, en el orden del chat."""
	mensajes = []
	usados = {}
	contenido = Path(ruta_chat).read_bytes().decode("utf-8")
	for trozo in separar_mensajes(contenido):
		aviso = bool(AVISO_SISTEMA.match(normalizar_espacios(trozo)))
		trozo = limpiar(trozo)
		cabecera = CABECERA.match(trozo)
		if not cabecera:
			# No debería pasar; se conserva pegado al mensaje anterior para no perder texto.
			if mensajes:
				mensajes[-1]["texto"] += LF + trozo
			continue
		dia, mes, anio, hora, minuto, segundo, ampm, autor, texto = cabecera.groups()
		hora = int(hora)
		if ampm:
			hora = hora % 12 + (12 if ampm == "p" else 0)
		marca = f"20{anio}{mes}{dia}T{hora:02d}{minuto}{segundo}"
		orden = usados.get(marca, 0)
		usados[marca] = orden + 1
		mensajes.append({
			"id": f"{marca}-{orden}",
			"fecha": f"20{anio}-{mes}-{dia}",
			"hora": f"{hora:02d}:{minuto}:{segundo}",
			"autor": autor.strip(),
			"texto": texto,
			"sistema": aviso,
		})
	for mensaje in mensajes:
		texto = mensaje["texto"]
		mensaje["adjuntos"] = [nombre.strip() for nombre in ADJUNTO.findall(texto)]
		mensaje["editado"] = EDITADO in texto
		texto = ADJUNTO.sub("", texto).replace(EDITADO, "").strip()
		mensaje["texto"] = texto
		mensaje["sistema"] = mensaje["autor"] == "Tú" or (mensaje["sistema"] and not mensaje["adjuntos"])
	return mensajes


def resolver_autores(mensajes, apodos):
	"""Agrega a cada mensaje el SDR de su autor según el mapa de apodos.

	La comparación ignora mayúsculas, tildes, emojis, signos y espacios de más, porque el
	nombre de contacto puede venir con un espacio final o un emoji.
	"""
	mapa = {sin_tildes(apodo): sdr for apodo, sdr in apodos.items()}
	desconocidos = []
	for mensaje in mensajes:
		autor = sin_tildes(mensaje["autor"])
		mensaje["autor_conocido"] = autor in mapa
		mensaje["sdr"] = mapa.get(autor)
		if autor not in mapa and not mensaje["sistema"] and mensaje["autor"] not in desconocidos:
			desconocidos.append(mensaje["autor"])
	return desconocidos


def filtrar_nuevos(mensajes, vistos=(), desde=None):
	"""Deja solo los mensajes que no están en `vistos` y, si se pide, posteriores a `desde`."""
	vistos = set(vistos)
	nuevos = [m for m in mensajes if m["id"] not in vistos]
	if desde:
		nuevos = [m for m in nuevos if m["id"] > desde]
	return nuevos


def main():
	parser = argparse.ArgumentParser(description="Lee el _chat.txt de un export de WhatsApp.")
	parser.add_argument("carpeta", help="Carpeta donde se descomprimió el export")
	parser.add_argument("--vistos", help="Registro JSON con la clave `mensajes_vistos`")
	parser.add_argument("--apodos", help="apodos.json del repo privado, para resolver quién es cada autor")
	parser.add_argument("--desde", help="Solo mensajes con id mayor a este")
	parser.add_argument("--contexto", type=int, default=0, help="Cuántos mensajes ya vistos incluir antes del primero nuevo")
	parser.add_argument("--salida", help="Archivo donde guardar el JSON (por defecto, pantalla)")
	args = parser.parse_args()

	carpeta = Path(args.carpeta)
	chat = next(iter(sorted(carpeta.rglob("_chat.txt"))), None)
	if not chat:
		sys.exit(f"No hay _chat.txt en {carpeta}")
	mensajes = leer_chat(chat)
	if not mensajes and chat.stat().st_size > 0:
		sys.exit(f"{chat} tiene contenido pero ningún mensaje calza con el formato esperado. Revisa el formato del export.")
	vistos, apodos = [], {}
	if args.vistos and Path(args.vistos).exists():
		registro = json.loads(Path(args.vistos).read_text(encoding="utf-8"))
		vistos = registro.get("mensajes_vistos", [])
		apodos.update(registro.get("alias") or {})
	if args.apodos and Path(args.apodos).exists():
		# El mapa confirmado por Alberto manda sobre lo aprendido en corridas anteriores.
		apodos.update(json.loads(Path(args.apodos).read_text(encoding="utf-8")).get("apodos") or {})
	nuevos = filtrar_nuevos(mensajes, vistos, args.desde)
	desconocidos = resolver_autores(nuevos, apodos) if args.apodos else []

	# Avisa si el chat menciona un adjunto que no vino en el zip.
	faltantes = [a for m in nuevos for a in m["adjuntos"] if not (chat.parent / a).exists()]

	# Mensajes ya vistos justo antes del primero nuevo: solo para entender la conversación.
	contexto = []
	if nuevos and args.contexto:
		primero = mensajes.index(nuevos[0])
		contexto = [{**m, "contexto": True} for m in mensajes[max(0, primero - args.contexto):primero] if m["id"] in set(vistos)]

	resultado = {
		"carpeta": str(chat.parent),
		"total_en_export": len(mensajes),
		"nuevos": len(nuevos),
		"adjuntos_faltantes": faltantes,
		"autores_desconocidos": desconocidos,
		"contexto": contexto,
		"mensajes": nuevos,
	}
	texto = json.dumps(resultado, ensure_ascii=False, indent="\t")
	if args.salida:
		Path(args.salida).write_text(texto, encoding="utf-8")
		print(f"{len(nuevos)} mensajes nuevos de {len(mensajes)} -> {args.salida}")
	else:
		sys.stdout.reconfigure(encoding="utf-8")
		print(texto)


if __name__ == "__main__":
	main()
