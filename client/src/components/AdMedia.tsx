import type { Advertisement } from "../types/research";

type AdMediaProps = {
  ad: Advertisement;
  variant?: "card" | "modal";
};

export function AdMedia({ ad, variant = "card" }: AdMediaProps) {
  const videoUrl = ad.videoUrl ?? null;
  const imageUrl = ad.imageUrl ?? null;
  const className =
    variant === "modal" ? "ad-media ad-media-modal" : "ad-media ad-media-card";
  const interactive = variant === "modal";

  if (videoUrl) {
    return (
      <div className={className}>
        <video
          className="ad-video"
          src={videoUrl}
          poster={imageUrl ?? undefined}
          controls={interactive}
          muted={!interactive}
          playsInline
          preload="metadata"
          // Compact cards are clickable – avoid nested control interaction
          style={interactive ? undefined : { pointerEvents: "none" }}
        />
        <span className="media-badge">Video</span>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className={className}>
        <img
          className="ad-image"
          src={imageUrl}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="media-badge">Image</span>
      </div>
    );
  }

  return (
    <div className={`${className} ad-media-empty muted`}>No creative preview</div>
  );
}
