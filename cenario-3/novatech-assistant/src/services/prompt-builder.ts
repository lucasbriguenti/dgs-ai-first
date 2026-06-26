import type { QueryHistoryTurn } from "../shared/types.js";
import type { RetrievalChunk } from "./search.js";

export function buildRagPrompt(
  question: string,
  chunks: readonly RetrievalChunk[],
  history: readonly QueryHistoryTurn[],
): string {
  const historyBlock = history.length > 0
    ? history
        .slice(0, 3)
        .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
        .join("\n")
    : "Sem historico recente.";

  const chunkBlock = chunks.length > 0
    ? chunks
        .slice(0, 5)
        .map((chunk, index) => {
          const vigencia = chunk.vigencia ? `Vigencia: ${chunk.vigencia}` : "Vigencia: nao informada";
          return [
            `${index + 1}. ${chunk.title} (${chunk.id})`,
            vigencia,
            chunk.content,
          ].join("\n");
        })
        .join("\n\n")
    : "Nenhum chunk recuperado ainda.";

  return [
    "Voce e o assistente NovaTech.",
    "Use apenas o contexto recuperado para responder.",
    `Historico recente:\n${historyBlock}`,
    `Pergunta:\n${question}`,
    `Contexto recuperado:\n${chunkBlock}`,
  ].join("\n\n");
}