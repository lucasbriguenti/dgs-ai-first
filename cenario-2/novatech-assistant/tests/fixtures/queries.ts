import type { QueryRequest } from "../../src/shared/types.js";

export const happyPathQuery: QueryRequest = {
  conversation_history: [
    {
      content: "Preciso entender o frete especial.",
      role: "user",
    },
    {
      content: "Claro, vou consultar a base interna.",
      role: "assistant",
    },
  ],
  question: "Como trato frete especial?",
  top_k: 2,
};

export const missingQuestionQuery = {
  top_k: 2,
};

export const invalidJsonQuery = Symbol("invalid-json-query");