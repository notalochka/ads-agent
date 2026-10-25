import type {
  ResearchRequest,
  ResearchResponse,
} from "../types/research";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type HealthInfo = {
  ok: boolean;
  service?: string;
  adsSource?: string;
  llmProvider?: string;
};

export type CredStatus = "configured" | "missing" | "ok" | "error" | "skipped";

export type ServiceStatus = {
  status: CredStatus;
  message: string;
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

export async function fetchHealth(): Promise<HealthInfo> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return (await response.json()) as HealthInfo;
}

export async function fetchStatus(live = false): Promise<AppStatus> {
  const query = live ? "?live=1" : "";
  const response = await fetch(`${API_BASE}/api/status${query}`);
  if (!response.ok) {
    throw new Error(`Status check failed (${response.status})`);
  }
  return (await response.json()) as AppStatus;
}

/**
 * Runs research via a single POST and waits for the full JSON response.
 */
export async function runResearch(
  request: ResearchRequest,
): Promise<ResearchResponse> {
  const response = await fetch(`${API_BASE}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    const code = body?.error?.code ? ` [${body.error.code}]` : "";
    throw new Error(
      `${body?.error?.message ?? `Request failed (${response.status})`}${code}`,
    );
  }

  return (await response.json()) as ResearchResponse;
}
