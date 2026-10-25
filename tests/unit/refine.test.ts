import { describe, expect, it } from "vitest";
import {
  buildRefinedQueries,
  decideRefine,
  evaluateEvidence,
  mergeAdsById,
} from "../../src/agent/refine.js";
import type { Advertisement } from "../../src/schemas/advertisement.schema.js";
import type { ResearchRequest } from "../../src/schemas/research.schema.js";

const request: ResearchRequest = {
  niche: "online education",
  country: "Poland",
  competitors: ["Learnify Online"],
  keywords: ["english course"],
};

function ad(partial: Partial<Advertisement> & { id: string }): Advertisement {
  return {
    advertiser: null,
    headline: null,
    bodyText: null,
    cta: null,
    imageUrl: null,
    landingUrl: null,
    sourceUrl: null,
    platform: null,
    country: "PL",
    startDate: null,
    endDate: null,
    status: "unknown",
    ...partial,
  };
}

describe("evaluateEvidence", () => {
  it("marks empty set as insufficient", () => {
    const result = evaluateEvidence([], request, { minAds: 3 });
    expect(result.sufficient).toBe(false);
    expect(result.reasons[0]).toMatch(/Only 0 ads/i);
  });

  it("marks enough ads with text as sufficient", () => {
    const ads = [
      ad({ id: "1", headline: "Online education offer" }),
      ad({ id: "2", bodyText: "Learn English online" }),
      ad({ id: "3", headline: "Course promo" }),
    ];
    const result = evaluateEvidence(ads, request, { minAds: 3 });
    expect(result.sufficient).toBe(true);
    expect(result.withTextCount).toBe(3);
  });

  it("fails when ads have no text", () => {
    const ads = [ad({ id: "1" }), ad({ id: "2" }), ad({ id: "3" })];
    const result = evaluateEvidence(ads, request, { minAds: 3 });
    expect(result.sufficient).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/No ads contain/i);
  });
});

describe("buildRefinedQueries / decideRefine", () => {
  it("builds unused refined queries", () => {
    const next = buildRefinedQueries({
      request,
      usedQueries: ["online education Poland"],
      iteration: 1,
    });
    expect(next.length).toBeGreaterThan(0);
    expect(next.map((q) => q.toLowerCase())).not.toContain(
      "online education poland",
    );
  });

  it("stops refining when evidence is sufficient", () => {
    const decision = decideRefine({
      assessment: {
        sufficient: true,
        reasons: ["Evidence OK"],
        adsCount: 5,
        withTextCount: 5,
        relevantCount: 2,
      },
      request,
      usedQueries: ["online education"],
      iteration: 1,
      maxIterations: 3,
    });
    expect(decision.shouldRefine).toBe(false);
  });

  it("requests refine when evidence is insufficient and queries remain", () => {
    const decision = decideRefine({
      assessment: {
        sufficient: false,
        reasons: ["Only 1 ads (min 3)"],
        adsCount: 1,
        withTextCount: 1,
        relevantCount: 0,
      },
      request,
      usedQueries: ["online education Poland"],
      iteration: 1,
      maxIterations: 3,
    });
    expect(decision.shouldRefine).toBe(true);
    expect(decision.nextQueries.length).toBeGreaterThan(0);
  });

  it("stops at max iterations", () => {
    const decision = decideRefine({
      assessment: {
        sufficient: false,
        reasons: ["Only 1 ads (min 3)"],
        adsCount: 1,
        withTextCount: 1,
        relevantCount: 0,
      },
      request,
      usedQueries: [],
      iteration: 3,
      maxIterations: 3,
    });
    expect(decision.shouldRefine).toBe(false);
    expect(decision.reason).toMatch(/Max iterations/i);
  });
});

describe("mergeAdsById", () => {
  it("deduplicates by id", () => {
    const merged = mergeAdsById(
      [ad({ id: "a", headline: "one" })],
      [ad({ id: "a", headline: "dup" }), ad({ id: "b", headline: "two" })],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((x) => x.id === "a")?.headline).toBe("one");
  });
});
