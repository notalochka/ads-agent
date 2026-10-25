import { useEffect, useState } from "react";
import type { RankedAd } from "../types/research";
import {
  calcObservedDays,
  formatAdDate,
  statusLabel,
} from "../utils/ad-dates";
import { AdMedia } from "./AdMedia";

type AdDetailModalProps = {
  item: RankedAd;
  onClose: () => void;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ad-metric">
      <span className="ad-metric-label">{label}</span>
      <strong className="ad-metric-value">{value}</strong>
    </div>
  );
}

function initialLetter(name: string | null): string {
  const ch = name?.trim()?.[0];
  return ch ? ch.toUpperCase() : "?";
}

export function AdDetailModal({ item, onClose }: AdDetailModalProps) {
  const { ad, analysis, score, scoreExplanation, warnings } = item;
  const [aiOpen, setAiOpen] = useState(false);
  const days = calcObservedDays(ad.startDate, ad.endDate, ad.status);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="ad-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ad-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Ad details: ${ad.advertiser ?? ad.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="ad-modal-media">
          <AdMedia ad={ad} variant="modal" />
          <p className="muted ad-modal-media-note">
            If media does not load, open the original Ad Library link –
            Facebook image/video URLs can expire.
            {ad.sourceUrl ? (
              <>
                {" "}
                <a href={ad.sourceUrl} target="_blank" rel="noreferrer">
                  Ad Library
                </a>
              </>
            ) : null}
          </p>
        </aside>

        <section className="ad-modal-content">
          <header className="ad-modal-header">
            <div className="ad-modal-identity">
              <div className="ad-avatar" aria-hidden>
                {initialLetter(ad.advertiser)}
              </div>
              <div>
                <h2>{ad.advertiser ?? "Unknown advertiser"}</h2>
                <div className="ad-compact-tags">
                  <span
                    className={`status-pill status-${ad.status === "active" ? "ok" : ad.status === "inactive" ? "partial" : ""}`}
                  >
                    {statusLabel(ad.status)}
                  </span>
                  {ad.videoUrl ? (
                    <span className="status-pill">Video</span>
                  ) : ad.imageUrl ? (
                    <span className="status-pill">Image</span>
                  ) : null}
                  {ad.platform ? (
                    <span className="status-pill">{ad.platform}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="ad-modal-header-actions">
              {ad.sourceUrl ? (
                <a
                  className="ad-library-link"
                  href={ad.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Ad Library ↗
                </a>
              ) : null}
              <button
                type="button"
                className="ad-modal-close"
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </header>

          <div className="ad-metrics">
            <Metric label="Score" value={`${score}/100`} />
            <Metric
              label="Observed days"
              value={days != null ? `${days} days` : "n/a"}
            />
            <Metric label="Started" value={formatAdDate(ad.startDate)} />
            <Metric label="Ended" value={formatAdDate(ad.endDate)} />
            <Metric label="Status" value={statusLabel(ad.status)} />
            <Metric label="Country" value={ad.country ?? "n/a"} />
            <Metric label="Platform" value={ad.platform ?? "n/a"} />
            <Metric label="Ad ID" value={ad.id} />
          </div>

          {scoreExplanation.length > 0 ? (
            <p className="muted ad-score-formula">
              Score: {scoreExplanation.join(" · ")}
            </p>
          ) : null}

          <div className="ad-block">
            <h3>Headline</h3>
            <div className="ad-block-box">{ad.headline ?? "n/a"}</div>
          </div>

          <div className="ad-block">
            <h3>Ad text</h3>
            <div className="ad-block-box ad-block-body">
              {ad.bodyText ?? "n/a"}
            </div>
          </div>

          <div className="ad-cta-row">
            <div className="ad-block">
              <h3>CTA</h3>
              <div className="ad-block-box">{ad.cta ?? "n/a"}</div>
            </div>
            <div className="ad-block">
              <h3>Landing</h3>
              <div className="ad-block-box">
                {ad.landingUrl ? (
                  <a href={ad.landingUrl} target="_blank" rel="noreferrer">
                    {ad.landingUrl}
                  </a>
                ) : (
                  "n/a"
                )}
              </div>
            </div>
          </div>

          <div className="ad-block">
            <h3>Availability note</h3>
            <div className="ad-block-box muted">
              Meta Ad Library does not always expose spend, impressions, or
              targeting for commercial ads. Missing fields stay as n/a – we do
              not invent performance metrics.
            </div>
          </div>

          <button
            type="button"
            className="ai-toggle"
            aria-expanded={aiOpen}
            onClick={() => setAiOpen((v) => !v)}
          >
            <span
              className={`ai-toggle-arrow ${aiOpen ? "open" : ""}`}
              aria-hidden
            >
              ▸
            </span>
            <span>AI creative analysis</span>
            <span className="muted ai-toggle-hint">
              {analysis ? `confidence: ${analysis.confidence}` : "no analysis"}
            </span>
          </button>

          {aiOpen ? (
            <div className="ai-panel">
              {analysis ? (
                <>
                  <div className="ad-block">
                    <h3>Hook</h3>
                    <div className="ad-block-box ad-hook-box">
                      {analysis.hook ?? "n/a"}
                    </div>
                  </div>
                  <div className="ad-block">
                    <h3>Offer</h3>
                    <div className="ad-block-box">{analysis.offer ?? "n/a"}</div>
                  </div>
                  <div className="ad-cta-row">
                    <div className="ad-block">
                      <h3>CTA (AI)</h3>
                      <div className="ad-block-box">
                        {analysis.cta ?? "n/a"}
                      </div>
                    </div>
                    <div className="ad-block">
                      <h3>Persuasion</h3>
                      <div className="ad-block-box">
                        {analysis.persuasionTechnique ?? "n/a"}
                      </div>
                    </div>
                  </div>
                  <div className="ad-block">
                    <h3>Creative angle</h3>
                    <div className="ad-block-box">
                      {analysis.creativeAngle ?? "n/a"}
                    </div>
                  </div>
                  <div className="ad-block">
                    <h3>Audience signals</h3>
                    <div className="ad-block-box">
                      {analysis.targetAudienceSignals?.length
                        ? analysis.targetAudienceSignals.join("; ")
                        : "n/a"}
                    </div>
                  </div>
                  <div className="ad-block">
                    <h3>Uncertainty</h3>
                    <div className="ad-block-box">
                      {analysis.uncertaintyNotes?.length
                        ? analysis.uncertaintyNotes.join("; ")
                        : "none"}
                    </div>
                  </div>
                  {analysis.evidence?.excerpt ? (
                    <div className="ad-block">
                      <h3>Evidence excerpt</h3>
                      <div className="ad-block-box">
                        {analysis.evidence.excerpt}
                      </div>
                    </div>
                  ) : null}
                  {warnings.length > 0 ? (
                    <p className="warn-text">
                      Warnings: {warnings.join("; ")}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted">No AI analysis available for this ad.</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
