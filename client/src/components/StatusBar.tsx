import { useCallback, useEffect, useState } from "react";
import {
  fetchStatus,
  type AppStatus,
  type CredStatus,
} from "../services/research-api";

function labelFor(status: CredStatus): string {
  switch (status) {
    case "ok":
      return "ok";
    case "configured":
      return "set";
    case "missing":
      return "missing";
    case "error":
      return "error";
    case "skipped":
      return "skip";
    default:
      return status;
  }
}

function toneFor(status: CredStatus): string {
  if (status === "ok" || status === "configured") return "status-ok";
  if (status === "error") return "status-error";
  if (status === "missing") return "status-partial";
  return "";
}

export function StatusBar() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (live: boolean) => {
    setChecking(true);
    setError(null);
    try {
      const next = await fetchStatus(live);
      setStatus(next);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Status check failed");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (error && !status) {
    return (
      <div className="panel status-bar">
        <p className="health-bad">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="panel status-bar">
        <p className="muted">Loading status…</p>
      </div>
    );
  }

  return (
    <div className="panel status-bar">
      <div className="status-bar-main">
        <p className="health-ok">
          API ok · ads=<code>{status.adsSource}</code> · llm=
          <code>{status.llmProvider}</code>
          {status.live ? " · live check" : " · config only"}
        </p>
        <div className="status-keys">
          <span className={`status-pill ${toneFor(status.apify.status)}`}>
            Apify {labelFor(status.apify.status)}
          </span>
          <span className={`status-pill ${toneFor(status.gemini.status)}`}>
            Gemini {labelFor(status.gemini.status)}
          </span>
        </div>
      </div>

      <div className="status-bar-actions">
        <button
          type="button"
          className="button-secondary"
          disabled={checking}
          onClick={() => void load(true)}
        >
          {checking ? "Checking…" : "Check credentials"}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={checking}
          onClick={() => void load(false)}
        >
          Refresh
        </button>
      </div>

      {status.live ? (
        <div className="status-details muted">
          <p>{status.apify.message}</p>
          <p>{status.gemini.message}</p>
          {status.apify.meta?.username ? (
            <p>Apify user: {String(status.apify.meta.username)}</p>
          ) : null}
          {status.gemini.meta?.primaryModel ? (
            <p>Gemini model: {String(status.gemini.meta.primaryModel)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
