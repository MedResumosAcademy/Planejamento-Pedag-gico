import assert from 'node:assert/strict'
import { parseSnapshot, summarizeAcervo, itemKey } from '../src/lib/acervo-contract.ts'

const snapshot = { version: 1, source: 'mra_academy', environment: 'staging', instance: 'fixture', observed_at: '2026-11-02T12:00:00Z', scope: 'shared_catalog', items: [
  { entity: 'questions', external_id: 'q1', category: 'questoes', kind: 'content', cycle: 'clinico', label: 'Questão q1', taxonomy_label: 'Cardiologia', native_status: 'approved', facts: { generated: 1, reviewed: null, approved: 1, published: 1 }, updated_at: '2026-11-01T12:00:00Z' },
] }
const parse = value => parseSnapshot(value, Date.parse('2026-11-03T00:00:00Z'))
const mutate = fn => { const v = structuredClone(snapshot); fn(v); return v }
assert.equal(parse(snapshot).items.length, 1)
for (const change of [
  v => { v.scope = 'personal' }, v => { v.items[0].answer = 'A' },
  v => { v.items[0].facts.reviewed = -1 }, v => { v.items[0].facts.reviewed = 2 },
  v => { delete v.items[0].facts.reviewed }, v => { v.items.push(v.items[0]) },
  v => { v.environment = 'test' }, v => { v.instance = 'https://bad.example' },
  v => { v.source = 'flashcard_factory' }, v => { v.items[0].category = 'videos' },
  v => { v.items[0].updated_at = '2026-11-03T00:00:00Z' },
  v => { v.observed_at = '2026-11-04T00:00:00Z' },
  v => { v.observed_at = '2026-11-01' }, v => { v.items = [] },
  v => { v.items[0].cycle = 'desconhecido' }, v => { v.items[0].label = '' },
  v => { v.items[0].facts = { generated: true } },
]) assert.throws(() => parse(mutate(change)))
const content = parse(snapshot).items[0]
const batch = { ...content, entity: 'generation_batches', external_id: 'b1', kind: 'batch', facts: { generated: 100, reviewed: 80, approved: 70, published: null } }
const summary = summarizeAcervo([content, batch], 'questoes')
assert.equal(summary.total, 1, 'batch must never inflate content inventory')
assert.equal(summary.batches, 1)
assert.deepEqual(summary.stages.reviewed, { count: 0, unknown: 1 }, 'published does not imply reviewed')
assert.deepEqual(summary.stages.published, { count: 1, unknown: 0 })
assert.equal(summarizeAcervo([content, batch], 'flashcards').total, 0)
assert.notEqual(itemKey({ entity: 'a', external_id: 'b:c' }), itemKey({ entity: 'a:b', external_id: 'c' }))
console.log('Acervo: contrato estrito, privacidade por allowlist, datas, IDs, etapas independentes e exclusão de lotes das contagens validados.')
