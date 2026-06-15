import { logger } from "../shared/logger.js";

export type CompletionResult = {
  answer: string;
};

export async function completeAnswer(prompt: string): Promise<CompletionResult> {
  const startedAt = Date.now();
  logger.info({ promptLength: prompt.length }, "completion started");

  const result: CompletionResult = {
    answer: "Resposta indisponivel no ponto de extensao RAG.",
  };

  logger.info(
    {
      durationMs: Date.now() - startedAt,
    },
    "completion completed",
  );

  return result;
}