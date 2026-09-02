export function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2 rounded-full text-[0.8rem] font-semibold border transition-colors ${
            active === t.id
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-dashed border-border bg-surface-1/50 px-6 py-10 text-center ${className}`}>
      <p className="text-[0.9rem] text-text-muted max-w-[46ch] mx-auto">{text}</p>
    </div>
  );
}
