import { z } from "zod";
import { RankedAdSchema } from "./advertisement.schema.js";
import { InsightsSchema } from "./insights.schema.js";
import { ResearchPlanSchema, ResearchRequestSchema } from "./research.schema.js";

export const AgentOutputSchema = z.object({
  runId: z.string(),
  status: z.enum(["completed", "partial", "failed"]),
  request: ResearchRequestSchema,
  plan: ResearchPlanSchema.nullable(),
  searchQueriesUsed: z.array(z.string()),
  adsFound: z.number().int().nonnegative(),
  adsAnalyzed: z.number().int().nonnegative(),
  rankedAds: z.array(RankedAdSchema),
  insights: InsightsSchema,
  limitations: z.array(z.string()),
  warnings: z.array(z.string()),
  humanSummary: z.string(),
  traceSummary: z.object({
    iterations: z.number().int().nonnegative(),
    toolCalls: z.array(
      z.object({
        tool: z.string(),
        status: z.enum(["ok", "error", "skipped"]),
        durationMs: z.number().nonnegative(),
        detail: z.string().optional(),
      }),
    ),
    decision: z.string(),
  }),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;
