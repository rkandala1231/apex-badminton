export function ScrollGauge({
  ratio,
  progress,
  className = '',
}: {
  ratio: number;
  progress: number;
  className?: string;
}) {
  if (ratio >= 0.999) return null;
  return (
    <div className={`relative h-[3px] w-full max-w-[220px] rounded-full bg-border-soft overflow-hidden ${className}`}>
      <div
        className="absolute top-0 h-full bg-accent rounded-full"
        style={{ width: `${ratio * 100}%`, left: `${progress * (1 - ratio) * 100}%` }}
      />
    </div>
  );
}
