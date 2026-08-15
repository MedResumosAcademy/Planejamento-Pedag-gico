import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const data = JSON.parse(await fs.readFile(new URL('../data/ciclo-clinico-2026.json', import.meta.url), 'utf8'))
const migration = await fs.readFile(new URL('../supabase/migrations/20260815123019_add_ciclo_clinico_2026.sql', import.meta.url), 'utf8')

const disciplines = data.disciplinas
const topics = disciplines.flatMap(discipline => discipline.temas.map(topic => ({ discipline: discipline.nome, ...topic })))

assert.equal(data.ciclo, 'clinico')
assert.equal(disciplines.length, 29)
assert.equal(new Set(disciplines.map(d => d.nome.toLocaleUpperCase('pt-BR'))).size, 29)
assert.equal(topics.length, 410)
assert.equal(topics.reduce((sum, topic) => sum + topic.paginas, 0), 3859)

for (const discipline of disciplines) {
  assert.equal(discipline.total_temas, discipline.temas.length, `${discipline.nome}: total de temas`)
  assert.equal(discipline.total_paginas, discipline.temas.reduce((sum, topic) => sum + topic.paginas, 0), `${discipline.nome}: total de páginas`)
  assert.deepEqual(discipline.temas.map(topic => topic.ordem), Array.from({ length: discipline.temas.length }, (_, index) => index + 1), `${discipline.nome}: ordem dos temas`)
  assert.equal(new Set(discipline.temas.map(topic => topic.tema_especifico.toLocaleUpperCase('pt-BR'))).size, discipline.temas.length, `${discipline.nome}: temas duplicados`)
}

assert.match(migration, /check \(ciclo in \('basico', 'clinico'\)\)/)
assert.match(migration, /v_disciplinas <> 29 or v_temas <> 410 or v_paginas <> 3859/)
assert.match(migration, /create temporary table _ciclo_clinico_baseline_disciplinas/)
assert.match(migration, /\(to_jsonb\(d\) - 'ciclo'\) is distinct from b\.payload/)
assert.match(migration, /create temporary table _ciclo_clinico_baseline_temas/)
assert.match(migration, /to_jsonb\(t\) is distinct from b\.payload/)

const topicBlock = migration.match(/with source_topics[\s\S]+?values\n([\s\S]+?)\n\)\ninsert into public\.temas/)
assert.ok(topicBlock, 'Bloco source_topics não encontrado na migração')
const sqlTopicRows = topicBlock[1].split('\n').filter(line => /^    \('/.test(line))
assert.equal(sqlTopicRows.length, 410)

console.log('Ciclo clínico validado: 29 disciplinas, 410 temas e 3.859 páginas.')
