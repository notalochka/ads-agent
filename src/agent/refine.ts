import type { Advertisement } from "../schemas/advertisement.schema.js";
import type { ResearchRequest } from "../schemas/research.schema.js";

export type EvidenceAssessment = {
  sufficient: boolean;
  reasons: string[];
  adsCount: number;
  withTextCount: number;
  relevantCount: number;
};

export type RefineDecision = {
  shouldRefine: boolean;
  reason: string;
  nextQueries: string[];
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-zа-яёіїєґ0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function adHasText(ad: Advertisement): boolean {
  return Boolean(ad.bodyText?.trim() || ad.headline?.trim());
}

function adLooksRelevant(ad: Advertisement, niche: string): boolean {
  const tokens = tokenize(niche);
  if (tokens.length === 0) return true;
  const haystack = [ad.advertiser, ad.headline, ad.bodyText, ad.cta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

/**
 * Deterministic check: do we have enough usable evidence to stop searching?
 */
export function evaluateEvidence(
  ads: Advertisement[],
  request: ResearchRequest,
  options: { minAds?: number } = {},
): EvidenceAssessment {
  const minAds = options.minAds ?? 3;
  const withTextCount = ads.filter(adHasText).length;
  const nicheTokens = tokenize(request.niche);
  const relevantCount = ads.filter((ad) =>
    adLooksRelevant(ad, request.niche),
  ).length;

  const reasons: string[] = [];
  const hasEnoughAds = ads.length >= minAds;
  const hasText = withTextCount > 0;

  if (!hasEnoughAds) {
    reasons.push(`Only ${ads.length} ads (min ${minAds})`);
  }
  if (ads.length > 0 && !hasText) {
    reasons.push("No ads contain headline/body text");
  }
  if (hasEnoughAds && hasText && nicheTokens.length > 0 && relevantCount === 0) {
    reasons.push(
      `No ads matched niche tokens from "${request.niche}" (weak relevance check)`,
    );
  }

  // Sufficient when we have volume + text. Relevance miss alone does NOT block stop
  // if we already have enough ads – but it will still be logged for transparency.
  // Refine triggers mainly on low count / no text; relevance miss triggers refine
  // only when we still have iterations and unused queries (see decideRefine).
  const sufficient = hasEnoughAds && hasText;

  if (sufficient && reasons.length === 0) {
    reasons.push(
      `Evidence OK: ${ads.length} ads, ${withTextCount} with text, ${relevantCount} niche-related`,
    );
  }

  return {
    sufficient,
    reasons:
      reasons.length > 0
        ? reasons
        : ["Evidence below configured thresholds"],
    adsCount: ads.length,
    withTextCount,
    relevantCount,
  };
}

/**
 * Build alternate search queries not already tried.
 */
export function buildRefinedQueries(params: {
  request: ResearchRequest;
  usedQueries: string[];
  iteration: number;
}): string[] {
  const { request, usedQueries, iteration } = params;
  const used = new Set(usedQueries.map((q) => q.trim().toLowerCase()));
  const candidates: string[] = [];

  const niche = request.niche.trim();
  const country = request.country.trim();
  const keywords = request.keywords ?? [];

  if (iteration === 1) {
    candidates.push(niche);
    for (const kw of keywords) {
      candidates.push(kw.trim());
      candidates.push(`${kw.trim()} ${country}`.trim());
    }
    for (const competitor of request.competitors) {
      candidates.push(competitor.trim());
    }
  } else {
    candidates.push(`${niche} ads`);
    candidates.push(`${niche} offer`);
    for (const kw of keywords) {
      candidates.push(`${kw.trim()} course`);
      candidates.push(`${kw.trim()} online`);
    }
    if (request.competitors[0]) {
      candidates.push(`${request.competitors[0]} ${niche}`);
    }
  }

  return Array.from(
    new Set(
      candidates
        .map((q) => q.trim())
        .filter((q) => q.length >= 2)
        .filter((q) => !used.has(q.toLowerCase())),
    ),
  ).slice(0, 5);
}

export function decideRefine(params: {
  assessment: EvidenceAssessment;
  request: ResearchRequest;
  usedQueries: string[];
  iteration: number;
  maxIterations: number;
}): RefineDecision {
  const { assessment, request, usedQueries, iteration, maxIterations } =
    params;

  if (assessment.sufficient) {
    return {
      shouldRefine: false,
      reason: assessment.reasons[0] ?? "Evidence sufficient",
      nextQueries: [],
    };
  }

  if (iteration >= maxIterations) {
    return {
      shouldRefine: false,
      reason: `Max iterations reached (${maxIterations}): ${assessment.reasons.join("; ")}`,
      nextQueries: [],
    };
  }

  const nextQueries = buildRefinedQueries({
    request,
    usedQueries,
    iteration,
  });

  if (nextQueries.length === 0) {
    return {
      shouldRefine: false,
      reason: `No unused refined queries left: ${assessment.reasons.join("; ")}`,
      nextQueries: [],
    };
  }

  return {
    shouldRefine: true,
    reason: `Refining search (${assessment.reasons.join("; ")})`,
    nextQueries,
  };
}

export function mergeAdsById(
  existing: Advertisement[],
  incoming: Advertisement[],
): Advertisement[] {
  const map = new Map<string, Advertisement>();
  for (const ad of existing) map.set(ad.id, ad);
  for (const ad of incoming) {
    if (!map.has(ad.id)) map.set(ad.id, ad);
  }
  return Array.from(map.values());
}
