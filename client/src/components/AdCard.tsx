import type { RankedAd } from "../types/research";
import {
  calcObservedDays,
  statusLabel,
} from "../utils/ad-dates";
import { AdMedia } from "./AdMedia";

type AdCardProps = {
  item: RankedAd;
  onOpen: (item: RankedAd) => void;
};

export function AdCard({ item, onOpen }: AdCardProps) {
  const { ad, score } = item;
  const days = calcObservedDays(ad.startDate, ad.endDate, ad.status);
  const preview = ad.headline ?? ad.bodyText ?? "No creative text";

  return (
    <button
      type="button"
      className="panel ad-card-compact"
      onClick={() => onOpen(item)}
    >
      <AdMedia ad={ad} variant="card" />

      <div className="ad-compact-body">
        <div className="ad-compact-top">
          <strong className="ad-compact-name">
            {ad.advertiser ?? "Unknown advertiser"}
          </strong>
          <span className="score-badge score-badge-sm">{score}</span>
        </div>

        <div className="ad-compact-tags">
          <span
            className={`status-pill status-${ad.status === "active" ? "ok" : ad.status === "inactive" ? "partial" : ""}`}
          >
            {statusLabel(ad.status)}
          </span>
          {ad.videoUrl ? <span className="status-pill">Video</span> : null}
          {ad.platform ? (
            <span className="status-pill">{ad.platform}</span>
          ) : null}
          {days != null ? (
            <span className="status-pill">{days} days</span>
          ) : null}
        </div>

        <p className="ad-compact-copy">{preview}</p>
        <span className="ad-compact-open muted">Open details →</span>
      </div>
    </button>
  );
}
