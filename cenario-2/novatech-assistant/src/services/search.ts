import { logger } from "../shared/logger.js";

export type RetrievalChunk = {
  content: string;
  id: string;
  score?: number;
  title: string;
  uri?: string;
  vigencia?: string;
};

export function selectSourceDocument(
  chunks: readonly RetrievalChunk[],
  question: string,
): RetrievalChunk {
  const sortedChunks = [...chunks].sort((left, right) => {
    const leftVigencia = left.vigencia ?? "";
    const rightVigencia = right.vigencia ?? "";
    return rightVigencia.localeCompare(leftVigencia);
  });

  const selectedChunk = sortedChunks[0];
  if (selectedChunk !== undefined) {
    return selectedChunk;
  }

  return {
    content: `Ponto de extensao RAG para a pergunta: ${question}`,
    id: "rag-placeholder",
    title: "Ponto de extensao RAG",
    vigencia: "pending",
  };
}

export async function retrieveTopChunks(
  question: string,
  topK: number,
): Promise<RetrievalChunk[]> {
  const startedAt = Date.now();
  logger.info({ questionLength: question.length, topK }, "retrieval started");

  const chunks: RetrievalChunk[] = [];

  logger.info(
    {
      chunkCount: chunks.length,
      durationMs: Date.now() - startedAt,
    },
    "retrieval completed",
  );

  return chunks.slice(0, topK);
}