import { useEffect, useRef, useState } from 'react';

/**
 * Tracks horizontal scroll progress of a ref'd element so a UI (e.g. a bottom
 * "gauge" bar) can mirror native scrollbar state without showing the browser's
 * own scrollbar. `ratio` is the visible fraction of total scrollable width
 * (1 = nothing to scroll); `progress` is 0..1 through the scrollable range.
 */
export function useScrollTrack<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState({ ratio: 1, progress: 0 });

  function update() {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
    const progress = max > 0 ? el.scrollLeft / max : 0;
    setState({ ratio, progress });
  }

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, ratio: state.ratio, progress: state.progress, onScroll: update };
}
