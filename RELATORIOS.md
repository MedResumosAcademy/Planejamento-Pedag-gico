# Relatórios automáticos (semanal + mensal)

Disparo automático por email com **Resend**: relatório **semanal** todo sábado e **mensal** no dia 1 (últimos 30 dias). Mostra o que foi feito no período (gravações concluídas, revisões registradas, aulas gravadas, temas que avançaram) + o snapshot atual (progresso, previsão, disciplinas em risco, pendências).

## O que já está pronto no código
- `src/lib/reports.ts` — coleta os dados e monta o email HTML.
- `src/app/api/reports/[period]/route.ts` — rotas `/api/reports/weekly` e `/api/reports/monthly`.
- `src/lib/supabase/admin.ts` — leitura via service role (para o disparo agendado, sem sessão de usuário).
- `vercel.json` — agendamento (Vercel Cron).

Não precisa instalar nada novo.

## 1. Conta Resend
1. Crie conta em https://resend.com e gere uma **API Key**.
2. Para produção, verifique um **domínio** e use um remetente seu (ex.: `relatorios@seudominio.com`).
   Para testar rápido, dá para usar o remetente `onboarding@resend.dev` — mas nesse modo o Resend só entrega no email da sua própria conta.

## 2. Variáveis de ambiente
Adicione no `.env.local` (local) **e** no painel da Vercel (produção):

```
RESEND_API_KEY=re_xxxxxxxx
REPORT_FROM=Med2026 <relatorios@seudominio.com>     # opcional; padrão: onboarding@resend.dev
SUPABASE_SERVICE_ROLE_KEY=eyJ...                     # Supabase → Project Settings → API → service_role
REPORT_RECIPIENTS=voce@exemplo.com,outro@exemplo.com # opcional; se vazio, envia aos coordenadores com email
REPORT_SECRET=uma-senha-aleatoria-longa              # protege disparo manual / cron externo
CRON_SECRET=outra-senha-aleatoria-longa              # usada pelo Vercel Cron (enviada automaticamente)
```

> O `SUPABASE_SERVICE_ROLE_KEY` é secreto e só roda no servidor — nunca exponha no cliente.
> Destinatários: se `REPORT_RECIPIENTS` ficar vazio, o relatório vai para todos os **coordenadores** que tiverem email cadastrado.

## 3. Testar antes de agendar
Com as variáveis no `.env.local` e o `npm run dev` rodando:

- **Pré-visualizar** (gera o HTML, não envia):
  `http://localhost:3000/api/reports/weekly?preview=1&token=SEU_REPORT_SECRET`
- **Enviar de verdade** (manual):
  `http://localhost:3000/api/reports/weekly?token=SEU_REPORT_SECRET`
  (troque `weekly` por `monthly` para o mensal)

## 4. Publicar e agendar (recomendado: Vercel)
1. Suba o repositório no GitHub.
2. Importe o projeto na **Vercel** (https://vercel.com).
3. Em **Settings → Environment Variables**, adicione TODAS as variáveis (as `NEXT_PUBLIC_SUPABASE_*` que já existem + as novas acima).
4. Faça o deploy. A Vercel lê o `vercel.json` e cria os crons automaticamente.

Agendamento (em UTC; o Brasil é UTC−3):
- Semanal: `0 12 * * 6` → **todo sábado, 12:00 UTC (≈ 09:00 BRT)**
- Mensal: `0 12 1 * *` → **dia 1, 12:00 UTC**

Para mudar o horário, edite `vercel.json`. O Vercel Cron já envia o `CRON_SECRET` como autorização — só garanta que essa variável está setada na Vercel.

## Alternativa sem Vercel (cron externo)
Se hospedar em outro lugar, use um serviço como **cron-job.org** chamando:
`https://SEU-APP/api/reports/weekly?token=SEU_REPORT_SECRET`  (sábado)
`https://SEU-APP/api/reports/monthly?token=SEU_REPORT_SECRET` (dia 1)

## Observações
- **Gravações** e **revisões** no relatório são registros reais (têm data).
- **Velocidade/previsão** e "temas que avançaram" são estimativas baseadas em `updated_at` (o banco não guarda histórico por etapa). Para precisão total, dá para adicionar depois um log de eventos por etapa.
- O relatório de revisões depende da tabela `tema_revisoes` (rode o `data/migration-versionamento.sql` se ainda não rodou); sem ela, o relatório envia normalmente, só sem a seção de revisões.
