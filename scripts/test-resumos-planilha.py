#!/usr/bin/env python3
"""Focused fail-closed tests for the spreadsheet snapshot parser."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from openpyxl import Workbook


MODULE = Path(__file__).with_name("update-resumos-planilha.py")
SPEC = importlib.util.spec_from_file_location("update_resumos_planilha", MODULE)
parser = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parser)


def workbook_fixture():
    book = Workbook()
    summary = book.active
    summary.title = "Resumo"
    summary.append([None, "Ciclo Básico", "Ciclo Clínico", "Total", "O que é / o que falta"])
    summary.append(["Temas", 1, 1, 2])
    summary.append(["Prontos", 1, 0, 1])
    summary.append(["Faltando", 0, 1, 1])
    summary["A16"] = "Lido do Drive em"
    summary["B16"] = "2026-11-02 18:02"
    summary["C16"] = "2026-11-02 18:04"

    topics = book.create_sheet("Temas")
    topics.append(parser.HEADERS)
    topics.append(["Ciclo Básico", "ANATOMIA", 1, "Word 1", "sim", "Pronto — esteira",
                   None, None, None, "PDF 1", "https://drive.google.com/file/d/pdf-one-0001/view",
                   "https://drive.google.com/file/d/word-one-0001/view"])
    topics.append(["Ciclo Clínico", "CLÍNICA", 1, "Word 2", "sim", "Não atualizado",
                   None, None, None, None, None, "https://drive.google.com/file/d/word-two-0002/view"])
    topics.append(["Ciclo Básico", "ANATOMIA", None, "Cópia", "não é tema"])

    disciplines = book.create_sheet("Por disciplina")
    disciplines.append(["Ciclo", "Disciplina", "Temas", "Prontos", "Faltando"])
    disciplines.append(["Ciclo Básico", "ANATOMIA", 1, 1, 0])
    disciplines.append(["Ciclo Clínico", "CLÍNICA", 1, 0, 1])
    update = book.create_sheet("Para o time atualizar")
    update.append(["Ciclo", "Disciplina", "Nº", "Resumo", "Situação"])
    update.append(["Ciclo Clínico", "CLÍNICA", 1, "Word 2", "Não atualizado"])
    return book


class ParserTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / "sample.xlsx"
        self.book = workbook_fixture()

    def tearDown(self):
        self.folder.cleanup()

    def parse(self):
        self.book.save(self.path)
        return parser.read_source(self.path)

    def test_valid_snapshot_and_exclusion(self):
        result = self.parse()
        self.assertEqual(result["cycles"]["basico"]["prontos"], 1)
        self.assertEqual(result["cycles"]["clinico"]["faltando"], 1)
        self.assertEqual(result["excluded_rows"], 1)

    def test_rejects_inconsistent_summary(self):
        self.book["Resumo"]["D2"] = 3
        with self.assertRaisesRegex(ValueError, "total dos ciclos"):
            self.parse()

    def test_rejects_ready_without_pdf(self):
        self.book["Temas"]["K2"] = None
        with self.assertRaisesRegex(ValueError, "PDF oficial"):
            self.parse()

    def test_rejects_duplicate_source_identity(self):
        self.book["Temas"]["L3"] = "https://drive.google.com/file/d/word-one-0001/view"
        with self.assertRaisesRegex(ValueError, "duplicado"):
            self.parse()

    def test_rejects_unknown_status(self):
        self.book["Temas"]["F3"] = "Talvez pronto"
        with self.assertRaisesRegex(ValueError, "situação desconhecida"):
            self.parse()

    def test_rejects_theme_without_cycle(self):
        self.book["Temas"]["A3"] = None
        with self.assertRaisesRegex(ValueError, "ciclo ou disciplina inválidos"):
            self.parse()

    def test_rejects_phantom_discipline(self):
        self.book["Por disciplina"].append(["Ciclo Básico", "FANTASMA", 0, 0, 0])
        with self.assertRaisesRegex(ValueError, "ausente em Temas"):
            self.parse()

    def test_rejects_duplicate_official_pdf(self):
        topics = self.book["Temas"]
        topics.append(["Ciclo Básico", "ANATOMIA", 2, "Word 3", "sim", "Pronto — esteira",
                       None, None, None, "PDF 2", "https://drive.google.com/file/d/pdf-one-0001/view",
                       "https://drive.google.com/file/d/word-three-0003/view"])
        with self.assertRaisesRegex(ValueError, "PDF oficial duplicado"):
            self.parse()

    def test_rejects_malformed_pdf_link(self):
        self.book["Temas"]["K2"] = "x"
        with self.assertRaisesRegex(ValueError, "link do PDF inválido"):
            self.parse()

    def test_rejects_malformed_collection_date(self):
        self.book["Resumo"]["B16"] = "02/11/2026 18:02"
        with self.assertRaisesRegex(ValueError, "Data de leitura do Drive inválida"):
            self.parse()

    def test_rejects_unknown_update_cycle(self):
        self.book["Para o time atualizar"].append(["Ciclo Inexistente", "CLÍNICA", 1, "Word 2", "Não atualizado"])
        with self.assertRaisesRegex(ValueError, "ciclo ou disciplina inválidos"):
            self.parse()

    def test_pending_with_old_pdf_remains_pending(self):
        self.book["Temas"]["K3"] = "https://drive.google.com/file/d/pdf-old-0003/view"
        result = self.parse()
        self.assertEqual(result["cycles"]["clinico"]["faltando"], 1)

    def test_rejects_discipline_count_mismatch(self):
        self.book["Por disciplina"]["C2"] = 2
        with self.assertRaisesRegex(ValueError, "não confere com Temas"):
            self.parse()

    def test_rejects_update_list_mismatch(self):
        self.book["Para o time atualizar"]["E2"] = "Word só com o cabeçalho"
        with self.assertRaisesRegex(ValueError, "não confere com pendências"):
            self.parse()

    def test_rejects_noncanonical_discipline(self):
        self.book["Temas"]["B3"] = "CLÍNICA "
        with self.assertRaisesRegex(ValueError, "não canônico"):
            self.parse()

    def test_rejects_boolean_count(self):
        self.book["Resumo"]["B2"] = True
        with self.assertRaisesRegex(ValueError, "contagem inválida"):
            self.parse()

    def test_committed_snapshot_invariants(self):
        snapshot = json.loads(parser.OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(set(snapshot["cycles"]), {"basico", "clinico"})
        self.assertEqual(set(snapshot["source_read_at"]), {"basico", "clinico"})
        for cycle in snapshot["cycles"].values():
            self.assertEqual(cycle["temas"], cycle["prontos"] + cycle["faltando"])
            self.assertEqual(cycle["temas"], sum(row["temas"] for row in cycle["disciplines"]))
            self.assertEqual(cycle["prontos"], sum(row["prontos"] for row in cycle["disciplines"]))
            self.assertEqual(cycle["faltando"], sum(row["faltando"] for row in cycle["disciplines"]))
            self.assertEqual(len({row["nome"] for row in cycle["disciplines"]}), len(cycle["disciplines"]))


if __name__ == "__main__":
    unittest.main()
