import type { RetrievalChunk } from "../../src/services/search.js";

export const happyPathChunks: RetrievalChunk[] = [
  {
    content: "Versao antiga do procedimento de frete especial.",
    id: "doc-old",
    score: 0.82,
    title: "PROC-042 Frete Especial",
    vigencia: "2025-01-01",
  },
  {
    content: "Versao vigente do procedimento de frete especial.",
    id: "doc-new",
    score: 0.98,
    title: "PROC-042 Frete Especial",
    uri: "https://novatech.local/docs/proc-042",
    vigencia: "2026-01-01",
  },
];