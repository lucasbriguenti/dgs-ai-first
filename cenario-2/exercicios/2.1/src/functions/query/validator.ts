import { z } from "zod";

export const queryRequestSchema = z.object({
    question: z.string().min(1, "question is required").max(2000),
    conversation: z.array(z.string().max(2000)).max(3).default([]),
});

export const queryResponseSchema = z.object({
    answer: z.string().min(1),
    source_document: z.string().min(1),
});
