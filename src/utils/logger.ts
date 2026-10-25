import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  base: { service: "ads-agent" },
  redact: {
    paths: [
      "req.headers.authorization",
      "APIFY_TOKEN",
      "GEMINI_API_KEY",
      "*.apiKey",
      "*.token",
    ],
    remove: true,
  },
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
