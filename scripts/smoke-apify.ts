/**
 * Optional live smoke test against Apify.
 * Usage: set APIFY_TOKEN in .env, then `npm run smoke:apify`
 */
import "dotenv/config";
import { fetchAdsFromApify } from "../src/integrations/apify.js";

async function main() {
  if (!process.env.APIFY_TOKEN) {
    console.error(
      "APIFY_TOKEN is missing. Copy .env.example → .env and set the token.",
    );
    process.exit(1);
  }

  const ads = await fetchAdsFromApify({
    queries: ["online education"],
    country: "Poland",
    competitors: [],
    maxAds: 5,
  });

  console.log(
    JSON.stringify({ count: ads.length, sample: ads.slice(0, 2) }, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
