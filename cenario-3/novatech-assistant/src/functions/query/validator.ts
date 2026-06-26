import { z } from "zod";
import type { ErrorResponse, QueryRequest, QueryResponse } from "../../shared/types.js";

export const VALID_DOCUMENTS = [
  "POL-001",
  "PROC-042",
  "PROC-042-v2",
  "SLA-2024",
  "FAQ-Atendimento",
] as const;

export type ValidDocument = (typeof VALID_DOCUMENTS)[number];

export const AssistantResponseSchema = z
  .object({
    answer: z.string().trim().min(1),
    confidence_score: z.number().min(0).max(1),
    source_document: z.string().trim().min(1),
  })
  .strict();

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

export const historyTurnSchema = z
  .object({
    content: z.string().trim().min(1),
    role: z.enum(["user", "assistant"]),
  })
  .strict();

export const queryRequestSchema = z
  .object({
    conversation_history: z.array(historyTurnSchema).max(3).optional(),
    question: z.string().trim().min(1),
    top_k: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const queryResponseSchema = z
  .object({
    answer: z.string().trim().min(1),
    source_document: z
      .object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
        score: z.number().finite().optional(),
        title: z.string().trim().min(1),
        uri: z.string().url().optional(),
        vigencia: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const errorResponseSchema = z
  .object({
    code: z.string().trim().min(1),
    error: z.string().trim().min(1),
  })
  .strict();

export type {
  ErrorResponse,
  QueryRequest,
  QueryResponse,
};