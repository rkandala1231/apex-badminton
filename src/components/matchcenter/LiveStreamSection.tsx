export function LiveStreamSection() {
  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Live Stream</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Watch the show court from anywhere. The stream link goes live closer to tournament day.
      </p>

      <div className="bg-surface-1 border border-border rounded-2xl aspect-video flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-full bg-surface-3 border border-border flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 5v14l11-7L8 5z" fill="#f7f3ec" />
          </svg>
        </div>
        <p className="mono text-[0.85rem] text-text-secondary">Stream starts Nov 7, 2026</p>
        <p className="text-[0.78rem] text-text-muted max-w-[40ch] text-center px-6">
          This will embed the Apex YouTube live stream once the link is ready — placeholder for now.
        </p>
      </div>
    </div>
  );
}
