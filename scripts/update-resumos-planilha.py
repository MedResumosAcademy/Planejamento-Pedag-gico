#!/usr/bin/env python3
"""Validate the exported Google Sheet and refresh its aggregate-only dashboard snapshot.

Requires openpyxl 3.1+. Default mode is read-only; --write replaces only the
generated snapshot after all reconciliation checks pass. It never connects to
Supabase or changes editorial planning records.
"""

import argparse
from collections import Counter, defaultdict
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile
import unicodedata
from zipfile import BadZipFile

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "resumos-planilha.snapshot.json"
SOURCE_URL = "https://docs.google.com/spreadsheets/d/1Dh-XqkR5SmoVd5LQvJacffQnKkpBn-4JpQumH_N_2LM/edit"
CYCLES = {"Ciclo Básico": "basico", "Ciclo Clínico": "clinico"}
PENDING = {
    "Word mudou depois do PDF",
    "Atualizado, falta diagramar",
    "Aguardando conteúdo completo",
    "Word só com o cabeçalho",
    "Não atualizado",
}
READY = {
    "Pronto — Dayana",
    "Pronto — Dayana (sem Word na pasta do time)",
    "Pronto — esteira",
}
DRIVE_ID = re.compile(r"https://drive\.google\.com/file/d/([A-Za-z0-9_-]{10,})/view(?:\?.*)?$")
READ_AT = re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}")
HEADERS = (
    "Ciclo", "Disciplina", "Nº", "Word (pasta do time)", "Conta como tema",
    "Situação", "O que fazer", "Word editado em", "PDF da Dayana",
    "PDF oficial", "Link do PDF", "Link do Word",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value, label):
    require(not isinstance(value, bool) and isinstance(value, (float, int)) and
            value >= 0 and int(value) == value,
            f"{label}: contagem inválida ({value!r})")
    return int(value)


def discipline_name(value, label):
    require(isinstance(value, str) and value.strip(), f"{label}: disciplina inválida")
    canonical = unicodedata.normalize("NFC", value).strip()
    require(value == canonical, f"{label}: disciplina com espaços ou Unicode não canônico")
    return canonical


def read_source(path):
    require(path.is_file() and path.suffix.lower() == ".xlsx", "Informe um arquivo .xlsx existente")
    source_bytes = path.read_bytes()
    workbook = load_workbook(BytesIO(source_bytes), read_only=True, data_only=True)
    try:
        return parse_workbook(workbook, sha256(source_bytes).hexdigest())
    finally:
        workbook.close()


