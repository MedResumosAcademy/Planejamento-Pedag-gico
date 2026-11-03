# Acervo e fábricas — Med2026

## Resumos: fonte autoritativa definida em 03/11/2026

Giordano definiu que **somente** a planilha Google `Controle dos resumos — Ciclo Básico e Ciclo Clínico` determina o inventário de resumos do Dashboard. O export `.xlsx` recebido foi lido como snapshot, sem alterar o cadastro legado de disciplinas/temas ou suas etapas manuais. O painel mostra, por ciclo e por disciplina, temas elegíveis, PDFs oficiais prontos, pendentes, origem e horário da coleta. Não confundir 719 temas com 719 PDFs: nesta versão são 558 prontos e 161 pendentes.

Atualização repetível: exportar a versão atual da mesma planilha em `.xlsx`, executar `python3 -m pip install -r scripts/requirements-resumos.txt` em ambiente isolado, depois `python3 scripts/update-resumos-planilha.py /caminho/para/export.xlsx` para prévia. Somente após conferir os totais, repetir com `--write`, revisar o diff do snapshot, testar o app e entregar por PR. O script recusa cabeçalhos, contagens, identidades, datas, links ou estados inconsistentes; um PDF antigo pode existir em tema pendente e não o torna pronto. O estado da planilha define a contagem. Não grava no banco nem importa URLs de Word/PDF para o frontend. Ausência no novo export não remove registros do Med2026. O snapshot versionado deve ser tratado como **retrato datado**, não sincronização automática: leitura direta futura do Google Sheets exige credencial com permissão de leitor e contrato de execução próprio. O bundle do painel contém apenas agregados, a data e o endereço da planilha — esses dados não são protegidos por uma ACL de coordenador no bundle. O endereço da planilha exibido ao gestor segue as permissões de compartilhamento do Google e deve permanecer restrito às contas autorizadas.

Na planilha recebida em 02/11/2026, as abas `Resumo`, `Temas`, `Por disciplina` e `Para o time atualizar` reconciliaram 273/446 temas, 240/318 prontos e 33/128 pendentes (básico/clínico). Foram excluídas 44 linhas marcadas como cópia ou não tema. Todos os 719 temas contáveis têm um ID de arquivo do Drive único (Word ou PDF), mas a associação ao cadastro Med2026 continua pendente: o painel legado prevê 258/410 temas e 18/29 disciplinas, enquanto a planilha tem 273/446 e 20/30. Não executar associação automática por ciclo+disciplina+número, pois há números repetidos e ausentes. A fonte de resumos aqui substitui a hipótese anterior de usar o catálogo MRA para essa categoria; MRA segue como origem a investigar para videoaulas e flashcards.

## Estado desta entrega

Quatro esteiras de planejamento independentes, sem indicadores de páginas. O histórico de páginas permanece no banco. A área `/acervo` aceita metadados v1 com prévia, associação por ID de tema e confirmação. Há um cliente opcional de feed HTTPS **ainda não conectado**; não existe contrato live verificado das fábricas externas. Nenhuma rotina de geração, revisão, autorização ou publicação é chamada.

O acervo importado NÃO conclui etapas editoriais automaticamente. Essa separação preserva decisões manuais e evita marcar publicado como revisado. Lotes e unidades de conteúdo têm contagens separadas. Ambientes e fontes não são somados. O produtor deve usar uma entidade canônica por unidade, evitando duplicar `documents` e `content` para o mesmo resumo.

## Preservação e autorização

A migration `20261102180000_acervo_metadata.sql` é **exclusiva do Med2026**, aditiva, sem UPDATE/DELETE nas tabelas existentes. Não executar no MRA Academy. Dados e vínculo importados ficam em `acervo_itens`; prévias/auditoria em `acervo_importacoes`. Ausência no arquivo nunca exclui registros. A confirmação é transacional e detecta prévias concorrentes, coleta antiga, incompatibilidade de ciclo e replay. Previews expiram em uma hora, mas permanecem registrados para auditoria; retenção exige rotina posterior explicitamente autorizada.

