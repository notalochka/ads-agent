import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { StatusBar } from "../components/StatusBar";
import { runResearch } from "../services/research-api";
import { loadResearch, saveResearch } from "../services/research-storage";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ResearchPage() {
  const navigate = useNavigate();
  const [niche, setNiche] = useState("online education");
  const [country, setCountry] = useState("Poland");
  const [competitors, setCompetitors] = useState("Learnify Online, SkillSprint");
  const [keywords, setKeywords] = useState("english course");
  const [maxAds, setMaxAds] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPrevious = Boolean(loadResearch());

  function clearFields() {
    setNiche("");
    setCountry("");
    setCompetitors("");
    setKeywords("");
    setMaxAds(10);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await runResearch({
        niche: niche.trim(),
        country: country.trim(),
        competitors: splitCsv(competitors),
        keywords: splitCsv(keywords),
        maxAds,
      });
      saveResearch(response);
      navigate("/report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-stack">
      <div>
        <h2>New research</h2>
      </div>

      <StatusBar />

      <form className="panel form-grid" onSubmit={onSubmit}>
        <label>
          Niche
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            required
            minLength={2}
          />
        </label>
        <label>
          Country
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            minLength={2}
          />
        </label>
        <label className="span-2">
          Competitors (comma-separated)
          <input
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
          />
        </label>
        <label className="span-2">
          Keywords (comma-separated)
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </label>
        <label>
          Max ads
          <input
            type="number"
            min={1}
            max={50}
            value={maxAds}
            onChange={(e) => setMaxAds(Number(e.target.value) || 10)}
          />
        </label>

        <div className="form-actions span-2">
          <button type="submit" disabled={loading}>
            {loading ? "Running…" : "Run agent"}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={loading}
            onClick={clearFields}
          >
            Clear fields
          </button>
          {hasPrevious ? (
            <Link className="button-link" to="/report">
              Open last report
            </Link>
          ) : null}
        </div>
      </form>

      {loading ? <LoadingState /> : null}
      {error ? (
        <div className="panel error-panel" role="alert">
          <strong>Request failed</strong>
          <p>{error}</p>
        </div>
      ) : null}
    </section>
  );
}
