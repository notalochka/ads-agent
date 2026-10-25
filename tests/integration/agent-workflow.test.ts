import { describe, expect, it, vi } from "vitest";
import { executeResearch } from "../../src/services/research.service.js";
import { runResearchAgent } from "../../src/agent/orchestrator.js";
import * as searchTool from "../../src/tools/search-competitor-ads.js";
import type { Advertisement } from "../../src/schemas/advertisement.schema.js";

describe("agent workflow (integration)", () => {
  it("runs plan → search → analyze → rank and returns structured output", async () => {
    process.env.ADS_SOURCE = "mock";
    process.env.LLM_PROVIDER = "mock";

    const { result, markdownReport } = await executeResearch({
      niche: "online education",
      country: "Poland",
      competitors: ["Learnify Online", "SkillSprint"],
      keywords: ["english course"],
      maxAds: 10,
    });

    expect(result.runId).toBeTruthy();
    expect(result.adsFound).toBeGreaterThan(0);
    expect(result.rankedAds.length).toBeGreaterThan(0);
    expect(result.traceSummary.iterations).toBeGreaterThanOrEqual(1);
    expect(result.traceSummary.toolCalls.map((t) => t.tool)).toContain(
      "searchCompetitorAds",
    );
    expect(result.traceSummary.toolCalls.map((t) => t.tool)).toContain(
      "analyzeCreatives",
    );
    expect(result.traceSummary.toolCalls.map((t) => t.tool)).toContain(
      "validateAndRankAds",
    );
    expect(result.traceSummary.toolCalls.map((t) => t.tool)).toContain(
      "synthesizeMarketReport",
    );
    expect(result.insights.marketStats?.totals.ads).toBe(result.adsFound);
    expect(result.insights.marketReport?.executiveSummary.length).toBeGreaterThan(
      20,
    );
    expect(result.traceSummary.decision.length).toBeGreaterThan(10);
    expect(markdownReport).toContain("Market Report");
    expect(markdownReport).toContain("AI market report");
    expect(result.humanSummary.length).toBeGreaterThan(20);
  });

  it("emits progress stages during the run", async () => {
    process.env.ADS_SOURCE = "mock";
    process.env.LLM_PROVIDER = "mock";

    const stages: string[] = [];
    await runResearchAgent(
      {
        niche: "online education",
        country: "Poland",
        competitors: ["Learnify"],
        keywords: ["english"],
        maxAds: 5,
      },
      {
        onProgress: (event) => {
          stages.push(event.stage);
        },
      },
    );

    expect(stages).toContain("plan");
    expect(stages).toContain("search");
    expect(stages).toContain("analyze");
    expect(stages).toContain("rank");
    expect(stages).toContain("synthesize");
    expect(stages).toContain("done");
  });

  it("refines search when first batch has too few ads", async () => {
    process.env.LLM_PROVIDER = "mock";

    const thinAd: Advertisement = {
      id: "thin_1",
      advertiser: "X",
      headline: "Online education tip",
      bodyText: "Short",
      cta: "Learn More",
      imageUrl: null,
      landingUrl: null,
      sourceUrl: "https://www.facebook.com/ads/library/?id=thin_1",
      platform: "facebook",
      country: "PL",
      startDate: "2025-01-01",
      endDate: null,
      status: "active",
    };

    const richAds: Advertisement[] = [
      { ...thinAd, id: "rich_1", headline: "Online education A" },
      { ...thinAd, id: "rich_2", headline: "Online education B" },
      { ...thinAd, id: "rich_3", headline: "Online education C" },
    ];

    let calls = 0;
    const spy = vi
      .spyOn(searchTool, "searchCompetitorAds")
      .mockImplementation(async () => {
        calls += 1;
        if (calls === 1) {
          return { ads: [thinAd], source: "mock", queryCount: 1 };
        }
        return { ads: richAds, source: "mock", queryCount: 1 };
      });

    try {
      const result = await runResearchAgent(
        {
          niche: "online education",
          country: "Poland",
          competitors: ["Learnify"],
          keywords: ["english"],
          maxAds: 10,
        },
        { maxIterations: 3, minAds: 3 },
      );

      expect(calls).toBeGreaterThanOrEqual(2);
      expect(result.traceSummary.iterations).toBeGreaterThanOrEqual(2);
      expect(result.adsFound).toBeGreaterThanOrEqual(3);
      expect(result.traceSummary.decision).toMatch(/Evidence OK|iterations=/i);
      expect(
        result.traceSummary.toolCalls.filter(
          (t) => t.tool === "searchCompetitorAds",
        ).length,
      ).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });
});
