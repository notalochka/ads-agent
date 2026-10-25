import { afterEach, describe, expect, it } from "vitest";
import { getAppStatus } from "../../src/services/status.service.js";

describe("getAppStatus", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("reports missing keys in config-only mode", async () => {
    delete process.env.APIFY_TOKEN;
    delete process.env.GEMINI_API_KEY;
    process.env.ADS_SOURCE = "mock";
    process.env.LLM_PROVIDER = "mock";

    const status = await getAppStatus(false);
    expect(status.live).toBe(false);
    expect(status.apify.status).toBe("missing");
    expect(status.gemini.status).toBe("missing");
    expect(status.adsSource).toBe("mock");
  });

  it("reports configured when env vars are present (no live ping)", async () => {
    process.env.APIFY_TOKEN = "test-token-value";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.ADS_SOURCE = "mock";
    process.env.LLM_PROVIDER = "mock";

    const status = await getAppStatus(false);
    expect(status.apify.status).toBe("configured");
    expect(status.gemini.status).toBe("configured");
    expect(JSON.stringify(status)).not.toContain("test-token-value");
    expect(JSON.stringify(status)).not.toContain("test-gemini-key");
  });
});
