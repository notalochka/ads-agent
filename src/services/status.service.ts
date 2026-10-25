import { ApifyClient } from "apify-client";
import { GoogleGenAI } from "@google/genai";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModelChain,
} from "../integrations/llm.js";

export type CredStatus = "configured" | "missing" | "ok" | "error" | "skipped";

export type ServiceStatus = {
  status: CredStatus;
  message: string;
  /** Safe public details only – never tokens/keys */
  meta?: Record<string, unknown>;
};

export type AppStatus = {
  ok: boolean;
  service: string;
  adsSource: string;
  llmProvider: string;
  geminiModel: string;
  live: boolean;
  apify: ServiceStatus;
  gemini: ServiceStatus;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function configOnlyStatus(): AppStatus {
  const apifyConfigured = hasValue(process.env.APIFY_TOKEN);
  const geminiConfigured = hasValue(process.env.GEMINI_API_KEY);
  const modelChain = resolveGeminiModelChain();

  return {
    ok: true,
    service: "ads-agent",
    adsSource: process.env.ADS_SOURCE ?? "mock",
    llmProvider: process.env.LLM_PROVIDER ?? "mock",
    geminiModel: modelChain[0] ?? DEFAULT_GEMINI_MODEL,
    live: false,
    apify: apifyConfigured
      ? {
          status: "configured",
          message: "APIFY_TOKEN is set (not live-checked)",
        }
      : {
          status: "missing",
          message: "APIFY_TOKEN is empty – mock ads mode is fine",
        },
    gemini: geminiConfigured
      ? {
          status: "configured",
          message: "GEMINI_API_KEY is set (not live-checked)",
          meta: { primaryModel: modelChain[0] },
        }
      : {
          status: "missing",
          message: "GEMINI_API_KEY is empty – mock LLM mode is fine",
        },
  };
}

async function checkApifyLive(): Promise<ServiceStatus> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return {
      status: "missing",
      message: "APIFY_TOKEN is empty",
    };
  }

  try {
    const client = new ApifyClient({ token });
    const user = await client.user().get();
    return {
      status: "ok",
      message: "Apify token accepted (no Actor run)",
      meta: {
        username: user?.username ?? null,
        plan: user?.plan?.id ?? null,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Apify check failed",
    };
  }
}

async function checkGeminiLive(): Promise<ServiceStatus> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelChain = resolveGeminiModelChain();
  const primary = modelChain[0] ?? DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    return {
      status: "missing",
      message: "GEMINI_API_KEY is empty",
      meta: { primaryModel: primary },
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Cheap metadata call only – no generateContent
    const info = await ai.models.get({ model: primary });
    return {
      status: "ok",
      message: "Gemini API key accepted (no generation)",
      meta: {
        primaryModel: primary,
        displayName: info.displayName ?? info.name ?? null,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Gemini check failed",
      meta: { primaryModel: primary },
    };
  }
}

/**
 * Status for UI / ops.
 * - live=false: instant, checks only whether env vars are present
 * - live=true: cheap provider pings (no Apify Actor, no Gemini generateContent)
 */
export async function getAppStatus(live = false): Promise<AppStatus> {
  if (!live) {
    return configOnlyStatus();
  }

  const [apify, gemini] = await Promise.all([
    checkApifyLive(),
    checkGeminiLive(),
  ]);

  const base = configOnlyStatus();
  return {
    ...base,
    live: true,
    apify,
    gemini,
    ok: apify.status !== "error" && gemini.status !== "error",
  };
}
