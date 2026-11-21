import { useCallback, useEffect, useRef, useState } from 'react';

/** Measure an element's width so SVG charts draw at real pixels (crisp text on phones and desktop). */
export function useElementWidth(fallback = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Returns a tooltip node; JSX lives here so every chart shares one look.
/** Hover tooltip shared by all SVG charts. */
export function useTooltip() {
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const show = useCallback((evt, content) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const p = evt.touches?.[0] || evt;
    setTip({ x: p.clientX - box.left, y: p.clientY - box.top, w: box.width, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip ? (
    <div
      className="vx-tooltip"
      style={{
        left: Math.min(Math.max(tip.x, 70), tip.w - 70),
        top: tip.y,
      }}
    >
      {tip.content}
    </div>
  ) : null;
  return { wrapRef, show, hide, node };
}

export function niceMax(v) {
  if (!v || v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const nf = steps.find((x) => f <= x) || 10;
  return nf * exp;
}

export function ticks(max, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** A rounded lower bound so trend lines that never reach zero (e.g. net worth) aren't squashed flat. */
export function niceFloor(v) {
  if (!v || v <= 0) return 0;
  const exp = 10 ** Math.floor(Math.log10(v));
  return Math.floor(v / exp) * exp;
}