As novas tabelas têm RLS, sem acesso anon/authenticated; RPC somente service_role. Toda rota verifica sessão e `acervo_operadores`, tabela administrada exclusivamente pelo serviço. Não confiar no papel legado em `colaboradores`: RLS dessa tabela está desativado no ambiente observado em 02/11/2026, e as rotas legadas de criação/convite precisam de hardening em tarefa própria. Esta entrega não afirma resolver a segurança integral do sistema.

Antes de ativar: backup verificado do Med2026, aplicar migration no projeto **prscxavwanrhvxarlnlf**, confirmar usuários permitidos com a gestão e inserir seus UUIDs em `acervo_operadores` por canal administrativo. Não conceder acesso pela autodeclaração de perfil. Testar 401 sem sessão, 403 sem ACL e sucesso autorizado. Não copiar credenciais MRA para o frontend.

## Contrato de entrada v1

JSON máximo 2 MB / 2.000 registros por prévia. `src/lib/acervo-contract.ts` é o contrato executável. Campos não previstos são recusados. Fragmentos podem ser importados separadamente, sempre sem exclusão por ausência. Labels são metadados públicos/editoriais; não enviar enunciados, respostas, frentes/versos, nomes de alunos, caminhos de storage ou URLs assinadas.

```json
{
  "version": 1,
  "source": "mra_academy",
  "environment": "staging",
  "instance": "xbgwkuhtxgkubomweqjy",
  "scope": "shared_catalog",
  "observed_at": "2026-11-02T12:00:00Z",
  "items": [{
    "entity": "questions",
    "external_id": "ID_ESTAVEL_DA_QUESTAO",
    "category": "questoes",
    "kind": "content",
    "cycle": "clinico",
    "label": "Questão ID_ESTAVEL_DA_QUESTAO",
    "taxonomy_label": "Cardiologia",
    "native_status": "pending_authorization",
    "facts": { "generated": 1, "reviewed": 1, "approved": 0, "published": 0 },
    "updated_at": "2026-11-01T12:00:00Z"
  }]
}
```

`source`: `mra_academy`, `question_factory`, `flashcard_factory`. `environment`: `staging` ou `production` (proveniência da leitura, não autorização de escrita). `instance` é identificador estável do dataset. `kind=content`: uma unidade por ID, fatos 0/1/null. `kind=batch`: contagens observadas de lote, nunca somadas ao inventário. `cycle=null`: não classificado, sem vínculo permitido; corrigir na origem antes de associar. Taxonomia MRA e tema Med2026 não são equivalentes por nome; associação é explícita na prévia.

Fatos são independentes e não cumulativos. `null` é desconhecido, não zero. Em particular, `approved_count` da fábrica integrada pode incluir `pending_authorization`, portanto não pode alimentar `published`. Revisão humana só pode ser informada com evidência explícita da fonte. Declarar `scope=shared_catalog` não substitui a filtragem de escopo no produtor; o operador deve conferir esse contrato antes de importar.

## Origens confirmadas pelo gestor

Questões: https://mra-fabrica-de-questoes.medresumosof.workers.dev/ (atalho no painel, não comprova sincronização). HTML público exige login para registros atuais; não foi encontrado contrato metadata-only público. Flashcards: fábrica dentro do MRA Project, usando CLI do Welber, rota staging https://app-staging.mracademy.com.br/admin/fabrica-flashcards. Nenhum CLI foi executado. Consulta autenticada atual permanece requisito da conexão.

