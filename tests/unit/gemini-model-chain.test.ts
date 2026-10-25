import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_FALLBACKS,
  DEFAULT_GEMINI_MODEL,
  isGeminiModelFallbackError,
  normalizeGeminiModelId,
  resolveGeminiModelChain,
} from "../../src/integrations/llm.js";

describe("gemini model chain", () => {
  afterEach(() => {
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL_FALLBACKS;
  });

  it("aliases gemini-3.1-flash to flash-lite", () => {
    expect(normalizeGeminiModelId("gemini-3.1-flash")).toBe(
      "gemini-3.1-flash-lite",
    );
  });

  it("uses 3.1-flash-lite primary with default fallbacks", () => {
    const chain = resolveGeminiModelChain();
    expect(chain[0]).toBe(DEFAULT_GEMINI_MODEL);
    expect(chain).toEqual([
      DEFAULT_GEMINI_MODEL,
      ...DEFAULT_GEMINI_FALLBACKS,
    ]);
  });

  it("respects custom primary + fallbacks from env", () => {
    process.env.GEMINI_MODEL = "gemini-3.1-flash";
    process.env.GEMINI_MODEL_FALLBACKS =
      "gemini-3.6-flash, gemini-2.0-flash, gemini-3.1-flash-lite";

    expect(resolveGeminiModelChain()).toEqual([
      "gemini-3.1-flash-lite",
      "gemini-3.6-flash",
      "gemini-2.0-flash",
    ]);
  });

  it("detects fallback-worthy errors", () => {
    expect(isGeminiModelFallbackError(new Error("Model not found"))).toBe(true);
    expect(isGeminiModelFallbackError(new Error("429 RESOURCE_EXHAUSTED"))).toBe(
      true,
    );
    expect(
      isGeminiModelFallbackError(new Error("Model JSON failed schema validation")),
    ).toBe(false);
  });
});
