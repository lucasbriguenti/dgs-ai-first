import { z } from "zod";
import {
  AssistantResponseSchema,
  type AssistantResponse,
  VALID_DOCUMENTS,
} from "../functions/query/validator.js";
import { logger } from "../shared/logger.js";

export type SafeResponse = AssistantResponse;

export type ValidationResult =
  | { valid: true; response: AssistantResponse }
  | { valid: false; reason: string; safeResponse: SafeResponse };

export const SAFE_RESPONSE_GENERIC: SafeResponse = {
  answer: "Não foi possível encontrar uma resposta com fonte verificada. Por favor, consulte o supervisor.",
  confidence_score: 0,
  source_document: "none",
};

export const SAFE_RESPONSE_HAZMAT: SafeResponse = {
  answer: "Devoluções de carga perigosa requerem tratamento especial. Acione o ramal 4500 (Gestão de Riscos).",
  confidence_score: 1,
  source_document: "POL-001",
};

const HAZMAT_PATTERN = /\bcargas?\s+perigos[ao]s?\b/u;
const RETURN_PATTERN = /\bdevolu(?:cao|coes)\b|\bdevolver\b|\bdevolvid\w*\b/u;
const NEGATIVE_PHRASES = [
  "nao e possivel",
  "nao pode",
  "nao e elegivel",
  "nao sao elegiveis",
  "nao pode ser devolvid",
];
const LEGACY_COMPLETION_SCHEMA = z
  .object({
    answer: z.string().trim().min(1),
  })
  .strict();

function normalizeForMatch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractSourceDocument(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawSourceDocument = value.source_document;
  if (typeof rawSourceDocument !== "string") {
    return undefined;
  }

  return rawSourceDocument;
}

function isSourceInAllowlist(sourceDocument: string): boolean {
  return VALID_DOCUMENTS.some((validDocument) => validDocument === sourceDocument);
}

function violatesHazmatReturnGuardrail(answer: string): boolean {
  const normalizedAnswer = normalizeForMatch(answer);
  const hasHazmatReference = HAZMAT_PATTERN.test(normalizedAnswer);
  const hasReturnReference = RETURN_PATTERN.test(normalizedAnswer);
  const hasBlockingNegative = NEGATIVE_PHRASES.some((phrase) =>
    normalizedAnswer.includes(phrase),
  );

  return hasHazmatReference && hasReturnReference && !hasBlockingNegative;
}

function logValidationFailure(
  reason: string,
  sourceDocument?: string,
  guardrail?: string,
): void {
  logger.error(
    {
      event: "response_validation_failed",
      guardrail,
      reason,
      source_document: sourceDocument,
    },
    "response validation failed",
  );
}

export function validateResponse(rawResponse: unknown): ValidationResult {
  const parsedResponse = AssistantResponseSchema.safeParse(rawResponse);
  if (!parsedResponse.success) {
    const sourceDocument = extractSourceDocument(rawResponse);
    if (sourceDocument === undefined || sourceDocument.trim().length === 0) {
      logValidationFailure("source_document_missing", sourceDocument, "D1_source_document_required");
    }

    logValidationFailure("schema_invalid", sourceDocument);
    return {
      valid: false,
      reason: "schema_invalid",
      safeResponse: SAFE_RESPONSE_GENERIC,
    };
  }

  const response = parsedResponse.data;
  if (!isSourceInAllowlist(response.source_document)) {
    logValidationFailure("source_not_in_allowlist", response.source_document);
    return {
      valid: false,
      reason: "source_not_in_allowlist",
      safeResponse: SAFE_RESPONSE_GENERIC,
    };
  }

  if (violatesHazmatReturnGuardrail(response.answer)) {
    logValidationFailure(
      "guardrail_hazmat_return",
      response.source_document,
      "D2_hazmat_return",
    );
    return {
      valid: false,
      reason: "guardrail_hazmat_return",
      safeResponse: SAFE_RESPONSE_HAZMAT,
    };
  }

  return {
    valid: true,
    response,
  };
}

export function validateCompletionResult(rawResponse: unknown): AssistantResponse {
  const legacyCompletion = LEGACY_COMPLETION_SCHEMA.safeParse(rawResponse);
  if (legacyCompletion.success) {
    return {
      answer: legacyCompletion.data.answer,
      confidence_score: 0,
      source_document: "none",
    };
  }

  const validation = validateResponse(rawResponse);
  if (validation.valid) {
    return validation.response;
  }

  return validation.safeResponse;
}