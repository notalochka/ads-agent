export function LoadingState() {
  return (
    <div className="panel loading-panel" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <div className="loading-body">
        <p className="loading-title">Running research agent…</p>
      </div>
    </div>
  );
}
