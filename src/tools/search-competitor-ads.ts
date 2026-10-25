import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AdvertisementSchema,
  type Advertisement,
} from "../schemas/advertisement.schema.js";
import { fetchAdsFromApify } from "../integrations/apify.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger({ component: "tool:searchCompetitorAds" });

export type SearchCompetitorAdsInput = {
  queries: string[];
  country: string;
  competitors: string[];
  maxAds: number;
};

export type SearchCompetitorAdsResult = {
  ads: Advertisement[];
  source: "mock" | "apify";
  queryCount: number;
};

function fixturesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../tests/fixtures");
}

async function loadMockAds(maxAds: number): Promise<Advertisement[]> {
  const filePath = path.join(fixturesDir(), "ads.fixture.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const ads = AdvertisementSchema.array().parse(parsed);
  return ads.slice(0, maxAds);
}

/**
 * Tool: searchCompetitorAds
 * Fetches public ads via Apify or mock fixtures, then returns normalized records.
 */
export async function searchCompetitorAds(
  input: SearchCompetitorAdsInput,
): Promise<SearchCompetitorAdsResult> {
  const mode = process.env.ADS_SOURCE ?? "mock";
  const maxAds = input.maxAds;

  log.info({ mode, maxAds, queries: input.queries }, "searchCompetitorAds start");

  if (mode === "apify") {
    const ads = await fetchAdsFromApify({
      queries: input.queries,
      country: input.country,
      competitors: input.competitors,
      maxAds,
    });
    return { ads, source: "apify", queryCount: input.queries.length };
  }

  const ads = await loadMockAds(maxAds);
  return { ads, source: "mock", queryCount: input.queries.length };
}
