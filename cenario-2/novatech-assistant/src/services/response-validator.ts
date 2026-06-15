import { z } from "zod";

export const completionResultSchema = z
  .object({
    answer: z.string().trim().min(1),
  })
  .strict();

export type CompletionResult = z.infer<typeof completionResultSchema>;

export function validateCompletionResult(value: unknown): CompletionResult {
  return completionResultSchema.parse(value);
}