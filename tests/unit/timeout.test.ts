import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "../../src/utils/timeout.js";

describe("withTimeout", () => {
  it("resolves when work finishes before timeout", async () => {
    const value = await withTimeout(
      Promise.resolve("ok"),
      1000,
      "fast",
    );
    expect(value).toBe("ok");
  });

  it("rejects with TimeoutError when work is too slow", async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 200);
    });

    await expect(withTimeout(slow, 50, "slow-op")).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});
