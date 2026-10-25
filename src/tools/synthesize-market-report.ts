import type { RankedAd } from "../schemas/advertisement.schema.js";
import type { MarketReport, MarketStats } from "../schemas/insights.schema.js";
import { MarketReportSchema } from "../schemas/insights.schema.js";
import { createLlmProvider } from "../integrations/llm.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "tool:synthesizeMarketReport" });

export type SynthesizeMarketReportInput = {
  niche: string;
  country: string;
  marketStats: MarketStats;
  rankedAds: RankedAd[];
};

export type SynthesizeMarketReportResult = {
  report: MarketReport | null;
  provider: string;
  warning?: string;
};

/**
 * Tool: synthesizeMarketReport
 * One LLM call that turns deterministic stats + ad excerpts into a narrative market report.
 */
export async function synthesizeMarketReport(
  input: SynthesizeMarketReportInput,
): Promise<SynthesizeMarketReportResult> {
  const provider = createLlmProvider();
  log.info(
    {
      provider: provider.name,
      ads: input.rankedAds.length,
      competitors: input.marketStats.totals.competitors,
    },
    "synthesizeMarketReport start",
  );

  if (input.rankedAds.length === 0) {
    return { report: null, provider: provider.name };
  }

  try {
    const raw = await provider.synthesizeMarketReport({
      niche: input.niche,
      country: input.country,
      marketStats: input.marketStats,
      rankedAds: input.rankedAds,
    });
    const report = MarketReportSchema.parse(raw);
    log.info({ provider: provider.name }, "synthesizeMarketReport done");
    return { report, provider: provider.name };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Market synthesis failed";
    log.warn({ err: message }, "synthesizeMarketReport failed");
    return {
      report: null,
      provider: provider.name,
      warning: `Market synthesis skipped: ${message}`,
    };
  }
}
