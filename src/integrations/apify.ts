import { ApifyClient } from "apify-client";
import {
  AdvertisementSchema,
  type Advertisement,
} from "../schemas/advertisement.schema.js";
import { ExternalServiceError } from "../utils/errors.js";
import { childLogger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const log = childLogger({ component: "apify" });

export type ApifySearchParams = {
  queries: string[];
  country: string;
  competitors: string[];
  maxAds: number;
};

type UnknownRecord = Record<string, unknown>;

/** Common country names → Meta Ad Library country codes. */
const COUNTRY_ALIASES: Record<string, string> = {
  poland: "PL",
  польща: "PL",
  ukraine: "UA",
  україна: "UA",
  germany: "DE",
  німеччина: "DE",
  "united states": "US",
  usa: "US",
  us: "US",
  "united kingdom": "GB",
  uk: "GB",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  canada: "CA",
  brazil: "BR",
  india: "IN",
};

export function toCountryCode(country: string): string {
  const trimmed = country.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const mapped = COUNTRY_ALIASES[trimmed.toLowerCase()];
  return mapped ?? "ALL";
}

function isFacebookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname.includes("facebook.com") ||
      url.hostname.includes("fb.com") ||
      url.hostname.includes("instagram.com")
    );
  } catch {
    return false;
  }
}

/**
 * Builds Meta Ad Library / page start URLs for apify/facebook-ads-scraper.
 */
export function buildApifyStartUrls(params: {
  queries: string[];
  country: string;
  competitors: string[];
}): Array<{ url: string }> {
  const country = toCountryCode(params.country);
  const urls: string[] = [];

  for (const competitor of params.competitors) {
    const value = competitor.trim();
    if (!value) continue;
    if (isFacebookUrl(value)) {
      urls.push(value);
    } else if (/^[\w.-]+$/.test(value) && !value.includes(" ")) {
      // Likely a Facebook page slug
      urls.push(`https://www.facebook.com/${value}`);
    } else {
      urls.push(buildAdLibrarySearchUrl(value, country));
    }
  }

  for (const query of params.queries) {
    const value = query.trim();
    if (!value) continue;
    if (isFacebookUrl(value)) {
      urls.push(value);
    } else {
      urls.push(buildAdLibrarySearchUrl(value, country));
    }
  }

  const unique = Array.from(new Set(urls));
  return unique.slice(0, 8).map((url) => ({ url }));
}

export function buildAdLibrarySearchUrl(query: string, countryCode: string): string {
  const url = new URL("https://www.facebook.com/ads/library/");
  url.searchParams.set("active_status", "active");
  url.searchParams.set("ad_type", "all");
  url.searchParams.set("country", countryCode);
  url.searchParams.set("media_type", "all");
  url.searchParams.set("q", query);
  url.searchParams.set("search_type", "keyword_unordered");
  return url.toString();
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return null;
}

function pickImageUrl(snapshot: UnknownRecord | null): string | null {
  if (!snapshot) return null;

  const images = snapshot.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = asRecord(images[0]);
    const fromObject = first
      ? firstString(first.originalImageUrl, first.resizedImageUrl, first.url)
      : null;
    if (fromObject) return asUrl(fromObject);
    if (typeof images[0] === "string") return asUrl(images[0]);
  }

  const cards = snapshot.cards;
  if (Array.isArray(cards) && cards.length > 0) {
    const card = asRecord(cards[0]);
    if (card) {
      return asUrl(
        firstString(
          card.videoPreviewImageUrl,
          card.originalImageUrl,
          card.resizedImageUrl,
          card.imageUrl,
        ),
      );
    }
  }

  return asUrl(
    firstString(snapshot.videoPreviewImageUrl, snapshot.pageProfilePictureUrl),
  );
}

function pickVideoUrl(snapshot: UnknownRecord | null): string | null {
  if (!snapshot) return null;

  const direct = asUrl(
    firstString(
      snapshot.videoHdUrl,
      snapshot.videoSdUrl,
      snapshot.watermarkedVideoHdUrl,
      snapshot.watermarkedVideoSdUrl,
      snapshot.videoUrl,
    ),
  );
  if (direct) return direct;

  const videos = snapshot.videos;
  if (Array.isArray(videos) && videos.length > 0) {
    const first = asRecord(videos[0]);
    if (first) {
      const fromObject = asUrl(
        firstString(
          first.videoHdUrl,
          first.videoSdUrl,
          first.url,
          first.videoUrl,
        ),
      );
      if (fromObject) return fromObject;
    }
    if (typeof videos[0] === "string") return asUrl(videos[0]);
  }

  const cards = snapshot.cards;
  if (Array.isArray(cards) && cards.length > 0) {
    const card = asRecord(cards[0]);
    if (card) {
      return asUrl(
        firstString(
          card.videoHdUrl,
          card.videoSdUrl,
          card.watermarkedVideoHdUrl,
          card.watermarkedVideoSdUrl,
          card.videoUrl,
        ),
      );
    }
  }

  return null;
}

