import { describe, expect, it } from "vitest";
import { ResearchRequestSchema } from "../../src/schemas/research.schema.js";
import { AdvertisementSchema } from "../../src/schemas/advertisement.schema.js";
import adsFixture from "../fixtures/ads.fixture.json";

describe("schemas", () => {
  it("parses a valid research request", () => {
    const parsed = ResearchRequestSchema.parse({
      niche: "online education",
      country: "Poland",
      competitors: ["Learnify Online"],
      keywords: ["english course"],
    });

    expect(parsed.niche).toBe("online education");
    expect(parsed.competitors).toHaveLength(1);
  });

  it("rejects an empty niche", () => {
    expect(() =>
      ResearchRequestSchema.parse({
        niche: "a",
        country: "PL",
      }),
    ).toThrow();
  });

  it("parses advertisement fixtures", () => {
    const ads = AdvertisementSchema.array().parse(adsFixture);
    expect(ads.length).toBeGreaterThan(0);
    expect(ads[0]?.id).toBe("ad_1001");
  });
});
