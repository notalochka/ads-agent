import type { ResearchPlan, ResearchRequest } from "../schemas/research.schema.js";
import { ResearchPlanSchema } from "../schemas/research.schema.js";
import { RefusalError } from "../utils/errors.js";
import { looksLikePromptInjection } from "../utils/sanitize.js";

const REFUSAL_PATTERNS = [
  /private\s+campaign/i,
  /bypass\s+(access|auth|login)/i,
  /steal\s+ads?/i,
  /non[- ]?public/i,
  /scrape\s+inbox/i,
];

export function assertAllowedRequest(request: ResearchRequest): void {
  const blob = [
    request.niche,
    request.country,
    ...(request.competitors ?? []),
    ...(request.keywords ?? []),
  ].join(" ");

  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(blob)) {
      throw new RefusalError(
        "Request refused: only publicly available advertising data is supported.",
      );
    }
  }

  // User fields should not carry prompt-injection / jailbreak attempts.
  if (looksLikePromptInjection(blob)) {
    throw new RefusalError(
      "Request refused: instruction-override / prompt-injection patterns are not allowed in research input.",
    );
  }
}

/**
 * Builds an initial research plan from a validated user request.
 * Deterministic for MVP (LLM planning can be added later).
 */
export function buildResearchPlan(request: ResearchRequest): ResearchPlan {
  assertAllowedRequest(request);

  const keywordQueries = (request.keywords ?? []).map((k) =>
    `${k} ${request.niche}`.trim(),
  );
  const nicheQuery = `${request.niche} ${request.country}`.trim();
  const competitorQueries = request.competitors.map((c) => c.trim()).filter(Boolean);

  const searchQueries = Array.from(
    new Set([nicheQuery, ...keywordQueries, ...competitorQueries]),
  ).filter(Boolean);

  return ResearchPlanSchema.parse({
    niche: request.niche,
    country: request.country,
    searchQueries: searchQueries.length > 0 ? searchQueries : [request.niche],
    competitorTargets: competitorQueries,
    rationale:
      "Start with niche + geography, then competitor names and optional keywords. Refine only if evidence is insufficient.",
  });
}
