import type {
  Advertisement,
  CreativeAnalysis,
  RankedAd,
} from "../schemas/advertisement.schema.js";
import { RankedAdSchema } from "../schemas/advertisement.schema.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "tool:validateAndRankAds" });

export type ValidateAndRankInput = {
  ads: Advertisement[];
  analyses: CreativeAnalysis[];
};

export type ValidateAndRankResult = {
  rankedAds: RankedAd[];
  duplicatesRemoved: number;
  warnings: string[];
};

function dedupeKey(ad: Advertisement): string {
  return [
    ad.id,
    ad.advertiser ?? "",
    (ad.bodyText ?? ad.headline ?? "").slice(0, 120).toLowerCase(),
  ].join("|");
}

/**
 * Transparent ranking signals (MVP):
 * - has body/headline text
 * - has source URL
 * - has CTA
 * - has dates (activity window)
 * - analysis confidence
 *
 * Does NOT claim profitability, reach, or ROI.
 */
export function scoreAd(
  ad: Advertisement,
  analysis: CreativeAnalysis | undefined,
): { score: number; explanation: string[]; warnings: string[] } {
  let score = 0;
  const explanation: string[] = [];
  const warnings: string[] = [];

  if (ad.bodyText || ad.headline) {
    score += 25;
    explanation.push("+25 text available");
  } else {
    warnings.push("Missing ad text");
  }

  if (ad.sourceUrl) {
    score += 20;
    explanation.push("+20 source URL present");
  } else {
    warnings.push("Missing source URL");
  }

  if (ad.cta) {
    score += 15;
    explanation.push("+15 CTA present");
  }

  if (ad.startDate) {
    score += 15;
    explanation.push("+15 start date present");
  }

  if (analysis?.hook || analysis?.offer) {
    score += 15;
    explanation.push("+15 creative analysis extracted hook/offer");
  }

  if (analysis?.confidence === "high") {
    score += 10;
    explanation.push("+10 high analysis confidence");
  } else if (analysis?.confidence === "medium") {
    score += 5;
    explanation.push("+5 medium analysis confidence");
  } else if (analysis) {
    explanation.push("+0 low analysis confidence");
  } else {
    warnings.push("No creative analysis");
  }

  return { score: Math.min(100, score), explanation, warnings };
}

/**
 * Tool: validateAndRankAds
 * Deterministic validation, deduplication, and ranking (no LLM).
 */
export function validateAndRankAds(
  input: ValidateAndRankInput,
): ValidateAndRankResult {
  const analysisById = new Map(input.analyses.map((a) => [a.adId, a]));
  const seen = new Set<string>();
  const rankedAds: RankedAd[] = [];
  const warnings: string[] = [];
  let duplicatesRemoved = 0;

  for (const ad of input.ads) {
    const key = dedupeKey(ad);
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);

    const analysis = analysisById.get(ad.id);
    const { score, explanation, warnings: adWarnings } = scoreAd(ad, analysis);

    rankedAds.push(
      RankedAdSchema.parse({
        ad,
        analysis: analysis ?? null,
        score,
        scoreExplanation: explanation,
        warnings: adWarnings,
      }),
    );
  }

  rankedAds.sort((a, b) => b.score - a.score);

  if (duplicatesRemoved > 0) {
    warnings.push(`Removed ${duplicatesRemoved} duplicate ad(s)`);
  }

  log.info(
    { inputCount: input.ads.length, ranked: rankedAds.length, duplicatesRemoved },
    "validateAndRankAds done",
  );

  return { rankedAds, duplicatesRemoved, warnings };
}
