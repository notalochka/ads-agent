import { z } from "zod";

/** Normalized public advertisement record (facts only). */
export const AdvertisementSchema = z.object({
  id: z.string().min(1),
  advertiser: z.string().nullable(),
  headline: z.string().nullable(),
  bodyText: z.string().nullable(),
  cta: z.string().nullable(),
  imageUrl: z.union([z.string().url(), z.null()]),
  videoUrl: z.union([z.string().url(), z.null()]).default(null),
  landingUrl: z.union([z.string().url(), z.null()]),
  sourceUrl: z.union([z.string().url(), z.null()]),
  platform: z.string().nullable(),
  country: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.enum(["active", "inactive", "unknown"]).default("unknown"),
});

export type Advertisement = z.infer<typeof AdvertisementSchema>;

export const CreativeAnalysisSchema = z.object({
  adId: z.string(),
  hook: z.string().nullable(),
  offer: z.string().nullable(),
  cta: z.string().nullable(),
  creativeAngle: z.string().nullable(),
  persuasionTechnique: z.string().nullable(),
  targetAudienceSignals: z.array(z.string()).default([]),
  evidence: z.object({
    sourceUrl: z.string().nullable(),
    excerpt: z.string().nullable(),
  }),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  uncertaintyNotes: z.array(z.string()).default([]),
});

export type CreativeAnalysis = z.infer<typeof CreativeAnalysisSchema>;

export const RankedAdSchema = z.object({
  ad: AdvertisementSchema,
  analysis: CreativeAnalysisSchema.nullable(),
  score: z.number().min(0).max(100),
  scoreExplanation: z.array(z.string()),
  warnings: z.array(z.string()).default([]),
});

export type RankedAd = z.infer<typeof RankedAdSchema>;
