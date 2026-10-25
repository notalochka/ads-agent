export type ResearchRequest = {
  niche: string;
  country: string;
  competitors: string[];
  keywords?: string[];
  maxAds?: number;
};

export type Advertisement = {
  id: string;
  advertiser: string | null;
  headline: string | null;
  bodyText: string | null;
  cta: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  landingUrl: string | null;
  sourceUrl: string | null;
  platform: string | null;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "active" | "inactive" | "unknown";
};

export type CreativeAnalysis = {
  adId: string;
  hook: string | null;
  offer: string | null;
  cta: string | null;
  creativeAngle: string | null;
  persuasionTechnique: string | null;
  targetAudienceSignals: string[];
  confidence: "high" | "medium" | "low";
  uncertaintyNotes?: string[];
  evidence?: {
    sourceUrl: string | null;
    excerpt: string | null;
  };
};

export type RankedAd = {
  ad: Advertisement;
  analysis: CreativeAnalysis | null;
  score: number;
  scoreExplanation: string[];
  warnings: string[];
};

export type ToolTrace = {
  tool: string;
  status: "ok" | "error" | "skipped";
  durationMs: number;
  detail?: string;
};

export type CountShare = {
  name: string;
  count: number;
  pct: number;
};

export type CompetitorStat = {
  name: string;
  ads: number;
  active: number;
  avgScore: number;
  longestDays: number | null;
  videoPct: number;
};

export type MarketStats = {
  totals: {
    ads: number;
    active: number;
    inactive: number;
    competitors: number;
    avgObservedDays: number | null;
    withVideo: number;
    withImage: number;
    analyzedByAi: number;
  };
  formats: CountShare[];
  platforms: CountShare[];
  ctas: CountShare[];
  landings: Array<{ domain: string; count: number }>;
  competitors: CompetitorStat[];
};

export type MarketReport = {
  executiveSummary: string;
  topOffers: Array<{ group: string; who: string[]; examples: string[] }>;
  topHooks: Array<{ hook: string; type: string | null; who: string | null }>;
  angles: Array<{ angle: string; who: string[] }>;
  gaps: string[];
  recommendations: string[];
  readyIdeas: string[];
  provider: string;
  notes?: string[];
};

export type AgentOutput = {
  runId: string;
  status: "completed" | "partial" | "failed";
  request: ResearchRequest;
  searchQueriesUsed?: string[];
  adsFound: number;
  adsAnalyzed: number;
  rankedAds: RankedAd[];
  insights: {
    recurringHooks: string[];
    recurringOffers: string[];
    recurringCtas: string[];
    creativeAngles: string[];
    opportunitiesToTest: string[];
    marketStats?: MarketStats;
    marketReport?: MarketReport | null;
  };
  limitations: string[];
  warnings: string[];
  humanSummary: string;
  traceSummary?: {
    iterations: number;
    toolCalls: ToolTrace[];
    decision: string;
  };
};

export type ResearchResponse = {
  result: AgentOutput;
  markdownReport: string;
};
