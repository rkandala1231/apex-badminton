import { AnimatePresence, motion } from 'framer-motion';

export interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: string;
}

export function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[200] pointer-events-none bg-[#0e0c0a] border border-border rounded-lg px-3 py-2.5 text-[0.78rem] text-text-primary whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 180),
            top: Math.max(tip.y - 46, 8),
          }}
        >
          <div className="text-text-muted text-[0.7rem] mb-0.5">{tip.label}</div>
          <div className="mono font-bold">{tip.value}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
