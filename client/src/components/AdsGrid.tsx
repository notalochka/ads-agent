import { useMemo, useState } from "react";
import type { RankedAd } from "../types/research";
import { calcObservedDays } from "../utils/ad-dates";
import { AdCard } from "./AdCard";
import { AdDetailModal } from "./AdDetailModal";

type AdsGridProps = {
  items: RankedAd[];
};

type SortMode =
  | "score-desc"
  | "score-asc"
  | "days-desc"
  | "days-asc"
  | "started-desc"
  | "started-asc"
  | "advertiser-asc";

function observedDays(item: RankedAd): number {
  return (
    calcObservedDays(item.ad.startDate, item.ad.endDate, item.ad.status) ?? -1
  );
}

function startTimestamp(item: RankedAd): number {
  if (!item.ad.startDate) return 0;
  const t = new Date(item.ad.startDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function AdsGrid({ items }: AdsGridProps) {
  const [query, setQuery] = useState("");
  const [advertiser, setAdvertiser] = useState("all");
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [minDays, setMinDays] = useState(0);
  const [onlyWithPreview, setOnlyWithPreview] = useState(false);
  const [onlyWithAi, setOnlyWithAi] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("score-desc");
  const [selected, setSelected] = useState<RankedAd | null>(null);

  const advertisers = useMemo(() => {
    const names = items
      .map((i) => i.ad.advertiser)
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const platforms = useMemo(() => {
    const values = items
      .map((i) => i.ad.platform)
      .filter((v): v is string => Boolean(v));
    // Split combined platforms like "FACEBOOK, INSTAGRAM"
    const parts = values.flatMap((v) =>
      v.split(",").map((p) => p.trim()).filter(Boolean),
    );
    return Array.from(new Set(parts.length ? parts : values)).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const next = items.filter((item) => {
      if (advertiser !== "all" && item.ad.advertiser !== advertiser) return false;
      if (status !== "all" && item.ad.status !== status) return false;
      if (platform !== "all") {
        const plat = (item.ad.platform ?? "").toLowerCase();
        if (!plat.includes(platform.toLowerCase())) return false;
      }
      if (item.score < minScore) return false;

      const days = observedDays(item);
      if (minDays > 0 && days < minDays) return false;

      if (onlyWithPreview && !item.ad.imageUrl && !item.ad.videoUrl) {
        return false;
      }
      if (onlyWithAi && !item.analysis) return false;

      if (!q) return true;
      const haystack = [
        item.ad.advertiser,
        item.ad.headline,
        item.ad.bodyText,
        item.ad.cta,
        item.ad.platform,
        item.analysis?.hook,
        item.analysis?.offer,
        item.analysis?.cta,
        item.analysis?.creativeAngle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    next.sort((a, b) => {
      switch (sortBy) {
        case "score-desc":
          return b.score - a.score;
        case "score-asc":
          return a.score - b.score;
        case "days-desc":
          return observedDays(b) - observedDays(a);
        case "days-asc": {
          const da = observedDays(a);
          const db = observedDays(b);
          // Keep unknown duration at the end
          if (da < 0 && db < 0) return 0;
          if (da < 0) return 1;
          if (db < 0) return -1;
          return da - db;
        }
        case "started-desc":
          return startTimestamp(b) - startTimestamp(a);
        case "started-asc":
          return startTimestamp(a) - startTimestamp(b);
        case "advertiser-asc":
          return (a.ad.advertiser ?? "").localeCompare(b.ad.advertiser ?? "");
        default:
          return 0;
      }
    });

    return next;
  }, [
    items,
    query,
    advertiser,
    status,
    platform,
    minScore,
    minDays,
    onlyWithPreview,
    onlyWithAi,
    sortBy,
  ]);

  function resetFilters() {
    setQuery("");
    setAdvertiser("all");
    setStatus("all");
    setPlatform("all");
    setMinScore(0);
    setMinDays(0);
    setOnlyWithPreview(false);
    setOnlyWithAi(false);
    setSortBy("score-desc");
  }

  if (items.length === 0) {
    return <p className="muted">No advertisements to display.</p>;
  }

  return (
    <div className="ads-explorer">
      <div className="filters panel filters-expanded">
        <label>
          Search text
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label>
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
          >
            <option value="score-desc">Score: high → low</option>
            <option value="score-asc">Score: low → high</option>
            <option value="days-desc">Duration: longest → shortest</option>
            <option value="days-asc">Duration: shortest → longest</option>
            <option value="started-desc">Started: newest first</option>
            <option value="started-asc">Started: oldest first</option>
            <option value="advertiser-asc">Advertiser A–Z</option>
          </select>
        </label>

        <label>
          Advertiser
          <select
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
          >
            <option value="all">All</option>
            {advertisers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="unknown">unknown</option>
          </select>
        </label>

        <label>
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="all">All</option>
            {platforms.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Min score
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
          />
        </label>

        <label>
          Min days live
          <input
            type="number"
            min={0}
            max={3650}
            step={1}
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value) || 0)}
          />
        </label>

        <div className="filter-checks">
          <label className="check-label">
            <input
              type="checkbox"
              checked={onlyWithPreview}
              onChange={(e) => setOnlyWithPreview(e.target.checked)}
            />
            With preview
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={onlyWithAi}
              onChange={(e) => setOnlyWithAi(e.target.checked)}
            />
            With AI analysis
          </label>
        </div>

        <div className="filter-footer">
          <p className="muted filter-count">
            Showing {filtered.length} of {items.length}
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={resetFilters}
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="filter-quick panel">
        <span className="muted">Quick:</span>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setStatus("active");
            setSortBy("days-desc");
          }}
        >
          Active · longest first
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setStatus("active");
            setSortBy("days-asc");
          }}
        >
          Active · shortest first
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setStatus("all");
            setSortBy("score-desc");
          }}
        >
          Best score
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setMinScore(80);
            setSortBy("score-desc");
          }}
        >
          Score ≥ 80
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No ads match the current filters.</p>
      ) : (
        <div className="grid ad-compact-grid">
          {filtered.map((item) => (
            <AdCard key={item.ad.id} item={item} onOpen={setSelected} />
          ))}
        </div>
      )}

      {selected ? (
        <AdDetailModal item={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
