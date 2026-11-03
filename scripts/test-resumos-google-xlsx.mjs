// Optional parity check against a local export of the exact authoritative sheet.
// Usage: PYTHON_BIN=/path/to/python node scripts/test-resumos-google-xlsx.mjs /path/to/export.xlsx
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import snapshot from '../src/data/resumos-planilha.snapshot.json' with { type: 'json' }
import { parseResumosGoogleValues } from '../src/lib/resumos-google-parser.ts'

const path = process.argv[2]
if (!path) throw new Error('Informe o caminho do export .xlsx da planilha de resumos.')
const script = `import json, openpyxl, sys
workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
names = ('Resumo', 'Temas', 'Por disciplina', 'Para o time atualizar')
keys = ('resumo', 'temas', 'porDisciplina', 'paraAtualizar')
values = {key: [list(row) for row in workbook[name].values] for key, name in zip(keys, names)}
print(json.dumps(values, default=str, ensure_ascii=False))
workbook.close()`
// The raw workbook rows, including Drive URLs, travel only through this local child-process pipe.
const raw = execFileSync(process.env.PYTHON_BIN || 'python3', ['-c', script, path], {
  encoding: 'utf8', maxBuffer: 8_000_000,
})
const inventory = parseResumosGoogleValues(JSON.parse(raw))
assert.deepEqual(inventory.source_read_at, snapshot.source_read_at)
assert.equal(inventory.excluded_rows, snapshot.excluded_rows)
for (const ciclo of ['basico', 'clinico']) {
  const actual = inventory.cycles[ciclo]
  const expected = snapshot.cycles[ciclo]
  assert.deepEqual([actual.temas, actual.prontos, actual.faltando],
    [expected.temas, expected.prontos, expected.faltando])
  const byName = rows => Object.fromEntries(rows.map(({ nome, temas, prontos, faltando }) =>
    [nome, { temas, prontos, faltando }]))
  assert.deepEqual(byName(actual.disciplines), byName(expected.disciplines))
}
console.log(`Paridade confirmada com o snapshot: básico ${inventory.cycles.basico.prontos}/${inventory.cycles.basico.temas}, clínico ${inventory.cycles.clinico.prontos}/${inventory.cycles.clinico.temas}; ${inventory.excluded_rows} linhas excluídas.`)
