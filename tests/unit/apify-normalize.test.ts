import { describe, expect, it } from "vitest";
import {
  buildAdLibrarySearchUrl,
  buildApifyStartUrls,
  normalizeApifyAds,
  toCountryCode,
} from "../../src/integrations/apify.js";
import rawFixture from "../fixtures/apify-raw.fixture.json";

describe("apify helpers", () => {
  it("maps country names to Ad Library codes", () => {
    expect(toCountryCode("Poland")).toBe("PL");
    expect(toCountryCode("pl")).toBe("PL");
    expect(toCountryCode("Unknownland")).toBe("ALL");
  });

  it("builds Ad Library search URLs", () => {
    const url = buildAdLibrarySearchUrl("online education", "PL");
    expect(url).toContain("facebook.com/ads/library");
    expect(url).toContain("country=PL");
    expect(url).toContain("q=online");
  });

  it("builds startUrls from queries and competitors", () => {
    const startUrls = buildApifyStartUrls({
      queries: ["online education Poland"],
      country: "Poland",
      competitors: ["https://www.facebook.com/SHEINOFFICIAL", "Duolingo"],
    });

    expect(startUrls.length).toBeGreaterThanOrEqual(2);
    expect(startUrls.some((s) => s.url.includes("SHEINOFFICIAL"))).toBe(true);
    expect(startUrls.some((s) => s.url.includes("Duolingo"))).toBe(true);
  });

  it("normalizes raw Apify items into Advertisement records", () => {
    const ads = normalizeApifyAds(rawFixture, "PL");

    expect(ads.length).toBe(3);
    expect(ads[0]?.id).toBe("1229350099285014");
    expect(ads[0]?.advertiser).toBe("Learnify Online");
    expect(ads[0]?.headline).toContain("Speak English");
    expect(ads[0]?.cta).toBe("Learn More");
    expect(ads[0]?.platform).toContain("FACEBOOK");
    expect(ads[0]?.status).toBe("active");
    expect(ads[0]?.country).toBe("PL");
    expect(ads[0]?.sourceUrl).toContain("ads/library");

    expect(ads[1]?.status).toBe("inactive");
    expect(ads[1]?.imageUrl).toContain("skillsprint-1.jpg");
    expect(ads[1]?.videoUrl).toContain("flower.mp4");
  });

  it("respects maxAds when normalizing", () => {
    const ads = normalizeApifyAds(rawFixture, "PL", 1);
    expect(ads).toHaveLength(1);
  });
});
