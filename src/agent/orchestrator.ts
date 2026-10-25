import { randomUUID } from "node:crypto";
import type { AgentOutput } from "../schemas/agent-output.schema.js";
import { AgentOutputSchema } from "../schemas/agent-output.schema.js";
import type { Advertisement } from "../schemas/advertisement.schema.js";
import {
  emitProgress,
  type ProgressReporter,
} from "../schemas/progress.schema.js";
import type { ResearchRequest } from "../schemas/research.schema.js";
import { searchCompetitorAds } from "../tools/search-competitor-ads.js";
import { analyzeCreatives } from "../tools/analyze-creatives.js";
import { validateAndRankAds } from "../tools/validate-and-rank-ads.js";
import { synthesizeMarketReport } from "../tools/synthesize-market-report.js";
import { buildMarketStats } from "../services/market-stats.service.js";
import { buildResearchPlan } from "./planner.js";
import { buildHumanSummarySkeleton } from "./prompts.js";
import {
  decideRefine,
  evaluateEvidence,
  mergeAdsById,
} from "./refine.js";
import { childLogger } from "../utils/logger.js";

export type OrchestratorOptions = {
  maxIterations?: number;
  maxAds?: number;
  minAds?: number;
  onProgress?: ProgressReporter;
};

type ToolTrace = AgentOutput["traceSummary"]["toolCalls"][number];

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function aggregateInsights(
  ranked: AgentOutput["rankedAds"],
): AgentOutput["insights"] {
  const hooks: string[] = [];
  const offers: string[] = [];
  const ctas: string[] = [];
  const angles: string[] = [];

  for (const item of ranked) {
    if (item.analysis?.hook) hooks.push(item.analysis.hook);
    if (item.analysis?.offer) offers.push(item.analysis.offer);
    if (item.analysis?.cta ?? item.ad.cta) {
      ctas.push(item.analysis?.cta ?? item.ad.cta ?? "");
    }
    if (item.analysis?.creativeAngle) angles.push(item.analysis.creativeAngle);
  }

  const uniq = (xs: string[]) =>
    Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));

  return {
    recurringHooks: uniq(hooks).slice(0, 10),
    recurringOffers: uniq(offers).slice(0, 10),
    recurringCtas: uniq(ctas).slice(0, 10),
    creativeAngles: uniq(angles).slice(0, 10),
    opportunitiesToTest: [
      "Test the most frequent hooks against your own offer (sample-limited).",
      "Compare CTAs used by top-ranked creatives in this dataset only.",
    ],
  };
}

/**
 * Custom multi-step orchestrator.
 * Flow: plan → search loop (evaluate → optional refine) → analyze → validate/rank → report.
 */
