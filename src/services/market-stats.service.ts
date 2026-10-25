import type { RankedAd } from "../schemas/advertisement.schema.js";
import {
  MarketStatsSchema,
  type MarketStats,
} from "../schemas/insights.schema.js";

function calcDays(
  startDate: string | null,
  endDate: string | null,
): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function bump(map: Map<string, number>, key: string) {
  const normalized = key.trim() || "unknown";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toShareList(map: Map<string, number>, total: number, limit = 12) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function landingDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Deterministic market overview from ranked ads (no LLM).
 */
export function buildMarketStats(rankedAds: RankedAd[]): MarketStats {
  const total = rankedAds.length;
  const active = rankedAds.filter((r) => r.ad.status === "active").length;
  const inactive = rankedAds.filter((r) => r.ad.status === "inactive").length;
  const withVideo = rankedAds.filter((r) => Boolean(r.ad.videoUrl)).length;
  const withImage = rankedAds.filter(
    (r) => Boolean(r.ad.imageUrl) && !r.ad.videoUrl,
  ).length;
  const analyzedByAi = rankedAds.filter((r) => r.analysis != null).length;

  const days = rankedAds
    .map((r) => calcDays(r.ad.startDate, r.ad.endDate))
    .filter((d): d is number => d != null);
  const avgObservedDays =
    days.length > 0
      ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
      : null;

  const formatMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const ctaMap = new Map<string, number>();
  const landingMap = new Map<string, number>();

  for (const item of rankedAds) {
    if (item.ad.videoUrl) bump(formatMap, "Video");
    else if (item.ad.imageUrl) bump(formatMap, "Image");
    else bump(formatMap, "Unknown / text-only");

    const platforms = (item.ad.platform ?? "unknown")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (platforms.length === 0) bump(platformMap, "unknown");
    else for (const p of platforms) bump(platformMap, p);

    const cta = item.analysis?.cta ?? item.ad.cta ?? "n/a";
    bump(ctaMap, cta);

    const domain = landingDomain(item.ad.landingUrl);
    if (domain) bump(landingMap, domain);
  }

  const byAdvertiser = new Map<string, RankedAd[]>();
  for (const item of rankedAds) {
    const name = item.ad.advertiser?.trim() || "Unknown advertiser";
    const list = byAdvertiser.get(name) ?? [];
    list.push(item);
    byAdvertiser.set(name, list);
  }

  const competitors = Array.from(byAdvertiser.entries())
    .map(([name, ads]) => {
      const activeCount = ads.filter((a) => a.ad.status === "active").length;
      const avgScore =
        ads.length === 0
          ? 0
          : Math.round(
              (ads.reduce((sum, a) => sum + a.score, 0) / ads.length) * 10,
            ) / 10;
      const longestDays =
        ads
          .map((a) => calcDays(a.ad.startDate, a.ad.endDate))
          .filter((d): d is number => d != null)
          .sort((a, b) => b - a)[0] ?? null;
      const videoCount = ads.filter((a) => Boolean(a.ad.videoUrl)).length;
      return {
        name,
        ads: ads.length,
        active: activeCount,
        avgScore,
        longestDays,
        videoPct: pct(videoCount, ads.length),
      };
    })
    .sort((a, b) => b.ads - a.ads || b.avgScore - a.avgScore);

  return MarketStatsSchema.parse({
    totals: {
      ads: total,
      active,
      inactive,
      competitors: competitors.length,
      avgObservedDays,
      withVideo,
      withImage,
      analyzedByAi,
    },
    formats: toShareList(formatMap, total),
    platforms: toShareList(platformMap, total),
    ctas: toShareList(ctaMap, total),
    landings: Array.from(landingMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    competitors,
  });
}
