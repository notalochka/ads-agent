import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp();

app.listen(port, () => {
  logger.info(
    {
      port,
      adsSource: process.env.ADS_SOURCE ?? "mock",
      llmProvider: process.env.LLM_PROVIDER ?? "mock",
    },
    "ads-agent API listening",
  );
});