export async function runResearchAgent(
  request: ResearchRequest,
  options: OrchestratorOptions = {},
): Promise<AgentOutput> {
  const runId = randomUUID();
  const log = childLogger({ runId, component: "orchestrator" });
  const maxIterations =
    options.maxIterations ?? envInt("AGENT_MAX_ITERATIONS", 3);
  const maxAds = options.maxAds ?? request.maxAds ?? envInt("AGENT_MAX_ADS", 30);
  const minAds = options.minAds ?? envInt("AGENT_MIN_ADS", 3);
  const progress = options.onProgress;

  const toolCalls: ToolTrace[] = [];
  const warnings: string[] = [];
  const limitations: string[] = [
    "Ranking does not imply profitability, reach, or ROI.",
    "Findings are limited to the collected sample and configured data source.",
  ];

  log.info({ request, maxIterations, maxAds, minAds }, "research run start");

  emitProgress(progress, {
    stage: "plan",
    message: "Building research plan…",
    detail: `Up to ${maxIterations} search iteration(s), max ${maxAds} ads`,
  });

  const plan = buildResearchPlan(request);
  const searchQueriesUsed: string[] = [];
  let collectedAds: Advertisement[] = [];
  let adsSource: "mock" | "apify" | null = null;
  let iteration = 0;
  let stopReason = "Search loop finished";

  let currentQueries = [...plan.searchQueries];

  emitProgress(progress, {
    stage: "plan",
    message: "Plan ready",
    detail: `${plan.searchQueries.length} quer${plan.searchQueries.length === 1 ? "y" : "ies"} prepared`,
  });

  while (iteration < maxIterations) {
    iteration += 1;
    searchQueriesUsed.push(...currentQueries);

    emitProgress(progress, {
      stage: "search",
      message: `Searching ads (iteration ${iteration}/${maxIterations})…`,
      detail: currentQueries.slice(0, 3).join(" · "),
      iteration,
      adsFound: collectedAds.length,
    });

    const searchStarted = Date.now();
    try {
      const searchResult = await searchCompetitorAds({
        queries: currentQueries,
        country: request.country,
        competitors: iteration === 1 ? plan.competitorTargets : [],
        maxAds,
      });
      adsSource = searchResult.source;
      const beforeCount = collectedAds.length;
      collectedAds = mergeAdsById(collectedAds, searchResult.ads);

      toolCalls.push({
        tool: "searchCompetitorAds",
        status: "ok",
        durationMs: Date.now() - searchStarted,
        detail: `iter=${iteration}; source=${searchResult.source}; batch=${searchResult.ads.length}; total=${collectedAds.length}; queries=${currentQueries.join(" | ")}`,
      });

      emitProgress(progress, {
        stage: "search",
        message: `Found ${searchResult.ads.length} ads this round`,
        detail: `Total unique: ${collectedAds.length} (source: ${searchResult.source})`,
        iteration,
        adsFound: collectedAds.length,
      });

      log.info(
        {
          iteration,
          batchAds: searchResult.ads.length,
          totalAds: collectedAds.length,
          newAds: collectedAds.length - beforeCount,
        },
        "search iteration complete",
      );
    } catch (error) {
      toolCalls.push({
        tool: "searchCompetitorAds",
        status: "error",
        durationMs: Date.now() - searchStarted,
        detail: `iter=${iteration}; ${error instanceof Error ? error.message : "unknown error"}`,
      });
      throw error;
    }

    const assessment = evaluateEvidence(collectedAds, request, { minAds });
    const decision = decideRefine({
      assessment,
      request,
      usedQueries: searchQueriesUsed,
      iteration,
      maxIterations,
    });

    log.info(
      {
        iteration,
        sufficient: assessment.sufficient,
        shouldRefine: decision.shouldRefine,
        reason: decision.reason,
      },
      "evidence evaluation",
    );

    if (!decision.shouldRefine) {
      stopReason = decision.reason;
      break;
    }

    emitProgress(progress, {
      stage: "refine",
      message: "Evidence thin – refining search queries…",
      detail: decision.reason,
      iteration,
      adsFound: collectedAds.length,
    });

    warnings.push(decision.reason);
    currentQueries = decision.nextQueries;
    stopReason = decision.reason;
  }

  if (adsSource === "mock") {
    limitations.push("ADS_SOURCE=mock – using fixture advertisements.");
  }

  if (iteration >= maxIterations && !evaluateEvidence(collectedAds, request, { minAds }).sufficient) {
    warnings.push(
      `Stopped after ${iteration} search iteration(s) with incomplete evidence.`,
    );
  }

  emitProgress(progress, {
    stage: "analyze",
    message: "Analyzing creatives with LLM…",
    detail:
      collectedAds.length > 0
        ? `${collectedAds.length} ads – this step can take a while`
        : "No ads to analyze",
    adsFound: collectedAds.length,
  });

  const analyzeStarted = Date.now();
  const analysisResult = await analyzeCreatives(collectedAds);
  toolCalls.push({
    tool: "analyzeCreatives",
    status: "ok",
    durationMs: Date.now() - analyzeStarted,
    detail: `provider=${analysisResult.provider}; ads=${collectedAds.length}`,
  });

  emitProgress(progress, {
    stage: "analyze",
    message: "Creative analysis complete",
    detail: `provider=${analysisResult.provider}`,
    adsFound: collectedAds.length,
  });

  emitProgress(progress, {
    stage: "rank",
    message: "Validating and ranking ads…",
    adsFound: collectedAds.length,
  });

  const rankStarted = Date.now();
  const rankResult = validateAndRankAds({
    ads: collectedAds,
    analyses: analysisResult.analyses,
  });
  toolCalls.push({
    tool: "validateAndRankAds",
    status: "ok",
    durationMs: Date.now() - rankStarted,
    detail: `ranked=${rankResult.rankedAds.length}`,
  });
  warnings.push(...rankResult.warnings);

  emitProgress(progress, {
    stage: "rank",
    message: "Ranking complete",
    detail: `${rankResult.rankedAds.length} ranked ads`,
    adsFound: rankResult.rankedAds.length,
  });

  const baseInsights = aggregateInsights(rankResult.rankedAds);
  const marketStats = buildMarketStats(rankResult.rankedAds);

  emitProgress(progress, {
    stage: "synthesize",
    message: "Writing AI market report…",
    detail: "Second LLM call – market synthesis",
    adsFound: rankResult.rankedAds.length,
  });

  const synthesisStarted = Date.now();
  const synthesis = await synthesizeMarketReport({
    niche: request.niche,
    country: request.country,
    marketStats,
    rankedAds: rankResult.rankedAds,
  });
  toolCalls.push({
    tool: "synthesizeMarketReport",
    status: synthesis.report ? "ok" : synthesis.warning ? "error" : "skipped",
    durationMs: Date.now() - synthesisStarted,
    detail: synthesis.report
      ? `provider=${synthesis.provider}`
      : (synthesis.warning ?? "no ads to synthesize"),
  });
  if (synthesis.warning) warnings.push(synthesis.warning);

  emitProgress(progress, {
    stage: "synthesize",
    message: synthesis.report
      ? "Market report ready"
      : "Market synthesis skipped",
    detail: synthesis.warning ?? `provider=${synthesis.provider}`,
    adsFound: rankResult.rankedAds.length,
  });

  const opportunities =
    synthesis.report?.recommendations?.length
      ? synthesis.report.recommendations.slice(0, 8)
      : baseInsights.opportunitiesToTest;

  const insights = {
    ...baseInsights,
    opportunitiesToTest: opportunities,
    marketStats,
    marketReport: synthesis.report,
  };

  emitProgress(progress, {
    stage: "report",
    message: "Building final report…",
    adsFound: collectedAds.length,
  });

  const humanSummary = buildHumanSummarySkeleton({
    niche: request.niche,
    country: request.country,
    adsFound: collectedAds.length,
    topHooks: insights.recurringHooks,
  });

  const finalAssessment = evaluateEvidence(collectedAds, request, { minAds });
  const status =
    collectedAds.length === 0
      ? "partial"
      : !finalAssessment.sufficient || analysisResult.provider === "mock"
        ? "partial"
        : "completed";

  if (collectedAds.length === 0) {
    warnings.push("No advertisements found for the given research request.");
  }

  const uniqueQueries = Array.from(new Set(searchQueriesUsed));

  const output = AgentOutputSchema.parse({
    runId,
    status,
    request,
    plan,
    searchQueriesUsed: uniqueQueries,
    adsFound: collectedAds.length,
    adsAnalyzed: analysisResult.analyses.length,
    rankedAds: rankResult.rankedAds,
    insights,
    limitations,
    warnings: Array.from(new Set(warnings)),
    humanSummary,
    traceSummary: {
      iterations: iteration,
      toolCalls,
      decision: `${stopReason} | iterations=${iteration} | ads=${collectedAds.length}`,
    },
  });

  emitProgress(progress, {
    stage: "done",
    message: "Research complete",
    detail: `status=${output.status}; ads=${output.adsFound}`,
    adsFound: output.adsFound,
  });

  log.info(
    {
      status: output.status,
      adsFound: output.adsFound,
      iterations: output.traceSummary.iterations,
      decision: output.traceSummary.decision,
    },
    "research run complete",
  );

  return output;
}
