"""Propone el mapa de apodos (nombre de contacto en el chat -> SDR) a partir de un export.

Uso:
	python3 proponer_apodos.py CARPETA_EXPORT --config datos/config.json --salida CARPETA_PRIVADA/apodos.json

Del export solo se usan los AUTORES de los mensajes, nunca el contenido. El resultado es
privado (va al repo privado) y queda con "confirmado": false hasta que Alberto lo revise.

Formato de apodos.json:
	{
		"confirmado": false,
		"apodos": { "apodo del chat": "id-del-sdr", "apodo de alguien que no juega": null },
		"sin_resolver": ["apodo que el script no pudo asociar"]
	}
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from leer_chat import leer_chat  # noqa: E402
from reglas import guardar_json, leer_json, sin_tildes  # noqa: E402


def proponer(autores, config):
	"""Asocia cada autor al SDR cuyo nombre comparte más palabras con el apodo.

	Una palabra que solo tiene un SDR (un apellido) pesa el doble que una compartida
	(un nombre de pila repetido). Si hay empate o no hay coincidencias, queda sin resolver.
	"""
	palabras = {
		sdr["id"]: set(sin_tildes(sdr["nombre"]).split())
		for squad in config["squads"] for sdr in squad["integrantes"]
	}
	veces = Counter(palabra for conjunto in palabras.values() for palabra in conjunto)
	apodos, sin_resolver = {}, []
	for autor in autores:
		del_apodo = set(sin_tildes(autor).split())
		puntajes = {
			sdr: sum(2 if veces[palabra] == 1 else 1 for palabra in del_apodo & conjunto if len(palabra) > 1)
			for sdr, conjunto in palabras.items()
		}
		mejor = max(puntajes.values(), default=0)
		candidatos = [sdr for sdr, puntaje in puntajes.items() if puntaje == mejor]
		if mejor > 0 and len(candidatos) == 1:
			apodos[autor] = candidatos[0]
		else:
			sin_resolver.append(autor)
	return apodos, sin_resolver


def main():
	parser = argparse.ArgumentParser(description="Propone el mapa de apodos a partir de los autores de un export.")
	parser.add_argument("carpeta", help="Carpeta donde se descomprimió el export")
	parser.add_argument("--config", required=True)
	parser.add_argument("--salida", required=True, help="Ruta de apodos.json en la carpeta privada")
	args = parser.parse_args()

	chat = next(iter(sorted(Path(args.carpeta).rglob("_chat.txt"))), None)
	if not chat:
		sys.exit(f"No hay _chat.txt en {args.carpeta}")
	conteo = Counter(m["autor"] for m in leer_chat(chat) if not m["sistema"])
	autores = [autor for autor, _ in conteo.most_common()]

	# Lo que ya estaba en apodos.json manda: solo se agregan autores nuevos.
	salida = Path(args.salida)
	actual = leer_json(salida) if salida.exists() else {"confirmado": False, "apodos": {}, "sin_resolver": []}
	nuevos = [autor for autor in autores if autor not in actual["apodos"]]
	apodos, sin_resolver = proponer(nuevos, leer_json(args.config))
	actual["apodos"].update(apodos)
	actual["sin_resolver"] = sorted(set(actual.get("sin_resolver", [])) - set(actual["apodos"]) | set(sin_resolver))
	if apodos or sin_resolver:
		actual["confirmado"] = False
	guardar_json(salida, actual)

	sys.stdout.reconfigure(encoding="utf-8")
	print(f"{len(autores)} autores | propuestos ahora: {len(apodos)} | sin resolver: {len(actual['sin_resolver'])} -> {salida}")


if __name__ == "__main__":
	main()
