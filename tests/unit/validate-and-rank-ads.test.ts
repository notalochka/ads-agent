import { describe, expect, it } from "vitest";
import {
  scoreAd,
  validateAndRankAds,
} from "../../src/tools/validate-and-rank-ads.js";
import type { Advertisement } from "../../src/schemas/advertisement.schema.js";
import adsFixture from "../fixtures/ads.fixture.json";
import llmFixture from "../fixtures/llm-response.fixture.json";
import {
  AdvertisementSchema,
  CreativeAnalysisSchema,
} from "../../src/schemas/advertisement.schema.js";

describe("validateAndRankAds", () => {
  const ads = AdvertisementSchema.array().parse(adsFixture);
  const analyses = CreativeAnalysisSchema.array().parse(llmFixture);

  it("scores higher when more evidence fields exist", () => {
    const rich = scoreAd(ads[0] as Advertisement, analyses[0]);
    const poor = scoreAd(
      {
        id: "x",
        advertiser: null,
        headline: null,
        bodyText: null,
        cta: null,
        imageUrl: null,
        landingUrl: null,
        sourceUrl: null,
        platform: null,
        country: null,
        startDate: null,
        endDate: null,
        status: "unknown",
      },
      undefined,
    );

    expect(rich.score).toBeGreaterThan(poor.score);
  });

  it("deduplicates identical ads and sorts by score", () => {
    const duplicated = [ads[0], ads[0], ads[1]] as Advertisement[];
    const result = validateAndRankAds({ ads: duplicated, analyses });

    expect(result.duplicatesRemoved).toBe(1);
    expect(result.rankedAds.length).toBe(2);
    expect(result.rankedAds[0]!.score).toBeGreaterThanOrEqual(
      result.rankedAds[1]!.score,
    );
  });
});
