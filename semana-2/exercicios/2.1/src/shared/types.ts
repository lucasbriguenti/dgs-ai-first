import { z } from "zod";

import {
    queryRequestSchema,
    queryResponseSchema,
} from "../functions/query/validator";

export type QueryRequest = z.infer<typeof queryRequestSchema>;
export type QueryResponse = z.infer<typeof queryResponseSchema>;
