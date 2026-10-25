import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdsGrid } from "../components/AdsGrid";
import { InsightsPanel } from "../components/InsightsPanel";
import { TracePanel } from "../components/TracePanel";
import { clearResearch, loadResearch } from "../services/research-storage";

type TabId = "summary" | "ads" | "insights" | "trace";

export function ReportPage() {
  const data = useMemo(() => loadResearch(), []);
  const [tab, setTab] = useState<TabId>("summary");

  if (!data) {
    return (
      <section className="panel">
        <h2>No report yet</h2>
        <p className="muted">Run a research request first.</p>
        <Link to="/">Start research</Link>
      </section>
    );
  }

  const { result, markdownReport } = data;

  return (
    <section className="page-stack">
      <div className="panel report-hero">
        <div>
          <h2>Market report</h2>
          <p className="muted">
            Run <code>{result.runId}</code> ·{" "}
            <span className={`status-pill status-${result.status}`}>
              {result.status}
            </span>{" "}
            · {result.adsFound} ads found · {result.adsAnalyzed} analyzed
          </p>
        </div>
        <div className="form-actions">
          <Link className="button-link" to="/">
            New research
          </Link>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              clearResearch();
              window.location.href = "/";
            }}
          >
            Clear report
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Report sections">
        {(
          [
            ["summary", "Summary"],
            ["ads", "Ads explorer"],
            ["insights", "Insights"],
            ["trace", "Agent trace"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={tab === id ? "tab active" : "tab"}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <div className="page-stack">
          <div className="panel">
            <h3>Summary</h3>
            <p>{result.humanSummary}</p>
            <p className="muted">
              Scope: {result.request.niche} / {result.request.country}
              {result.request.competitors.length
                ? ` · competitors: ${result.request.competitors.join(", ")}`
                : ""}
            </p>
          </div>

          {result.warnings.length > 0 ? (
            <div className="panel warn-panel">
              <h3>Warnings</h3>
              <ul>
                {result.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.limitations.length > 0 ? (
            <div className="panel">
              <h3>Limitations</h3>
              <ul>
                {result.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="panel">
            <summary>Markdown report</summary>
            <pre className="markdown-block">{markdownReport}</pre>
          </details>
        </div>
      ) : null}

      {tab === "ads" ? (
        <div>
          <h3>Ads explorer</h3>
          <p className="muted">
            Compact cards in the grid. Click a card to open the full detail
            window (Apify / Ad Library facts). Use the arrow inside the window
            for AI creative analysis.
          </p>
          <AdsGrid items={result.rankedAds} />
        </div>
      ) : null}

      {tab === "insights" ? <InsightsPanel insights={result.insights} /> : null}

      {tab === "trace" ? (
        <TracePanel
          trace={result.traceSummary}
          queries={result.searchQueriesUsed}
        />
      ) : null}
    </section>
  );
}
