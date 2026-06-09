import {
    app,
    type HttpRequest,
    type HttpResponseInit,
    type InvocationContext,
} from "@azure/functions";

import { executeQuery } from "../../services/query-service";
import { InternalError, ValidationError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import type { QueryRequest } from "../../shared/types";
import { queryRequestSchema, queryResponseSchema } from "./validator";

function badRequestResponse(error: string): HttpResponseInit {
    return {
        status: 400,
        jsonBody: {
            error,
            code: "VALIDATION_ERROR",
        },
    };
}

function internalErrorResponse(error: InternalError): HttpResponseInit {
    return {
        status: 500,
        jsonBody: {
            error: error.message,
            code: "INTERNAL_ERROR",
        },
    };
}

export async function queryHandler(
    request: HttpRequest,
    context: InvocationContext,
): Promise<HttpResponseInit> {
    const requestId = context.invocationId;
    const requestLogger = logger.child({ requestId });

    let parsedBody: unknown;

    try {
        parsedBody = await request.json();
    } catch {
        requestLogger.warn({ requestId }, "invalid_json_body");
        return badRequestResponse("Invalid JSON body");
    }

    const parsedInput = queryRequestSchema.safeParse(parsedBody);

    if (!parsedInput.success) {
        const validationError = new ValidationError(parsedInput.error.flatten());
        requestLogger.warn(
            {
                requestId,
                error: validationError.details,
            },
            "validation_failed",
        );

        return badRequestResponse("Invalid request payload");
    }

    const input = parsedInput.data as QueryRequest;
    const serviceResponse = await executeQuery(input, requestLogger);

    const parsedOutput = queryResponseSchema.safeParse(serviceResponse);

    if (!parsedOutput.success) {
        const internalError = new InternalError("Internal Server Error");
        requestLogger.error(
            {
                requestId,
                error: parsedOutput.error.flatten(),
            },
            "output_validation_failed",
        );

        return internalErrorResponse(internalError);
    }

    requestLogger.info(
        {
            requestId,
            sourceDocument: parsedOutput.data.source_document,
        },
        "query_completed",
    );

    return {
        status: 200,
        jsonBody: parsedOutput.data,
    };
}

app.http("query", {
    methods: ["POST"],
    authLevel: "function",
    route: "query",
    handler: queryHandler,
});
