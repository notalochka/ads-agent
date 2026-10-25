/**
 * Optional live smoke test against Gemini.
 * Usage: set GEMINI_API_KEY in .env, then `npm run smoke:gemini`
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLlmProvider } from "../src/integrations/llm.js";
import { AdvertisementSchema } from "../src/schemas/advertisement.schema.js";

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "GEMINI_API_KEY is missing. Copy .env.example → .env and set the key.",
    );
    process.exit(1);
  }

  process.env.LLM_PROVIDER = "gemini";

  const fixturePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../tests/fixtures/ads.fixture.json",
  );
  const raw = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
  const ads = AdvertisementSchema.array().parse(raw).slice(0, 2);

  const provider = createLlmProvider("gemini");
  const analyses = await provider.analyzeCreatives(ads);

  console.log(
    JSON.stringify(
      {
        provider: provider.name,
        model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
        count: analyses.length,
        sample: analyses,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
