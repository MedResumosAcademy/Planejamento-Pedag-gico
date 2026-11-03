import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real pure TS modules without an extra test dependency or disk output.
const nativeRequire = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const modules = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const mod = { exports: {} }
  modules.set(filename, mod)
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const require = spec => spec.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), spec + '.ts'))) : nativeRequire(spec)
  vm.runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(require, mod, mod.exports)
  return mod.exports
}
const C = load('src/lib/content-categories.ts')
const A = load('src/lib/analytics.ts')
const now = '2026-11-02T12:00:00Z'
const target = '2026-12-31T12:00:00Z'
const pending = Object.fromEntries(A.STAGES.map(stage => [stage, 'pendente']))
const tema = { id: 1, disciplina_id: 1, ...pending, status_geral: 'concluido', updated_at: now }

assert.deepEqual(C.CONTENT_CATEGORY_KEYS.map(key => C.categoryStages(key).length), [4, 8, 1, 1])
assert.equal(new Set(C.CONTENT_CATEGORY_KEYS.flatMap(C.categoryStages)).size, 14)
assert.equal(C.parseContentCategory('questoes'), 'questoes')
for (const value of ['comp', 'material', '__proto__', '', null]) assert.equal(C.parseContentCategory(value), null)

for (const category of C.CONTENT_CATEGORY_KEYS) {
  assert.equal(C.categoryStatus(tema, category), 'pendente', 'legacy general status must not complete a category')
  const completed = { ...tema, ...Object.fromEntries(C.categoryStages(category).map(key => [key, 'concluido'])) }
  for (const other of C.CONTENT_CATEGORY_KEYS) {
    const expected = category === other ? 100 : 0
    assert.equal(C.categoryProgress(completed, other).percent, expected, `${category} must not change ${other}`)
    assert.equal(A.kpis([completed], [], now, target, other).progressoPct, expected)
    assert.equal(A.kpis([completed], [], now, target, other).temasConcluidos, category === other ? 1 : 0)
    assert.equal(A.funnel([tema], other).rows[0].fila, 1, 'a category has its own queue entry')
    assert.equal(A.funnel([completed], other).rows.length, C.categoryStages(other).length)
  }
  const started = { ...tema, [C.categoryStages(category)[0]]: 'em_andamento' }
  assert.equal(C.categoryStatus(started, category), 'em_andamento')
  assert.equal(C.categorySummary([started, completed, tema], category).em_andamento, 1)
  assert.equal(C.categorySummary([started, completed, tema], category).concluidos, 1)
  assert.equal(C.categorySummary([], category).progresso_geral, 0)
  assert.equal(C.categoryStatus({}, category), 'pendente', 'missing stage is not progress')
  const disc = { id: 1, nome: 'Disciplina', cor: '#fff' }
  assert.equal(A.riskByDiscipline([disc], [completed], now, target, {}, category)[0].pct, 100)
  const people = A.people([{ id: 'prof', nome: 'Professor', nivel: 'professor', professor_disciplinas: [{ disciplina_id: 1 }] }], [completed], [], [disc], now, {}, category)
  assert.equal(people[0].pct, 100)
}

// Legacy reporting signature remains available; no pages enter the new metrics.
assert.equal(A.kpis([tema], [], now, target).totalStages, 14)
assert.deepEqual(C.categorySummary([{ ...tema, paginas: 999 }], 'resumos'), C.categorySummary([tema], 'resumos'))
const basic = { ...tema, ciclo: 'basico', mat_atualizado: 'concluido' }
const clinical = { ...tema, id: 2, disciplina_id: 2, ciclo: 'clinico', comp_questoes: 'concluido' }
const rows = [basic, clinical]
assert.equal(C.categorySummary(rows.filter(t => t.ciclo === 'basico'), 'questoes').concluidos, 0)
assert.equal(C.categorySummary(rows.filter(t => t.ciclo === 'clinico'), 'questoes').concluidos, 1)
assert.equal(A.filterTemas(rows, [{ id: 'prof', nome: 'Professor', nivel: 'professor', professor_disciplinas: [{ disciplina_id: 1 }] }], { profId: 'prof' }).length, 1)
console.log('Categorias: independência 4/8/1/1, status legado, filas, KPIs, pessoas, risco, ciclos e escopo de professor validados.')