Mapa adicional confirmado no worktree `.worktrees/mra-lab-unified-20261101`, SHA `5979007cee08c2407139abef5c681c681a7b149d`: tabelas `flashcard_factory_jobs/candidates/events`, separadas do catálogo. GET `/api/admin/flashcard-factory/jobs?page=1`, sessão super_admin ativa, paginação 50, retorna contagens geradas/modelo/aprovação interna; excluir `created_by`, `plan`, `metadata`. GET candidates contém frente/verso e recibos, NÃO importar bruto. Estados `generation_status`, `model_status`, `human_status` independentes; aprovação interna não é publicação para alunos. Capability do CLI é por job e expira; não é credencial de integração genérica. Rota/SHA servido não foram comprovados em runtime.

## Fonte direta opcional

Servidor: `MRA_METADATA_FEED_URL` (HTTPS, sem query/fragmento/credencial, porta padrão), `MRA_METADATA_FEED_TOKEN` (credencial de **leitura apenas**), `MRA_METADATA_ALLOWED_HOSTS` (lista exata separada por vírgula). Sem essas configurações, o painel informa conexão pendente. GET autenticado, sem redirects, timeout 15 s, limite 2 MB. O endpoint deve devolver o contrato completo de uma coleta/fragmento. Não apontar para endpoints de exportação que enfileiram jobs; não usar chave service-role da Academy como atalho. O feed deve bloquear hosts internos também na camada de rede/infraestrutura.

Ativação do adaptador MRA depende de schema/ACL atuais, política de catálogo compartilhado e URLs das fábricas confirmadas. Só leitura em produção; qualquer mudança de API no MRA segue staging-only + TechTop + validação própria. Nenhuma chave/fonte foi configurada nesta entrega.

## Mapa de origem e limites

Inspeção read-only do checkout `/Users/user/MRA PROJECT/medresumo_academy`, SHA `9a43be4cca9148e3830aa635342ef47ff3433699` (03/08/2026), branch `agent/auth-rate-limit-hardening`, com edições alheias preservadas. Não prova runtime de novembro.

- Resumos: `library_documents`/`documents.id`, relação `content.document_id` era hipótese de integração; **não é fonte da categoria Resumos após a decisão de 03/11/2026**. Não exportar `ai_generated_resumos` pessoal.
- Vídeos: `course_classes` + `courses`; publicação depende de ambos. Aula herda macro do curso, sem tema próprio nesse snapshot.
- Questões: `questions`, `generation_batches`; revisão → `pending_authorization`, autorização → `approved`. Não exportar conteúdo/gabarito.
- Flashcards: `flashcards` + `flashcard_decks`; `approved` sozinho inclui conteúdo pessoal. Exigir deck/escopo elegível; geração pode publicar sem revisão humana.
- Fábrica externa de flashcards/questões: contrato atual ainda não verificado. O endpoint antigo de flashcards encontrado está pausado; não foi acionado.

Referências: `lib/types/database.ts`, `app/resumos/actions.ts`, `app/videoaulas/actions.ts`, `app/flashcards/actions.ts`, `lib/factory/batch-runner.ts`, `app/admin/fabrica-questoes/actions/review.ts`, migrations `20260714200000_gps_payment_methods.sql` e `20260728190436_fabrica_authorize_count_guard.sql` no checkout citado. Task MRA #2372 registra o mapa e os gates.

## Validação local

`python3 scripts/test-resumos-planilha.py`, `node scripts/test-content-categories.mjs`, `node scripts/test-acervo.mjs`, `node scripts/test-acervo-db.mjs`, `npm run validate:clinical`, `npx tsc --noEmit --incremental false`, `npm run build`.

O teste de banco usa PostgreSQL **local descartável**, roles e dados sintéticos, sem credenciais externas. O servidor `scripts/serve-acervo-fixtures.mjs` é somente fixture de interface, não adaptador MRA nem teste de Supabase real. Para browser local, use URL pública Supabase `http://127.0.0.1:55492`, chaves literais `fixture`, Next em `127.0.0.1:3086`; login sintético `fixture@example.invalid`. Não executar com `.env` de produção nem promover o build de fixture.
