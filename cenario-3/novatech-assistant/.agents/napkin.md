# Napkin Runbook

## Regras de Curadoria

- Repriorize em toda leitura.
- Mantenha apenas notas recorrentes e de alto valor.
- Máximo de 10 itens por categoria.
- Cada item inclui data + "Faça em vez disso".

## Execução e Validação

1. **[2026-06-15] Endpoint do query deve validar entrada e saída com Zod**
   Faça em vez disso: valide o body antes de processar e valide o payload final antes de responder.

## Logging e Erros

1. **[2026-06-15] Não usar `console.*` em handlers**
   Faça em vez disso: use a instância `pino` exportada em `src/shared/logger.ts` para logs estruturados.

## Guardrails de Domínio

1. **[2026-06-15] `source_document` é obrigatório em toda resposta do assistente**
   Faça em vez disso: inclua sempre um objeto `source_document`, inclusive em fallback e erro funcional.

## Testes e Mocks

1. **[2026-06-15] `@azure/functions` precisa ser mockado antes de importar handlers**
   Faça em vez disso: hoiste o mock de `app.http` e importe o handler só depois dos mocks para evitar registros reais no boot.

2. **[2026-06-15] Dados de teste do query devem viver em fixtures compartilhadas**
   Faça em vez disso: coloque queries, chunks e respostas esperadas em `tests/fixtures/` e reutilize entre testes.
