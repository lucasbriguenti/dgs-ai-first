# Copilot — Rodada 1 (Prompt 4): testes Vitest do endpoint `POST /api/query`

> **Evidência de teste — rodada 1.** Testes gerados a partir da mesma skill `skills/domain/azure-functions-endpoint.md` (v1), para o endpoint gerado no Prompt 3 (`copilot-rodada-1.md`).
> Execução **simulada do GitHub Copilot** (role-play): comportamento realista — cobre os 3 casos pedidos com assertions específicas e isolamento, mas mantém desvios típicos (auditados no Prompt 5, corrigidos na v2). Gaps **não** anotados no código de propósito.

**Prompt usado:** "Com base na mesma skill `azure-functions-endpoint`, gere testes em Vitest… Cobertura mínima: caso feliz, input inválido, falha interna controlada."

---

## 1) Arquivo de teste gerado

### `tests/unit/functions/query/handler.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpRequest, InvocationContext } from "@azure/functions";

// Isolamento das dependências externas (services com I/O / LLM)
vi.mock("../../../../src/services/search.js", () => ({
  retrieveTopChunks: vi.fn(),
  selectSourceDocument: vi.fn(),
}));
vi.mock("../../../../src/services/prompt-builder.js", () => ({
  buildRagPrompt: vi.fn(() => "PROMPT"),
}));
vi.mock("../../../../src/services/completion.js", () => ({
  completeAnswer: vi.fn(),
}));
vi.mock("../../../../src/services/response-validator.js", () => ({
  validateCompletionResult: vi.fn((value) => value),
}));

import { queryHandler } from "../../../../src/functions/query/handler.js";
import { retrieveTopChunks, selectSourceDocument } from "../../../../src/services/search.js";
import { completeAnswer } from "../../../../src/services/completion.js";

const retrieveTopChunksMock = vi.mocked(retrieveTopChunks);
const selectSourceDocumentMock = vi.mocked(selectSourceDocument);
const completeAnswerMock = vi.mocked(completeAnswer);

function createRequest(body: unknown): HttpRequest {
  return {
    method: "POST",
    url: "http://localhost/api/query",
    json: async () => body,
  } as unknown as HttpRequest;
}

function createContext(): InvocationContext {
  return { invocationId: "test-invocation" } as unknown as InvocationContext;
}

describe("queryHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with answer and source_document when the question is valid", async () => {
    // arrange
    const chunk = {
      id: "PROC-042",
      title: "Frete Especial",
      content: "Frete especial aplica-se a cargas acima de 500kg.",
      score: 0.91,
    };
    retrieveTopChunksMock.mockResolvedValue([chunk] as any);
    selectSourceDocumentMock.mockReturnValue(chunk);
    completeAnswerMock.mockResolvedValue({
      answer: "Frete especial é o frete para cargas acima de 500kg.",
    });

    // act
    const res = await queryHandler(
      createRequest({ question: "O que é frete especial?" }),
      createContext(),
    );

    // assert
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({
      answer: "Frete especial é o frete para cargas acima de 500kg.",
      source_document: chunk,
    });
  });

  it("should return 400 when the question is missing", async () => {
    const res = await queryHandler(createRequest({}), createContext());

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({
      code: "VALIDATION_ERROR",
      error: expect.any(String),
    });
  });

  it("should return 500 when the completion service throws", async () => {
    retrieveTopChunksMock.mockResolvedValue([
      { id: "x", title: "t", content: "c", score: 1 },
    ] as any);
    selectSourceDocumentMock.mockReturnValue({ id: "x", title: "t", content: "c", score: 1 });
    completeAnswerMock.mockRejectedValue(new Error("LLM timeout"));

    const res = await queryHandler(createRequest({ question: "qualquer pergunta" }), createContext());

    expect(res.status).toBe(500);
  });
});
```

---

## 2) Mapeamento "Regra da skill → evidência no teste" (auto-relato do Copilot)

| Regra da skill (§) | Evidência no teste |
|---|---|
| Nomes descritivos em inglês `it('should … when …')` | os três `it("should … when …")` |
| Estrutura arrange/act/assert | blocos comentados `// arrange / act / assert` no happy path |
| Assertions específicas (não `toBeDefined`/`toBeTruthy`) | `expect(res.status).toBe(200/400/500)`, `expect(res.jsonBody).toEqual({...})` |
| Isolamento de dependências externas | `vi.mock(...)` de `search`, `prompt-builder`, `completion`, `response-validator` |
| Caso feliz | `should return 200 with answer and source_document …` |
| Input inválido | `should return 400 when the question is missing` |
| Falha interna controlada | `should return 500 when the completion service throws` |
| `source_document` na resposta (§4.4) | `toEqual({ answer, source_document })` no happy path |
| Erro padronizado `{ error, code }` (§4.6) | `toEqual({ code: "VALIDATION_ERROR", error: ... })` no teste 400 |
| `beforeEach` isolando estado | `vi.clearAllMocks()` |

---

## Notas da execução (Copilot)

- 3 cenários exigidos cobertos (happy / input inválido / falha interna), com `vi.mock` isolando todo I/O externo.
- Helpers `createRequest`/`createContext` usam `as unknown as Tipo` (exceção de mock permitida pelo AGENTS.md).
- Pontos que o agente **não** cobriu sozinho (ficam para a auditoria do Prompt 5):
  - Sem teste para **recuperação vazia / "não encontrado"** (VC-04) — caminho em que não há `source_document`.
  - Sem teste de **violação de budget** (`top_k: 6` ou histórico com 4 turnos) — §9 V8.
  - Dados de teste **inline** no arquivo, não importados de `tests/fixtures/` (regra do AGENTS.md).
  - Teste 500 afirma só o `status`, não o corpo `{ code: "INTERNAL_SERVER_ERROR" }`.
  - `as any` nos dados de mock (`mockResolvedValue([...] as any)`) — fora da exceção sancionada (que é para `HttpRequest`/`InvocationContext`).
