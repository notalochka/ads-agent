import { describe, expect, it } from "vitest";
import type { RankedAd } from "../../src/schemas/advertisement.schema.js";
import { buildMarketStats } from "../../src/services/market-stats.service.js";
import { buildMockMarketReport } from "../../src/integrations/llm.js";

function ranked(
  partial: Partial<RankedAd["ad"]> & { id: string },
  score = 50,
  analysis: RankedAd["analysis"] = null,
): RankedAd {
  return {
    ad: {
      advertiser: "Brand",
      headline: "Headline",
      bodyText: "Body",
      cta: "Learn More",
      imageUrl: "https://example.com/a.jpg",
      videoUrl: null,
      landingUrl: "https://example.com/land",
      sourceUrl: "https://www.facebook.com/ads/library/?id=1",
      platform: "facebook",
      country: "PL",
      startDate: "2025-01-01",
      endDate: null,
      status: "active",
      ...partial,
    },
    analysis,
    score,
    scoreExplanation: ["test"],
    warnings: [],
  };
}

describe("buildMarketStats", () => {
  it("aggregates totals, formats, platforms, and competitors", () => {
    const stats = buildMarketStats([
      ranked({
        id: "1",
        advertiser: "Learnify",
        videoUrl: "https://example.com/v.mp4",
        platform: "instagram, facebook",
        cta: "Learn More",
        landingUrl: "https://api.whatsapp.com/send?phone=1",
      }),
      ranked({
        id: "2",
        advertiser: "Learnify",
        imageUrl: "https://example.com/i.jpg",
        videoUrl: null,
        platform: "instagram",
        cta: "Shop Now",
        landingUrl: "https://instagram.com/learnify",
        status: "inactive",
      }),
      ranked({
        id: "3",
        advertiser: "SkillSprint",
        videoUrl: "https://example.com/v2.mp4",
        platform: "facebook",
        cta: "Learn More",
        landingUrl: "https://example.com/offer",
      }),
    ]);

    expect(stats.totals.ads).toBe(3);
    expect(stats.totals.active).toBe(2);
    expect(stats.totals.inactive).toBe(1);
    expect(stats.totals.competitors).toBe(2);
    expect(stats.totals.withVideo).toBe(2);
    expect(stats.formats[0]?.name).toBe("Video");
    expect(stats.platforms.find((p) => p.name === "instagram")?.count).toBe(2);
    expect(stats.ctas.find((c) => c.name === "Learn More")?.count).toBe(2);
    expect(stats.landings.some((l) => l.domain === "api.whatsapp.com")).toBe(
      true,
    );
    expect(stats.competitors[0]?.name).toBe("Learnify");
    expect(stats.competitors[0]?.ads).toBe(2);
  });
});

describe("buildMockMarketReport", () => {
  it("returns a schema-valid narrative from stats + ranked ads", () => {
    const rankedAds = [
      ranked(
        { id: "1", advertiser: "Learnify", headline: "Speak in 30 days" },
        70,
        {
          adId: "1",
          hook: "Speak in 30 days",
          offer: "Free trial",
          cta: "Learn More",
          creativeAngle: "Speed / outcome",
          persuasionTechnique: "Specificity",
          targetAudienceSignals: [],
          evidence: { sourceUrl: null, excerpt: null },
          confidence: "medium",
          uncertaintyNotes: [],
        },
      ),
    ];
    const marketStats = buildMarketStats(rankedAds);
    const report = buildMockMarketReport({
      niche: "online education",
      country: "Poland",
      marketStats,
      rankedAds,
    });

    expect(report.provider).toBe("mock");
    expect(report.executiveSummary).toContain("online education");
    expect(report.topHooks[0]?.hook).toBe("Speak in 30 days");
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
