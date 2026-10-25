import type { AgentOutput } from "../types/research";

type TracePanelProps = {
  trace?: AgentOutput["traceSummary"];
  queries?: string[];
};

export function TracePanel({ trace, queries }: TracePanelProps) {
  if (!trace) {
    return (
      <section className="panel">
        <h2>Agent trace</h2>
        <p className="muted">No trace available for this run.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Agent trace</h2>
      <p className="muted">
        Iterations: {trace.iterations} · Decision: {trace.decision}
      </p>

      {queries && queries.length > 0 ? (
        <p>
          <strong>Queries used:</strong> {queries.join(" · ")}
        </p>
      ) : null}

      <div className="trace-list">
        {trace.toolCalls.map((call, index) => (
          <div className="trace-item" key={`${call.tool}-${index}`}>
            <div className="trace-item-head">
              <strong>{call.tool}</strong>
              <span className={`status-pill status-${call.status}`}>
                {call.status}
              </span>
              <span className="muted">{call.durationMs} ms</span>
            </div>
            {call.detail ? <p className="muted trace-detail">{call.detail}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
