import { describe, expect, it } from "vitest";
import {
  mergeAnalysesForAds,
  parseCreativeAnalyses,
  toAdLlmPayload,
} from "../../src/integrations/llm.js";
import {
  AdvertisementSchema,
  type Advertisement,
} from "../../src/schemas/advertisement.schema.js";
import adsFixture from "../fixtures/ads.fixture.json";
import llmFixture from "../fixtures/llm-response.fixture.json";

describe("llm parse helpers", () => {
  const ads = AdvertisementSchema.array().parse(adsFixture);

  it("parses a JSON array of creative analyses", () => {
    const analyses = parseCreativeAnalyses(JSON.stringify(llmFixture));
    expect(analyses.length).toBe(2);
    expect(analyses[0]?.adId).toBe("ad_1001");
    expect(analyses[0]?.offer).toContain("Free trial");
  });

  it("parses fenced JSON and { analyses: [] } wrappers", () => {
    const fenced = parseCreativeAnalyses(
      "```json\n" + JSON.stringify({ analyses: llmFixture }) + "\n```",
    );
    expect(fenced).toHaveLength(2);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseCreativeAnalyses("not-json")).toThrow(/invalid JSON/i);
  });

  it("merges analyses and fills missing adIds", () => {
    const partial = parseCreativeAnalyses(JSON.stringify([llmFixture[0]]));
    const merged = mergeAnalysesForAds(ads as Advertisement[], partial);
    expect(merged).toHaveLength(ads.length);
    expect(merged[0]?.hook).toBeTruthy();
    expect(merged[2]?.uncertaintyNotes.join(" ")).toMatch(/No analysis/i);
  });

  it("builds a safe LLM payload without inventing fields", () => {
    const payload = toAdLlmPayload(ads[0] as Advertisement);
    expect(payload).toEqual({
      id: ads[0]!.id,
      advertiser: ads[0]!.advertiser,
      headline: ads[0]!.headline,
      bodyText: ads[0]!.bodyText,
      cta: ads[0]!.cta,
      platform: ads[0]!.platform,
      country: ads[0]!.country,
      sourceUrl: ads[0]!.sourceUrl,
    });
  });
});
