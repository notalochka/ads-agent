import { z } from "zod";

export const CountShareSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
  pct: z.number().min(0).max(100),
});

export const CompetitorStatSchema = z.object({
  name: z.string(),
  ads: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  avgScore: z.number().min(0).max(100),
  longestDays: z.number().int().nonnegative().nullable(),
  videoPct: z.number().min(0).max(100),
});

export const MarketStatsSchema = z.object({
  totals: z.object({
    ads: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative(),
    competitors: z.number().int().nonnegative(),
    avgObservedDays: z.number().nullable(),
    withVideo: z.number().int().nonnegative(),
    withImage: z.number().int().nonnegative(),
    analyzedByAi: z.number().int().nonnegative(),
  }),
  formats: z.array(CountShareSchema),
  platforms: z.array(CountShareSchema),
  ctas: z.array(CountShareSchema),
  landings: z.array(
    z.object({
      domain: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  competitors: z.array(CompetitorStatSchema),
});

export type MarketStats = z.infer<typeof MarketStatsSchema>;

export const MarketReportSchema = z.object({
  executiveSummary: z.string(),
  topOffers: z.array(
    z.object({
      group: z.string(),
      who: z.array(z.string()),
      examples: z.array(z.string()),
    }),
  ),
  topHooks: z.array(
    z.object({
      hook: z.string(),
      type: z.string().nullable(),
      who: z.string().nullable(),
    }),
  ),
  angles: z.array(
    z.object({
      angle: z.string(),
      who: z.array(z.string()),
    }),
  ),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
  readyIdeas: z.array(z.string()),
  provider: z.string(),
  notes: z.array(z.string()).default([]),
});

export type MarketReport = z.infer<typeof MarketReportSchema>;

export const InsightsSchema = z.object({
  recurringHooks: z.array(z.string()),
  recurringOffers: z.array(z.string()),
  recurringCtas: z.array(z.string()),
  creativeAngles: z.array(z.string()),
  opportunitiesToTest: z.array(z.string()),
  marketStats: MarketStatsSchema.optional(),
  marketReport: MarketReportSchema.nullable().optional(),
});

export type Insights = z.infer<typeof InsightsSchema>;
