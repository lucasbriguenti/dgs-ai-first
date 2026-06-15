import type { QueryResponse } from "../../src/shared/types.js";

export const happyPathResponse: QueryResponse = {
  answer: "Resposta final sobre frete especial.",
  source_document: {
    content: "Versao vigente do procedimento de frete especial.",
    id: "doc-new",
    score: 0.98,
    title: "PROC-042 Frete Especial",
    uri: "https://novatech.local/docs/proc-042",
    vigencia: "2026-01-01",
  },
};

export const invalidJsonErrorResponse = {
  code: "VALIDATION_ERROR",
  error: "Request body must be valid JSON",
};

export const missingQuestionErrorResponse = {
  code: "VALIDATION_ERROR",
  error: "Request body must contain a non-empty question",
};