function pickBodyAndTitle(snapshot: UnknownRecord | null): {
  headline: string | null;
  bodyText: string | null;
  cta: string | null;
  landingUrl: string | null;
} {
  if (!snapshot) {
    return { headline: null, bodyText: null, cta: null, landingUrl: null };
  }

  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const firstCard = cards.length > 0 ? asRecord(cards[0]) : null;

  const headline = firstString(
    snapshot.title,
    firstCard?.title,
    snapshot.caption,
  );
  const bodyText = firstString(snapshot.body, firstCard?.body, snapshot.caption);
  const cta = firstString(
    snapshot.ctaText,
    firstCard?.ctaText,
    firstCard?.ctaType,
  );
  const landingUrl = asUrl(
    firstString(snapshot.linkUrl, firstCard?.linkUrl, snapshot.caption),
  );

  return { headline, bodyText, cta, landingUrl };
}

function pickPlatform(raw: UnknownRecord): string | null {
  const platforms = raw.publisherPlatform ?? raw.publisher_platform;
  if (Array.isArray(platforms) && platforms.length > 0) {
    return platforms.map(String).join(", ");
  }
  return asString(platforms);
}

function pickStatus(raw: UnknownRecord): Advertisement["status"] {
  if (typeof raw.isActive === "boolean") {
    return raw.isActive ? "active" : "inactive";
  }
  return "unknown";
}

/**
 * Maps one raw Apify Actor dataset item into our Advertisement schema.
 * Missing fields stay null – never invent spend/ROI/performance.
 */
export function normalizeApifyAd(
  raw: unknown,
  fallbackCountry: string | null = null,
): Advertisement | null {
  const item = asRecord(raw);
  if (!item) return null;

  const snapshot = asRecord(item.snapshot);
  const adId = firstString(
    item.adArchiveID,
    item.adArchiveId,
    item.id,
    item.ad_archive_id,
  );
  if (!adId) return null;

  const { headline, bodyText, cta, landingUrl } = pickBodyAndTitle(snapshot);
  const advertiser = firstString(
    snapshot?.pageName,
    item.pageName,
    item.page_name,
  );
  const sourceUrl =
    asUrl(item.adLibraryUrl) ??
    asUrl(item.url) ??
    `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`;

  const candidate = {
    id: adId,
    advertiser,
    headline,
    bodyText,
    cta,
    imageUrl: pickImageUrl(snapshot),
    videoUrl: pickVideoUrl(snapshot),
    landingUrl,
    sourceUrl,
    platform: pickPlatform(item),
    country: fallbackCountry,
    startDate: firstString(item.startDateFormatted, item.startDate, item.start_date),
    endDate: firstString(item.endDateFormatted, item.endDate, item.end_date),
    status: pickStatus(item),
  };

  const parsed = AdvertisementSchema.safeParse(candidate);
  if (!parsed.success) {
    log.warn(
      { adId, issues: parsed.error.issues.map((i) => i.message) },
      "Skipping malformed Apify ad",
    );
    return null;
  }
  return parsed.data;
}

export function normalizeApifyAds(
  items: unknown[],
  fallbackCountry: string | null = null,
  maxAds?: number,
): Advertisement[] {
  const ads: Advertisement[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const ad = normalizeApifyAd(item, fallbackCountry);
    if (!ad) continue;
    if (seen.has(ad.id)) continue;
    seen.add(ad.id);
    ads.push(ad);
    if (maxAds !== undefined && ads.length >= maxAds) break;
  }

  return ads;
}

function shouldRetryApify(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("rate") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("econnreset") ||
    message.includes("fetch failed")
  );
}

/**
 * Fetches public ads via Apify Actor `apify/facebook-ads-scraper` (configurable).
 */
export async function fetchAdsFromApify(
  params: ApifySearchParams,
): Promise<Advertisement[]> {
  const token = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID ?? "apify/facebook-ads-scraper";

  if (!token) {
    throw new ExternalServiceError("Apify", "APIFY_TOKEN is not configured");
  }

  const startUrls = buildApifyStartUrls(params);
  if (startUrls.length === 0) {
    throw new ExternalServiceError(
      "Apify",
      "No start URLs could be built from the research request",
    );
  }

  const countryCode = toCountryCode(params.country);
  const resultsLimit = Math.max(1, Math.min(params.maxAds, 50));

  const input = {
    startUrls,
    resultsLimit,
    activeStatus: "active",
    isDetailsPerAd: true,
    onlyTotal: false,
  };

  log.info(
    { actorId, startUrls: startUrls.map((s) => s.url), resultsLimit, countryCode },
    "Starting Apify Actor run",
  );

  const client = new ApifyClient({ token });

  try {
    const items = await withRetry(
      async (attempt) => {
        log.info({ attempt, actorId }, "Apify actor.call");
        const run = await client.actor(actorId).call(input, {
          waitSecs: Number.parseInt(process.env.APIFY_WAIT_SECS ?? "120", 10),
        });

        if (!run?.defaultDatasetId) {
          throw new ExternalServiceError(
            "Apify",
            "Actor finished without a default dataset",
            { runId: run?.id },
          );
        }

        const { items: datasetItems } = await client
          .dataset(run.defaultDatasetId)
          .listItems({ limit: resultsLimit });

        return datasetItems as unknown[];
      },
      {
        retries: 2,
        delayMs: 1500,
        shouldRetry: shouldRetryApify,
      },
    );

    const ads = normalizeApifyAds(items, countryCode, params.maxAds);
    log.info(
      { rawCount: items.length, normalizedCount: ads.length },
      "Apify ads normalized",
    );
    return ads;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    const message = error instanceof Error ? error.message : "Unknown Apify error";
    throw new ExternalServiceError("Apify", message);
  }
}
