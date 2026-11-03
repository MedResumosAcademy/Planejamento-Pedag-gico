import assert from 'node:assert/strict'
import { parseResumosGoogleValues } from '../src/lib/resumos-google-parser.ts'

function fixture() {
  const resumo = Array.from({ length: 16 }, () => [])
  resumo[0] = ['', 'Ciclo Básico', 'Ciclo Clínico', 'Total']
  resumo[1] = ['Temas', '1', '1', '2']
  resumo[2] = ['Prontos', '1', '0', '1']
  resumo[3] = ['Faltando', '0', '1', '1']
  resumo[15] = ['Lido do Drive em', '2026-11-02 18:02', '2026-11-02 18:04']
  return {
    resumo,
    temas: [
      ['Ciclo', 'Disciplina', 'Nº', 'Word (pasta do time)', 'Conta como tema', 'Situação', 'O que fazer', 'Word editado em', 'PDF da Dayana', 'PDF oficial', 'Link do PDF', 'Link do Word'],
      ['Ciclo Básico', 'ANATOMIA', '1', 'Word 1', 'sim', 'Pronto — esteira', '', '', '', 'PDF 1', 'https://drive.google.com/file/d/pdf-basic-00001/view', 'https://drive.google.com/file/d/word-basic-0001/view'],
      ['Ciclo Clínico', 'CLÍNICA', '1', 'Word 2', 'sim', 'Não atualizado', '', '', '', '', '', 'https://drive.google.com/file/d/word-clinic-001/view'],
      ['Ciclo Básico', 'ANATOMIA', '', 'Cópia', 'não é tema'],
    ],
    porDisciplina: [
      ['Ciclo', 'Disciplina', 'Temas', 'Prontos', 'Faltando'],
      ['Ciclo Básico', 'ANATOMIA', '1', '1', '0'],
      ['Ciclo Clínico', 'CLÍNICA', '1', '0', '1'],
    ],
    paraAtualizar: [
      ['Ciclo', 'Disciplina', 'Nº', 'Resumo', 'Situação'],
      ['Ciclo Clínico', 'CLÍNICA', '1', 'Word 2', 'Não atualizado'],
    ],
  }
}

const expected = parseResumosGoogleValues(fixture())
assert.deepEqual([expected.cycles.basico.temas, expected.cycles.basico.prontos, expected.cycles.basico.faltando], [1, 1, 0])
assert.deepEqual([expected.cycles.clinico.temas, expected.cycles.clinico.prontos, expected.cycles.clinico.faltando], [1, 0, 1])
assert.equal(expected.excluded_rows, 1)
assert.equal(JSON.stringify(expected).includes('drive.google.com/file/'), false)

function rejects(change, pattern) {
  const input = fixture()
  change(input)
  assert.throws(() => parseResumosGoogleValues(input), pattern)
}

rejects(input => { input.temas[2][0] = '' }, /ciclo inválido/)
rejects(input => { input.temas[2][0] = 'constructor' }, /ciclo inválido/)
rejects(input => { input.temas[1][10] = '' }, /PDF pronto sem link/)
rejects(input => { input.temas[2][11] = input.temas[1][10] }, /duplicado/)
rejects(input => { input.temas[2][5] = 'Pronto — desconhecido' }, /situação desconhecida/)
rejects(input => { input.porDisciplina[2][4] = '0' }, /contagem não confere/)
rejects(input => { input.paraAtualizar[1][4] = 'Word só com o cabeçalho' }, /não confere com pendências/)
rejects(input => { input.resumo[1][3] = '3' }, /total dos ciclos não confere/)
rejects(input => { input.resumo[15][1] = '02/11/2026' }, /data inválida/)
rejects(input => { input.temas[2][1] = 'CLÍNICA ' }, /não canônico/)

console.log('Google Sheets: reconciliação, ciclos, links, exclusões, datas e falha fechada validados.')
