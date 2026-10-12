"""Convierte la descarga del export desde Drive en una carpeta con `_chat.txt` y las capturas.

Uso:
	python3 abrir_export.py ARCHIVO_DESCARGADO CARPETA_DESTINO

ARCHIVO_DESCARGADO puede ser:
- el archivo donde el sistema guardó la respuesta de `download_file_content` (un JSON que
  trae el zip en base64 en la clave `content`, a veces envuelto en bloques de texto), o
- directamente un .zip.

CARPETA_DESTINO debe ser nueva o estar vacía: lo que viene del chat es contenido no confiable.
"""

import base64
import binascii
import json
import sys
import zipfile
from pathlib import Path


def buscar_base64(dato):
	"""Busca el contenido del archivo dentro de la respuesta, venga envuelta como venga."""
	if isinstance(dato, dict):
		if isinstance(dato.get("content"), str) and len(dato["content"]) > 1000:
			return dato["content"]
		dato = list(dato.values())
	if isinstance(dato, list):
		for parte in dato:
			encontrado = buscar_base64(parte)
			if encontrado:
				return encontrado
	if isinstance(dato, str) and dato.lstrip().startswith(("{", "[")):
		try:
			return buscar_base64(json.loads(dato))
		except json.JSONDecodeError:
			return None
	return None


def obtener_zip(origen, destino_zip):
	"""Deja el zip en disco, decodificándolo si viene en base64."""
	crudo = Path(origen).read_bytes()
	if crudo[:2] == b"PK":
		destino_zip.write_bytes(crudo)
		return
	contenido = buscar_base64(json.loads(crudo.decode("utf-8")))
	if not contenido:
		sys.exit("No encontré el zip en base64 dentro del archivo descargado.")
	destino_zip.write_bytes(base64.b64decode(contenido))


def main():
	if len(sys.argv) != 3:
		sys.exit(__doc__)
	origen, carpeta = sys.argv[1], Path(sys.argv[2])
	if carpeta.exists() and any(carpeta.iterdir()):
		sys.exit(f"{carpeta} no está vacía. Usa una carpeta nueva.")
	carpeta.mkdir(parents=True, exist_ok=True)

	destino_zip = carpeta.parent / (carpeta.name + ".zip")
	try:
		obtener_zip(origen, destino_zip)
		with zipfile.ZipFile(destino_zip) as archivo:
			archivo.extractall(carpeta)
	except (zipfile.BadZipFile, binascii.Error, json.JSONDecodeError, UnicodeDecodeError) as error:
		sys.exit(f"No se pudo abrir el export: el archivo descargado está incompleto o dañado ({type(error).__name__}).")

	archivos = [a for a in carpeta.rglob("*") if a.is_file()]
	chat = next((a for a in archivos if a.name == "_chat.txt"), None)
	if not chat:
		sys.exit("El zip no trae _chat.txt: no parece un export de WhatsApp.")
	fotos = [a for a in archivos if a.suffix.lower() in (".jpg", ".jpeg", ".png")]
	print(f"zip: {destino_zip.stat().st_size} bytes | archivos: {len(archivos)} | fotos: {len(fotos)} | chat: {chat}")


if __name__ == "__main__":
	main()
