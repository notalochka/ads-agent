import type {
  AgentOutput,
  CountShare,
  MarketReport,
  MarketStats,
} from "../types/research";

type InsightsPanelProps = {
  insights: AgentOutput["insights"];
};

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="muted">n/a</span>;
  return (
    <div className="chip-row">
      {items.map((item) => (
        <span className="chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ShareBars({ items, empty = "n/a" }: { items: CountShare[]; empty?: string }) {
  if (items.length === 0) return <span className="muted">{empty}</span>;
  return (
    <ul className="share-list">
      {items.map((item) => (
        <li key={item.name}>
          <div className="share-meta">
            <span>{item.name}</span>
            <span className="muted">
              {item.pct}% · {item.count}
            </span>
          </div>
          <div className="share-track" aria-hidden>
            <div className="share-fill" style={{ width: `${Math.min(100, item.pct)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KpiCards({ stats }: { stats: MarketStats }) {
  const cards = [
    { label: "Ads collected", value: stats.totals.ads },
    { label: "Active now", value: stats.totals.active },
    { label: "Competitors", value: stats.totals.competitors },
    {
      label: "Avg days live",
      value: stats.totals.avgObservedDays ?? "–",
    },
    { label: "Analyzed by AI", value: stats.totals.analyzedByAi },
  ];

  return (
    <div className="kpi-row">
      {cards.map((card) => (
        <div className="kpi-card" key={card.label}>
          <div className="kpi-value">{card.value}</div>
          <div className="kpi-label">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

function MarketOverview({ stats }: { stats: MarketStats }) {
  return (
    <div className="insights-section">
      <h3>Market overview</h3>
      <p className="muted">Deterministic counts from the collected sample – no LLM.</p>
      <KpiCards stats={stats} />

      {stats.competitors.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Competitor</th>
                <th>Ads</th>
                <th>Active</th>
                <th>Avg score</th>
                <th>Longest (days)</th>
                <th>Video %</th>
              </tr>
            </thead>
            <tbody>
              {stats.competitors.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.ads}</td>
                  <td>{row.active}</td>
                  <td>{row.avgScore}</td>
                  <td>{row.longestDays ?? "–"}</td>
                  <td>{row.videoPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="dist-grid">
        <div>
          <h4>Formats</h4>
          <ShareBars items={stats.formats} />
        </div>
        <div>
          <h4>Platforms</h4>
          <ShareBars items={stats.platforms} />
        </div>
        <div>
          <h4>CTA buttons</h4>
          <ShareBars items={stats.ctas} />
        </div>
        <div>
          <h4>Landing domains</h4>
          {stats.landings.length === 0 ? (
            <span className="muted">n/a</span>
          ) : (
            <ul className="plain-list">
              {stats.landings.map((row) => (
                <li key={row.domain}>
                  <span>{row.domain}</span>
                  <span className="muted">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AiMarketReport({ report }: { report: MarketReport }) {
  return (
    <div className="insights-section market-report">
      <div className="report-head">
        <h3>AI market report</h3>
        <span className="chip muted-chip">{report.provider}</span>
      </div>

      <p className="report-summary">{report.executiveSummary}</p>

      {report.topOffers.length > 0 ? (
        <>
          <h4>Top offers</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Offer group</th>
                  <th>Who</th>
                  <th>How it&apos;s phrased</th>
                </tr>
              </thead>
              <tbody>
                {report.topOffers.map((row) => (
                  <tr key={row.group}>
                    <td>{row.group}</td>
                    <td>{row.who.join(", ") || "–"}</td>
                    <td>{row.examples.join(" · ") || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {report.topHooks.length > 0 ? (
        <>
          <h4>Top hooks</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hook</th>
                  <th>Type</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {report.topHooks.map((row) => (
                  <tr key={`${row.who ?? ""}-${row.hook}`}>
                    <td>{row.hook}</td>
                    <td>{row.type ?? "–"}</td>
                    <td>{row.who ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {report.angles.length > 0 ? (
        <>
          <h4>Angles</h4>
          <ul className="plain-list stacked">
            {report.angles.map((row) => (
              <li key={row.angle}>
                <strong>{row.angle}</strong>
                <span className="muted">{row.who.join(", ") || "–"}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {report.gaps.length > 0 ? (
        <>
          <h4>Gaps &amp; weak spots</h4>
          <ol className="report-list">
            {report.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </>
      ) : null}

      {report.recommendations.length > 0 ? (
        <>
          <h4>Recommendations</h4>
          <ol className="report-list">
            {report.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </>
      ) : null}

      {report.readyIdeas.length > 0 ? (
        <>
          <h4>Ready-made ideas</h4>
          <ul className="report-list">
            {report.readyIdeas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {report.notes && report.notes.length > 0 ? (
        <p className="muted notes-line">{report.notes.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const stats = insights.marketStats;
  const report = insights.marketReport;

  return (
    <section className="panel insights-panel">
      <h2>Creative insights</h2>
      <p className="muted">
        Sample-limited overview: deterministic market stats plus one AI market
        synthesis call. Not full-market truth.
      </p>

      {stats ? <MarketOverview stats={stats} /> : null}
      {report ? <AiMarketReport report={report} /> : null}

      <div className="insights-section">
        <h3>Recurring signals</h3>
        <div className="insights-grid">
          <div>
            <h4>Hooks</h4>
            <ChipList items={insights.recurringHooks} />
          </div>
          <div>
            <h4>Offers</h4>
            <ChipList items={insights.recurringOffers} />
          </div>
          <div>
            <h4>CTAs</h4>
            <ChipList items={insights.recurringCtas} />
          </div>
          <div>
            <h4>Angles</h4>
            <ChipList items={insights.creativeAngles} />
          </div>
        </div>
      </div>

      {insights.opportunitiesToTest.length > 0 ? (
        <div className="insights-section">
          <h3>Opportunities to test</h3>
          <ul className="report-list">
            {insights.opportunitiesToTest.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
