import type { HttpResponseInit } from "@azure/functions";
import { InternalServerError, type AppError } from "../../shared/errors.js";
import type { ErrorResponse, QueryResponse } from "../../shared/types.js";
import { errorResponseSchema } from "./validator.js";

export function toSuccessResponse(response: QueryResponse): HttpResponseInit {
  return {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    jsonBody: response,
    status: 200,
  };
}

export function toErrorResponse(error: AppError): HttpResponseInit {
  const body: ErrorResponse = {
    code: error.code,
    error: error.message,
  };

  const parsed = errorResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new InternalServerError("Failed to build error response");
  }

  return {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    jsonBody: body,
    status: error.statusCode,
  };
}