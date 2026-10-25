import { GoogleGenAI } from "@google/genai";
import type {
  Advertisement,
  RankedAd,
} from "../schemas/advertisement.schema.js";
import {
  CreativeAnalysisSchema,
  type CreativeAnalysis,
} from "../schemas/advertisement.schema.js";
import {
  MarketReportSchema,
  type MarketReport,
  type MarketStats,
} from "../schemas/insights.schema.js";
import {
  SYSTEM_MARKET_ANALYST,
  SYSTEM_RESEARCH_ANALYST,
  buildCreativeAnalysisUserPrompt,
  buildMarketSynthesisUserPrompt,
} from "../agent/prompts.js";
import { ExternalServiceError } from "../utils/errors.js";
import { childLogger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { sanitizeNullableField } from "../utils/sanitize.js";

const log = childLogger({ component: "llm" });

export type LlmProviderName = "gemini" | "mock";

export type MarketSynthesisInput = {
  niche: string;
  country: string;
  marketStats: MarketStats;
  rankedAds: RankedAd[];
};

export interface LlmProvider {
  readonly name: LlmProviderName;
  analyzeCreatives(ads: Advertisement[]): Promise<CreativeAnalysis[]>;
  synthesizeMarketReport(input: MarketSynthesisInput): Promise<MarketReport>;
}

/** Fields sent to the model – untrusted data only. */
export type AdLlmPayload = {
  id: string;
  advertiser: string | null;
  headline: string | null;
  bodyText: string | null;
  cta: string | null;
  platform: string | null;
  country: string | null;
  sourceUrl: string | null;
};

export function toAdLlmPayload(ad: Advertisement): AdLlmPayload {
  // Sanitize untrusted creative fields before they enter any LLM prompt.
  return {
    id: ad.id,
    advertiser: sanitizeNullableField(ad.advertiser, 200),
    headline: sanitizeNullableField(ad.headline, 300),
    bodyText: sanitizeNullableField(ad.bodyText, 1500),
    cta: sanitizeNullableField(ad.cta, 80),
    platform: sanitizeNullableField(ad.platform, 80),
    country: sanitizeNullableField(ad.country, 40),
    sourceUrl: ad.sourceUrl,
  };
}

export function emptyAnalysis(
  ad: Advertisement,
  notes: string[] = [],
): CreativeAnalysis {
  return CreativeAnalysisSchema.parse({
    adId: ad.id,
    hook: null,
    offer: null,
    cta: ad.cta,
    creativeAngle: null,
    persuasionTechnique: null,
    targetAudienceSignals: [],
    evidence: {
      sourceUrl: ad.sourceUrl,
      excerpt: ad.bodyText?.slice(0, 160) ?? ad.headline,
    },
    confidence: "low",
    uncertaintyNotes: notes,
  });
}

/**
 * JSON Schema for Gemini structured output (array of CreativeAnalysis).
 */
export const CREATIVE_ANALYSIS_RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      adId: { type: "string" },
      hook: { type: ["string", "null"] },
      offer: { type: ["string", "null"] },
      cta: { type: ["string", "null"] },
      creativeAngle: { type: ["string", "null"] },
      persuasionTechnique: { type: ["string", "null"] },
      targetAudienceSignals: {
        type: "array",
        items: { type: "string" },
      },
      evidence: {
        type: "object",
        properties: {
          sourceUrl: { type: ["string", "null"] },
          excerpt: { type: ["string", "null"] },
        },
        required: ["sourceUrl", "excerpt"],
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      uncertaintyNotes: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "adId",
      "hook",
      "offer",
      "cta",
      "creativeAngle",
      "persuasionTechnique",
      "targetAudienceSignals",
      "evidence",
      "confidence",
      "uncertaintyNotes",
    ],
  },
} as const;

