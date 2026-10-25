import type { Advertisement } from "../schemas/advertisement.schema.js";
import type { CreativeAnalysis } from "../schemas/advertisement.schema.js";
import { CreativeAnalysisSchema } from "../schemas/advertisement.schema.js";
import { createLlmProvider } from "../integrations/llm.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "tool:analyzeCreatives" });

export type AnalyzeCreativesResult = {
  analyses: CreativeAnalysis[];
  provider: string;
};

/**
 * Tool: analyzeCreatives
 * Uses LLM provider to extract hooks, offers, CTAs, and related signals.
 */
export async function analyzeCreatives(
  ads: Advertisement[],
): Promise<AnalyzeCreativesResult> {
  const provider = createLlmProvider();
  log.info(
    { provider: provider.name, adCount: ads.length },
    "analyzeCreatives start",
  );

  if (ads.length === 0) {
    return { analyses: [], provider: provider.name };
  }

  const raw = await provider.analyzeCreatives(ads);
  const analyses = CreativeAnalysisSchema.array().parse(raw);

  log.info(
    { provider: provider.name, analyzed: analyses.length },
    "analyzeCreatives done",
  );

  return { analyses, provider: provider.name };
}