def parse_workbook(workbook, source_hash):
    require({"Resumo", "Temas", "Por disciplina", "Para o time atualizar"}.issubset(workbook.sheetnames),
            "Abas obrigatórias ausentes")

    summary = workbook["Resumo"]
    require(tuple(summary.cell(1, col).value for col in range(2, 5)) ==
            ("Ciclo Básico", "Ciclo Clínico", "Total"), "Cabeçalho do resumo mudou")
    require([summary.cell(row, 1).value for row in (2, 3, 4)] ==
            ["Temas", "Prontos", "Faltando"], "Linhas do resumo mudaram")
    observed = {
        "basico": summary["B16"].value,
        "clinico": summary["C16"].value,
    }
    require(summary["A16"].value == "Lido do Drive em", "Rótulo da leitura do Drive mudou")
    for cycle, value in observed.items():
        require(isinstance(value, str) and READ_AT.fullmatch(value) is not None,
                f"Data de leitura do Drive inválida: {cycle}")
        datetime.strptime(value, "%Y-%m-%d %H:%M")

    rows = workbook["Temas"].values
    require(tuple(next(rows, ())[:12]) == HEADERS, "Colunas da aba Temas mudaram")
    counts = defaultdict(Counter)
    discipline_counts = defaultdict(Counter)
    identities = set()
    pdf_identities = set()
    pending_by_status = Counter()
    excluded = 0
    for row_number, row in enumerate(rows, start=2):
        if not row or not any(value is not None and value != "" for value in row):
            continue
        require(len(row) >= len(HEADERS), f"Temas!{row_number}: colunas incompletas")
        cycle, discipline, _, _, eligible, status = row[:6]
        eligible = str(eligible).strip().casefold()
        require(cycle in CYCLES, f"Temas!{row_number}: ciclo ou disciplina inválidos")
        discipline = discipline_name(discipline, f"Temas!{row_number}")
        require(eligible in ("sim", "não é tema", "outro word do mesmo tema"),
                f"Temas!{row_number}: regra de contagem desconhecida")
        if eligible != "sim":
            excluded += 1
            continue
        require(isinstance(status, str) and (status in READY or status in PENDING),
                f"Temas!{row_number}: situação desconhecida")
        ready = status in READY
        pdf_link, word_link = row[10:12]
        require(not ready or bool(pdf_link), f"Temas!{row_number}: PDF oficial ausente")
        require(not pdf_link or (isinstance(pdf_link, str) and DRIVE_ID.fullmatch(pdf_link) is not None),
                f"Temas!{row_number}: link do PDF inválido")
        require(not word_link or (isinstance(word_link, str) and DRIVE_ID.fullmatch(word_link) is not None),
                f"Temas!{row_number}: link do Word inválido")
        identity = DRIVE_ID.fullmatch(word_link or pdf_link or "")
        require(identity is not None, f"Temas!{row_number}: ID estável do Drive ausente")
        require(identity.group(1) not in identities, f"Temas!{row_number}: arquivo do Drive duplicado")
        identities.add(identity.group(1))
        if pdf_link:
            pdf_identity = DRIVE_ID.fullmatch(pdf_link).group(1)
            require(pdf_identity not in pdf_identities,
                    f"Temas!{row_number}: PDF oficial duplicado")
            pdf_identities.add(pdf_identity)
        key = CYCLES[cycle]
        counts[key]["temas"] += 1
        counts[key]["prontos" if ready else "faltando"] += 1
        discipline_counts[(key, discipline)]["temas"] += 1
        discipline_counts[(key, discipline)]["prontos" if ready else "faltando"] += 1
        if not ready:
            pending_by_status[(key, discipline, status)] += 1

    by_discipline = workbook["Por disciplina"].values
    require(tuple(next(by_discipline, ())[:5]) ==
            ("Ciclo", "Disciplina", "Temas", "Prontos", "Faltando"),
            "Colunas da aba Por disciplina mudaram")
    seen = set()
    for row_number, row in enumerate(by_discipline, start=2):
        if not row or not any(value is not None and value != "" for value in row):
            continue
        require(len(row) >= 5, f"Por disciplina!{row_number}: colunas incompletas")
        cycle, discipline = row[:2]
        require(cycle in CYCLES, f"Por disciplina!{row_number}: ciclo ou disciplina inválidos")
        discipline = discipline_name(discipline, f"Por disciplina!{row_number}")
        key = (CYCLES[cycle], discipline)
        require(key not in seen, f"Por disciplina!{row_number}: disciplina duplicada")
        expected = discipline_counts.get(key)
        require(expected is not None, f"Por disciplina!{row_number}: disciplina ausente em Temas")
        seen.add(key)
        for offset, field in ((2, "temas"), (3, "prontos"), (4, "faltando")):
            require(integer(row[offset], f"Por disciplina!{row_number}") == expected[field],
                    f"Por disciplina!{row_number}: {field} não confere com Temas")
    require(seen == set(discipline_counts), "Disciplinas sem reconciliação")

    for cycle, key in CYCLES.items():
        column = 2 if key == "basico" else 3
        for row, field in ((2, "temas"), (3, "prontos"), (4, "faltando")):
            require(integer(summary.cell(row, column).value, f"Resumo!{row}") == counts[key][field],
                    f"Resumo!{row}: {cycle} não confere com Temas")
        require(counts[key]["temas"] == counts[key]["prontos"] + counts[key]["faltando"],
                f"{cycle}: total não confere")
    for row, field in ((2, "temas"), (3, "prontos"), (4, "faltando")):
        require(integer(summary.cell(row, 4).value, f"Resumo!D{row}") ==
                sum(counts[key][field] for key in CYCLES.values()),
                f"Resumo!D{row}: total dos ciclos não confere")
    update_rows = workbook["Para o time atualizar"].values
    require(tuple(next(update_rows, ())[:5]) == ("Ciclo", "Disciplina", "Nº", "Resumo", "Situação"),
            "Colunas da aba Para o time atualizar mudaram")
    to_update = Counter()
    for row_number, row in enumerate(update_rows, start=2):
        if not row or not any(value is not None and value != "" for value in row):
            continue
        require(len(row) >= 5 and row[0] in CYCLES,
                f"Para o time atualizar!{row_number}: ciclo ou disciplina inválidos")
        discipline = discipline_name(row[1], f"Para o time atualizar!{row_number}")
        require(row[4] in PENDING, f"Para o time atualizar!{row_number}: situação desconhecida")
        to_update[(CYCLES[row[0]], discipline, row[4])] += 1
    require(to_update == pending_by_status,
            "Lista Para o time atualizar não confere com pendências")

    return {
        "version": 1,
        "source": "Controle dos resumos — Ciclo Básico e Ciclo Clínico",
        "source_url": SOURCE_URL,
        "source_file_sha256": source_hash,
        "source_read_at": observed,
        "excluded_rows": excluded,
        "cycles": {
            key: {
                "temas": counts[key]["temas"],
                "prontos": counts[key]["prontos"],
                "faltando": counts[key]["faltando"],
                "disciplines": [
                    {"nome": name, "temas": values["temas"],
                     "prontos": values["prontos"], "faltando": values["faltando"]}
                    for (this_cycle, name), values in sorted(discipline_counts.items())
                    if this_cycle == key
                ],
            }
            for key in CYCLES.values()
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--write", action="store_true", help="substituir o snapshot validado")
    args = parser.parse_args()
    snapshot = read_source(args.xlsx)
    output = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if args.write:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = None
        try:
            with NamedTemporaryFile("w", encoding="utf-8", dir=OUTPUT.parent,
                                    prefix=".resumos-planilha-", suffix=".tmp", delete=False) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(output)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.chmod(temporary_path, 0o644)
            os.replace(temporary_path, OUTPUT)
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        print(f"Snapshot validado salvo em {OUTPUT}")
    else:
        print("Prévia validada; nenhum arquivo alterado.")
    print(json.dumps({key: {field: cycle[field] for field in ("temas", "prontos", "faltando")}
                      for key, cycle in snapshot["cycles"].items()}, ensure_ascii=False))
    print(f"Linhas excluídas: {snapshot['excluded_rows']}; SHA-256: {snapshot['source_file_sha256']}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, BadZipFile) as error:
        print(f"Planilha recusada: {error}", file=sys.stderr)
        sys.exit(1)
