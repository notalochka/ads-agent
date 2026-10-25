import { z } from "zod";

/** High-level research stages shown in the UI. */
export const ResearchStageSchema = z.enum([
  "plan",
  "search",
  "refine",
  "analyze",
  "rank",
  "synthesize",
  "report",
  "done",
  "error",
]);

export type ResearchStage = z.infer<typeof ResearchStageSchema>;

export const ResearchProgressEventSchema = z.object({
  type: z.literal("progress"),
  stage: ResearchStageSchema,
  message: z.string(),
  detail: z.string().optional(),
  iteration: z.number().int().positive().optional(),
  adsFound: z.number().int().nonnegative().optional(),
  at: z.string(),
});

export type ResearchProgressEvent = z.infer<typeof ResearchProgressEventSchema>;

export type ProgressReporter = (event: Omit<ResearchProgressEvent, "type" | "at"> & {
  at?: string;
}) => void;

export function emitProgress(
  onProgress: ProgressReporter | undefined,
  event: Omit<ResearchProgressEvent, "type" | "at"> & { at?: string },
): void {
  if (!onProgress) return;
  onProgress(event);
}