export const MARKET_REPORT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    topOffers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          group: { type: "string" },
          who: { type: "array", items: { type: "string" } },
          examples: { type: "array", items: { type: "string" } },
        },
        required: ["group", "who", "examples"],
      },
    },
    topHooks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hook: { type: "string" },
          type: { type: ["string", "null"] },
          who: { type: ["string", "null"] },
        },
        required: ["hook", "type", "who"],
      },
    },
    angles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string" },
          who: { type: "array", items: { type: "string" } },
        },
        required: ["angle", "who"],
      },
    },
    gaps: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    readyIdeas: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "executiveSummary",
    "topOffers",
    "topHooks",
    "angles",
    "gaps",
    "recommendations",
    "readyIdeas",
    "notes",
  ],
} as const;

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return trimmed;
}

/**
 * Parse model text into CreativeAnalysis[], validating with Zod.
 */
export function parseCreativeAnalyses(rawText: string): CreativeAnalysis[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(rawText));
  } catch {
    throw new ExternalServiceError("Gemini", "Model returned invalid JSON");
  }

  const payload = Array.isArray(parsed)
    ? parsed
    : (parsed as { analyses?: unknown }).analyses;

  const result = CreativeAnalysisSchema.array().safeParse(payload);
  if (!result.success) {
    throw new ExternalServiceError(
      "Gemini",
      "Model JSON failed schema validation",
      { issues: result.error.flatten() },
    );
  }
  return result.data;
}

export function parseMarketReport(
  rawText: string,
  provider: string,
): MarketReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(rawText));
  } catch {
    throw new ExternalServiceError("Gemini", "Model returned invalid JSON");
  }

  const result = MarketReportSchema.safeParse({
    ...(parsed as object),
    provider,
  });
  if (!result.success) {
    throw new ExternalServiceError(
      "Gemini",
      "Market report JSON failed schema validation",
      { issues: result.error.flatten() },
    );
  }
  return result.data;
}

