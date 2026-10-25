import type { AgentOutput } from "../schemas/agent-output.schema.js";

/**
 * Builds a marketer-facing markdown report from structured agent output.
 */
export function buildMarkdownReport(output: AgentOutput): string {
  const lines: string[] = [
    `# Market Report – ${output.request.niche} (${output.request.country})`,
    "",
    `**Run ID:** ${output.runId}`,
    `**Status:** ${output.status}`,
    "",
    "## Summary",
    output.humanSummary,
    "",
    "## Scope",
    `- Niche: ${output.request.niche}`,
    `- Country: ${output.request.country}`,
    `- Competitors: ${output.request.competitors.join(", ") || "n/a"}`,
    `- Queries: ${output.searchQueriesUsed.join(" | ")}`,
    `- Ads found / analyzed: ${output.adsFound} / ${output.adsAnalyzed}`,
    "",
    "## Ranked advertisements",
  ];

  if (output.rankedAds.length === 0) {
    lines.push("_No ads to rank._");
  } else {
    for (const [index, item] of output.rankedAds.entries()) {
      lines.push(
        `### ${index + 1}. ${item.ad.advertiser ?? "Unknown advertiser"} (score ${item.score})`,
      );
      lines.push(`- Headline: ${item.ad.headline ?? "n/a"}`);
      lines.push(`- Hook: ${item.analysis?.hook ?? "n/a"}`);
      lines.push(`- Offer: ${item.analysis?.offer ?? "n/a"}`);
      lines.push(`- CTA: ${item.analysis?.cta ?? item.ad.cta ?? "n/a"}`);
      lines.push(`- Source: ${item.ad.sourceUrl ?? "n/a"}`);
      lines.push(`- Why this score: ${item.scoreExplanation.join("; ")}`);
      if (item.warnings.length) {
        lines.push(`- Warnings: ${item.warnings.join("; ")}`);
      }
      lines.push("");
    }
  }

  lines.push("## Insights (sample-limited)");
  lines.push(`- Hooks: ${output.insights.recurringHooks.join("; ") || "n/a"}`);
  lines.push(`- Offers: ${output.insights.recurringOffers.join("; ") || "n/a"}`);
  lines.push(`- CTAs: ${output.insights.recurringCtas.join("; ") || "n/a"}`);
  lines.push(
    `- Opportunities: ${output.insights.opportunitiesToTest.join("; ")}`,
  );

  const stats = output.insights.marketStats;
  if (stats) {
    lines.push("");
    lines.push("## Market overview (deterministic)");
    lines.push(
      `- Ads: ${stats.totals.ads} | Active: ${stats.totals.active} | Competitors: ${stats.totals.competitors}`,
    );
    lines.push(
      `- Formats: ${stats.formats.map((f) => `${f.name} ${f.pct}%`).join("; ") || "n/a"}`,
    );
    lines.push(
      `- Platforms: ${stats.platforms.map((p) => `${p.name} ${p.pct}%`).join("; ") || "n/a"}`,
    );
  }

  const report = output.insights.marketReport;
  if (report) {
    lines.push("");
    lines.push("## AI market report");
    lines.push(report.executiveSummary);
    if (report.gaps.length) {
      lines.push("");
      lines.push("### Gaps");
      for (const g of report.gaps) lines.push(`- ${g}`);
    }
    if (report.recommendations.length) {
      lines.push("");
      lines.push("### Recommendations");
      for (const r of report.recommendations) lines.push(`- ${r}`);
    }
    if (report.readyIdeas.length) {
      lines.push("");
      lines.push("### Ready ideas");
      for (const idea of report.readyIdeas) lines.push(`- ${idea}`);
    }
  }

  lines.push("");
  lines.push("## Limitations");
  for (const item of output.limitations) lines.push(`- ${item}`);
  if (output.warnings.length) {
    lines.push("");
    lines.push("## Warnings");
    for (const item of output.warnings) lines.push(`- ${item}`);
  }

  return lines.join("\n");
}
