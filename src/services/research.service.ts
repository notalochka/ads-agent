import { runResearchAgent } from "../agent/orchestrator.js";
import type { AgentOutput } from "../schemas/agent-output.schema.js";
import type { ProgressReporter } from "../schemas/progress.schema.js";
import {
  ResearchRequestSchema,
  type ResearchRequest,
} from "../schemas/research.schema.js";
import { buildMarkdownReport } from "./report.service.js";
import {
  resolveRequestTimeoutMs,
  withTimeout,
} from "../utils/timeout.js";

export type ResearchResponse = {
  result: AgentOutput;
  markdownReport: string;
};

export type ExecuteResearchOptions = {
  onProgress?: ProgressReporter;
};

export async function executeResearch(
  rawInput: unknown,
  options: ExecuteResearchOptions = {},
): Promise<ResearchResponse> {
  const request: ResearchRequest = ResearchRequestSchema.parse(rawInput);
  const timeoutMs = resolveRequestTimeoutMs();

  const result = await withTimeout(
    runResearchAgent(request, { onProgress: options.onProgress }),
    timeoutMs,
    "research agent",
  );

  options.onProgress?.({
    stage: "report",
    message: "Formatting markdown report…",
    adsFound: result.adsFound,
  });

  const markdownReport = buildMarkdownReport(result);
  return { result, markdownReport };
}
