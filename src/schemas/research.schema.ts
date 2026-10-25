import { z } from "zod";

export const ResearchRequestSchema = z.object({
  niche: z.string().min(2).max(200),
  country: z.string().min(2).max(80),
  competitors: z.array(z.string().min(1)).max(20).default([]),
  keywords: z.array(z.string().min(1)).max(20).optional(),
  maxAds: z.number().int().min(1).max(100).optional(),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

export const ResearchPlanSchema = z.object({
  niche: z.string(),
  country: z.string(),
  searchQueries: z.array(z.string()).min(1),
  competitorTargets: z.array(z.string()),
  rationale: z.string(),
});

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
