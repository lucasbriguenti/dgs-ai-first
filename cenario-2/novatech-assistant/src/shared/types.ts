export interface QueryHistoryTurn {
  content: string;
  role: "user" | "assistant";
}

export interface QueryRequest {
  conversation_history?: QueryHistoryTurn[];
  question: string;
  top_k?: number;
}

export interface SourceDocument {
  content: string;
  id: string;
  score?: number;
  title: string;
  uri?: string;
  vigencia?: string;
}

export interface QueryResponse {
  answer: string;
  source_document: SourceDocument;
}

export interface ErrorResponse {
  code: string;
  error: string;
}