/**
 * Cheap credential check – does NOT run Apify Actors or analyze ads.
 *
 * Usage: npm run check:creds
 *
 * - Apify: client.user().get() (+ optional limits)
 * - Gemini: models.get for primary + each fallback
 */
import "dotenv/config";
import { ApifyClient } from "apify-client";
import { GoogleGenAI } from "@google/genai";
import { resolveGeminiModelChain } from "../src/integrations/llm.js";

type CheckResult = {
  service: "apify" | "gemini";
  status: "ok" | "skip" | "error";
  message: string;
  details?: Record<string, unknown>;
};

function mask(value: string | undefined): string {
  if (!value) return "(empty)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)} (len=${value.length})`;
}

async function checkApify(): Promise<CheckResult> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return {
      service: "apify",
      status: "skip",
      message: "APIFY_TOKEN is empty – skipped (ok for mock mode)",
    };
  }

  try {
    const client = new ApifyClient({ token });
    const user = await client.user().get();
    const limits = await client.user().limits().catch(() => undefined);

    return {
      service: "apify",
      status: "ok",
      message: "Token accepted (no Actor run)",
      details: {
        token: mask(token),
        username: user?.username ?? null,
        plan: user?.plan?.id ?? user?.plan ?? null,
        actorId: process.env.APIFY_ACTOR_ID ?? "apify/facebook-ads-scraper",
        maxMonthlyUsageUsd: limits?.limits?.maxMonthlyUsageUsd ?? null,
      },
    };
  } catch (error) {
    return {
      service: "apify",
      status: "error",
      message: error instanceof Error ? error.message : "Apify check failed",
      details: { token: mask(token) },
    };
  }
}

async function checkGemini(): Promise<CheckResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelChain = resolveGeminiModelChain();

  if (!apiKey) {
    return {
      service: "gemini",
      status: "skip",
      message: "GEMINI_API_KEY is empty – skipped (ok for mock mode)",
      details: { modelChain },
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelChecks: Array<{
      model: string;
      ok: boolean;
      displayName?: string | null;
      error?: string;
    }> = [];

    for (const model of modelChain) {
      try {
        const info = await ai.models.get({ model });
        modelChecks.push({
          model,
          ok: true,
          displayName: info.displayName ?? info.name ?? null,
        });
      } catch (error) {
        modelChecks.push({
          model,
          ok: false,
          error: error instanceof Error ? error.message : "failed",
        });
      }
    }

    const available = modelChecks.filter((m) => m.ok).map((m) => m.model);
    if (available.length === 0) {
      return {
        service: "gemini",
        status: "error",
        message: "API key present, but no models in the chain are available",
        details: { apiKey: mask(apiKey), modelChain, modelChecks },
      };
    }

    return {
      service: "gemini",
      status: "ok",
      message: `API key accepted – ${available.length}/${modelChain.length} models reachable`,
      details: {
        apiKey: mask(apiKey),
        primary: modelChain[0],
        available,
        modelChecks,
      },
    };
  } catch (error) {
    return {
      service: "gemini",
      status: "error",
      message: error instanceof Error ? error.message : "Gemini check failed",
      details: { apiKey: mask(apiKey), modelChain },
    };
  }
}

async function main() {
  console.log("Credential check (cheap – no Apify Actor, no LLM generation)\n");
  console.log(
    `Dev modes: ADS_SOURCE=${process.env.ADS_SOURCE ?? "mock"} | LLM_PROVIDER=${process.env.LLM_PROVIDER ?? "mock"}\n`,
  );

  const results = await Promise.all([checkApify(), checkGemini()]);

  for (const result of results) {
    const icon =
      result.status === "ok" ? "OK" : result.status === "skip" ? "SKIP" : "FAIL";
    console.log(`[${icon}] ${result.service}: ${result.message}`);
    if (result.details) {
      console.log(JSON.stringify(result.details, null, 2));
    }
    console.log("");
  }

  const failed = results.some((r) => r.status === "error");
  if (failed) {
    console.error("One or more credential checks failed.");
    process.exit(1);
  }

  const anyOk = results.some((r) => r.status === "ok");
  if (!anyOk) {
    console.log(
      "No live credentials configured. Mock mode is fine for algorithm work.",
    );
  } else {
    console.log(
      "Credentials look valid. Keep ADS_SOURCE=mock / LLM_PROVIDER=mock until the agent flow is ready.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