/** Compact sample for market synthesis – keeps prompt size bounded. */
export function toMarketSamplePayload(rankedAds: RankedAd[], limit = 24) {
  return rankedAds.slice(0, limit).map((item) => ({
    advertiser: sanitizeNullableField(item.ad.advertiser, 120),
    headline: sanitizeNullableField(item.ad.headline, 200),
    bodyExcerpt: sanitizeNullableField(
      item.ad.bodyText?.slice(0, 280) ?? null,
      280,
    ),
    cta: sanitizeNullableField(item.analysis?.cta ?? item.ad.cta, 80),
    hook: sanitizeNullableField(item.analysis?.hook, 200),
    offer: sanitizeNullableField(item.analysis?.offer, 200),
    angle: sanitizeNullableField(item.analysis?.creativeAngle, 120),
    platform: sanitizeNullableField(item.ad.platform, 80),
    status: item.ad.status,
    score: item.score,
    hasVideo: Boolean(item.ad.videoUrl),
    landingHost: (() => {
      if (!item.ad.landingUrl) return null;
      try {
        return new URL(item.ad.landingUrl).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })(),
  }));
}

export function buildMockMarketReport(
  input: MarketSynthesisInput,
): MarketReport {
  const { marketStats, rankedAds, niche, country } = input;
  const top = marketStats.competitors[0];
  const topFormat = marketStats.formats[0];
  const topCta = marketStats.ctas[0];
  const hooks = rankedAds
    .map((r) => ({
      hook: r.analysis?.hook ?? r.ad.headline,
      who: r.ad.advertiser,
      type: r.analysis?.persuasionTechnique ?? r.analysis?.creativeAngle,
    }))
    .filter((h) => h.hook)
    .slice(0, 8);

  const offers = rankedAds
    .map((r) => ({
      offer: r.analysis?.offer,
      who: r.ad.advertiser,
    }))
    .filter((o): o is { offer: string; who: string | null } => Boolean(o.offer))
    .slice(0, 6);

  const anglesMap = new Map<string, Set<string>>();
  for (const item of rankedAds) {
    const angle = item.analysis?.creativeAngle;
    if (!angle) continue;
    const who = item.ad.advertiser ?? "Unknown";
    const set = anglesMap.get(angle) ?? new Set<string>();
    set.add(who);
    anglesMap.set(angle, set);
  }

  return MarketReportSchema.parse({
    executiveSummary: [
      `Sample of ${marketStats.totals.ads} ads for "${niche}" in ${country}`,
      `(${marketStats.totals.competitors} advertisers, ${marketStats.totals.active} active).`,
      top
        ? `Largest share in sample: ${top.name} (${top.ads} ads, avg score ${top.avgScore}).`
        : "",
      topFormat
        ? `Dominant format: ${topFormat.name} (${topFormat.pct}%).`
        : "",
      topCta ? `Most common CTA: ${topCta.name} (${topCta.pct}%).` : "",
      "This is a sample-limited synthesis – not full-market truth.",
    ]
      .filter(Boolean)
      .join(" "),
    topOffers:
      offers.length > 0
        ? [
            {
              group: "Observed offers",
              who: Array.from(
                new Set(offers.map((o) => o.who ?? "Unknown")),
              ).slice(0, 6),
              examples: offers.map((o) => o.offer).slice(0, 6),
            },
          ]
        : [],
    topHooks: hooks.map((h) => ({
      hook: h.hook as string,
      type: h.type ?? null,
      who: h.who,
    })),
    angles: Array.from(anglesMap.entries()).map(([angle, who]) => ({
      angle,
      who: Array.from(who),
    })),
    gaps: [
      "Guarantees / risk reversal rarely explicit in this sample.",
      "Concrete prices may be under-used versus soft CTAs.",
      "Social proof volume claims are infrequent in collected copy.",
    ],
    recommendations: [
      "Test hooks that open with a customer problem, not the brand name.",
      "Pair the dominant format with a clearer offer + proof line.",
      "Occupy one gap competitors leave empty (guarantee, bundle, or deadline).",
    ],
    readyIdeas: [
      "Idea: lead with a specific outcome + timeframe, then WhatsApp/profile CTA.",
      "Idea: one text template with rotating creatives (video waves).",
      "Idea: add proof (count delivered / review snippet) above the fold.",
    ],
    provider: "mock",
    notes: [
      "Mock market synthesis – set LLM_PROVIDER=gemini for model-written report.",
    ],
  });
}

export function mergeAnalysesForAds(
  ads: Advertisement[],
  analyses: CreativeAnalysis[],
): CreativeAnalysis[] {
  const byId = new Map(analyses.map((a) => [a.adId, a]));
  return ads.map((ad) => {
    const found = byId.get(ad.id);
    if (found) return found;
    return emptyAnalysis(ad, ["No analysis returned for this adId"]);
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Alias map: informal names → actual API model ids. */
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-3.1-flash": "gemini-3.1-flash-lite",
  "3.1-flash": "gemini-3.1-flash-lite",
  "gemini-3.1": "gemini-3.1-flash-lite",
};

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export const DEFAULT_GEMINI_FALLBACKS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.0-flash",
] as const;

export function normalizeGeminiModelId(model: string): string {
  const trimmed = model.trim();
  return GEMINI_MODEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Primary model + fallbacks from env.
 * GEMINI_MODEL=gemini-3.1-flash-lite
 * GEMINI_MODEL_FALLBACKS=gemini-3.5-flash-lite,gemini-3.6-flash,gemini-2.0-flash
 */
export function resolveGeminiModelChain(): string[] {
  const primary = normalizeGeminiModelId(
    process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  );

  const fromEnv = (process.env.GEMINI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((s) => normalizeGeminiModelId(s))
    .filter(Boolean);

  const fallbacks =
    fromEnv.length > 0 ? fromEnv : [...DEFAULT_GEMINI_FALLBACKS];

  const chain = [primary, ...fallbacks];
  return Array.from(new Set(chain));
}

export function isGeminiModelFallbackError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("not supported") ||
    msg.includes("unknown model") ||
    msg.includes("invalid model") ||
    msg.includes("does not exist") ||
    msg.includes("404") ||
    msg.includes("403") ||
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("unavailable") ||
    msg.includes("503") ||
    msg.includes("overloaded")
  );
}

class MockLlmProvider implements LlmProvider {
  readonly name = "mock" as const;

  async analyzeCreatives(ads: Advertisement[]): Promise<CreativeAnalysis[]> {
    return ads.map((ad) =>
      CreativeAnalysisSchema.parse({
        adId: ad.id,
        hook: ad.headline ?? ad.bodyText?.slice(0, 80) ?? null,
        offer: null,
        cta: ad.cta,
        creativeAngle: null,
        persuasionTechnique: null,
        targetAudienceSignals: [],
        evidence: {
          sourceUrl: ad.sourceUrl,
          excerpt: ad.bodyText?.slice(0, 160) ?? ad.headline,
        },
        confidence: "low",
        uncertaintyNotes: [
          "Mock LLM provider – set LLM_PROVIDER=gemini for real analysis",
        ],
      }),
    );
  }

  async synthesizeMarketReport(
    input: MarketSynthesisInput,
  ): Promise<MarketReport> {
    return buildMockMarketReport(input);
  }
}

class GeminiLlmProvider implements LlmProvider {
  readonly name = "gemini" as const;

  async analyzeCreatives(ads: Advertisement[]): Promise<CreativeAnalysis[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Gemini", "GEMINI_API_KEY is not configured");
    }

    if (ads.length === 0) return [];

    const modelChain = resolveGeminiModelChain();
    const batchSizeRaw = Number.parseInt(process.env.GEMINI_BATCH_SIZE ?? "5", 10);
    const batchSize =
      Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 5;
    const client = new GoogleGenAI({ apiKey });
    const batches = chunk(ads, batchSize);
    const all: CreativeAnalysis[] = [];

    log.info({ modelChain }, "Gemini model chain ready");

    for (const [index, batch] of batches.entries()) {
      log.info(
        {
          batch: index + 1,
          batchCount: batches.length,
          size: batch.length,
        },
        "Gemini analyze batch",
      );
      const analyses = await this.analyzeBatchWithFallback(
        client,
        modelChain,
        batch,
      );
      all.push(...analyses);
    }

    return mergeAnalysesForAds(ads, all);
  }

  async synthesizeMarketReport(
    input: MarketSynthesisInput,
  ): Promise<MarketReport> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Gemini", "GEMINI_API_KEY is not configured");
    }

    const modelChain = resolveGeminiModelChain();
    const client = new GoogleGenAI({ apiKey });
    const errors: Array<{ model: string; message: string }> = [];

    for (const model of modelChain) {
      try {
        log.info({ model }, "Trying Gemini model for market synthesis");
        const report = await this.synthesizeOnce(client, model, input);
        log.info({ model }, "Gemini market synthesis succeeded");
        return report;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Gemini error";
        errors.push({ model, message });
        if (!isGeminiModelFallbackError(error)) {
          if (error instanceof ExternalServiceError) throw error;
          throw new ExternalServiceError("Gemini", message, { model, errors });
        }
        log.warn(
          { model, message },
          "Gemini market synthesis failed – trying fallback",
        );
      }
    }

    throw new ExternalServiceError(
      "Gemini",
      `All models failed for market synthesis: ${modelChain.join(" → ")}`,
      { errors },
    );
  }

  private async synthesizeOnce(
    client: GoogleGenAI,
    model: string,
    input: MarketSynthesisInput,
  ): Promise<MarketReport> {
    const payload = {
      niche: input.niche,
      country: input.country,
      marketStats: input.marketStats,
      adSamples: toMarketSamplePayload(input.rankedAds),
    };
    const userPrompt = buildMarketSynthesisUserPrompt(
      JSON.stringify(payload, null, 2),
    );

    const callOnce = async (repairHint?: string): Promise<string> => {
      const contents = repairHint
        ? `${userPrompt}\n\nPrevious output was invalid. Fix and return JSON only.\nValidation error: ${repairHint}`
        : userPrompt;

      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_MARKET_ANALYST}\n\n${contents}` }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: MARKET_REPORT_RESPONSE_SCHEMA,
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (!text) {
        throw new ExternalServiceError("Gemini", "Empty model response");
      }
      return text;
    };

    try {
      return await withRetry(
        async () => {
          try {
            const text = await callOnce();
            return parseMarketReport(text, `gemini:${model}`);
          } catch (error) {
            if (
              error instanceof ExternalServiceError &&
              (error.message.includes("schema validation") ||
                error.message.includes("invalid JSON"))
            ) {
              const hint =
                error.details && typeof error.details === "object"
                  ? JSON.stringify(error.details)
                  : error.message;
              const repaired = await callOnce(hint);
              return parseMarketReport(repaired, `gemini:${model}`);
            }
            throw error;
          }
        },
        {
          retries: 1,
          delayMs: 800,
          shouldRetry: (error) => {
            const msg =
              error instanceof Error ? error.message.toLowerCase() : "";
            return (
              msg.includes("timeout") ||
              msg.includes("econnreset") ||
              msg.includes("fetch failed")
            );
          },
        },
      );
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      const message =
        error instanceof Error ? error.message : "Unknown Gemini error";
      throw new ExternalServiceError("Gemini", message, { model });
    }
  }

  private async analyzeBatchWithFallback(
    client: GoogleGenAI,
    modelChain: string[],
    ads: Advertisement[],
  ): Promise<CreativeAnalysis[]> {
    const errors: Array<{ model: string; message: string }> = [];

    for (const model of modelChain) {
      try {
        log.info({ model }, "Trying Gemini model");
        const result = await this.analyzeBatch(client, model, ads);
        log.info({ model }, "Gemini model succeeded");
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown Gemini error";
        errors.push({ model, message });
        if (!isGeminiModelFallbackError(error)) {
          if (error instanceof ExternalServiceError) throw error;
          throw new ExternalServiceError("Gemini", message, { model, errors });
        }
        log.warn({ model, message }, "Gemini model failed – trying fallback");
      }
    }

    throw new ExternalServiceError(
      "Gemini",
      `All models failed: ${modelChain.join(" → ")}`,
      { errors },
    );
  }

  private async analyzeBatch(
    client: GoogleGenAI,
    model: string,
    ads: Advertisement[],
  ): Promise<CreativeAnalysis[]> {
    const payload = ads.map(toAdLlmPayload);
    const userPrompt = buildCreativeAnalysisUserPrompt(
      JSON.stringify(payload, null, 2),
    );

    const callOnce = async (repairHint?: string): Promise<string> => {
      const contents = repairHint
        ? `${userPrompt}\n\nPrevious output was invalid. Fix and return JSON only.\nValidation error: ${repairHint}`
        : userPrompt;

      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_RESEARCH_ANALYST}\n\n${contents}` }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: CREATIVE_ANALYSIS_RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new ExternalServiceError("Gemini", "Empty model response");
      }
      return text;
    };

    try {
      return await withRetry(
        async () => {
          try {
            const text = await callOnce();
            return parseCreativeAnalyses(text);
          } catch (error) {
            if (
              error instanceof ExternalServiceError &&
              (error.message.includes("schema validation") ||
                error.message.includes("invalid JSON"))
            ) {
              const hint =
                error.details && typeof error.details === "object"
                  ? JSON.stringify(error.details)
                  : error.message;
              const repaired = await callOnce(hint);
              return parseCreativeAnalyses(repaired);
            }
            throw error;
          }
        },
        {
          retries: 1,
          delayMs: 800,
          shouldRetry: (error) => {
            const msg =
              error instanceof Error ? error.message.toLowerCase() : "";
            // Same-model transient retries only (fallback handles hard model failures)
            return (
              msg.includes("timeout") ||
              msg.includes("econnreset") ||
              msg.includes("fetch failed")
            );
          },
        },
      );
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      const message =
        error instanceof Error ? error.message : "Unknown Gemini error";
      throw new ExternalServiceError("Gemini", message, { model });
    }
  }
}

export function createLlmProvider(
  name: LlmProviderName = (process.env.LLM_PROVIDER as LlmProviderName) ??
    "mock",
): LlmProvider {
  switch (name) {
    case "gemini":
      return new GeminiLlmProvider();
    case "mock":
    default:
      return new MockLlmProvider();
  }
}
