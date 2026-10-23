"use client";
import { useEffect, useRef, useState } from "react";
import { SLIDES, buildCycle, type EquipmentAlt } from "@/lib/heroSlides";

// Homepage hero slideshow: 30 male doctor portraits and 30 medical equipment photos (lib/heroSlides.ts), shown in a
// random order. Illustrative stock photographs (Pexels / Unsplash licences; sources in public/images/CREDITS.md).
// The people are not MediHome doctors and imply no endorsement.
//
// - The first slide is server-rendered (always the same, so hydration matches); the hero never waits for JavaScript.
// - Shuffle bag: each cycle shows all 60 slides once in a fresh random order, doctors and equipment mixed throughout,
//   then reshuffles. A new cycle never starts with the slide that ended the last one.
// - Every `intervalMs` the next slide is fetched and decoded first; only a fully loaded image is shown, so there is
//   never a blank frame. A slide that fails to load is skipped, and the current one stays.
// - The new layer is fully visible underneath while the old one fades out on top, then is removed (two <img> at most).
// - Rotation pauses while the tab is hidden or the hero is off screen, and is off for reduced motion and Data Saver,
//   so the page stays calm and light on mobile.
export default function HeroPortraits({ alt, equipmentAlt, intervalMs = 5_000 }: { alt: string; equipmentAlt: EquipmentAlt; intervalMs?: number }) {
  const altFor = (i: number) => { const e = SLIDES[i].equipment; return e ? equipmentAlt[e] : alt; };
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const firstImg = useRef<HTMLImageElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const curRef = useRef(0);
  const failedRef = useRef(new Set<number>()); // slides whose file failed to load; never shown again

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (saveData || SLIDES.length < 2) return;

    const all = SLIDES.map((_, i) => i);
    // The server-rendered slide opens the first cycle; the other 59 follow in random order.
    let order = [curRef.current, ...buildCycle(all.filter((i) => i !== curRef.current), curRef.current)];
    let pos = 0;
    const failed = failedRef.current;
    const ready = new Map<number, Promise<boolean>>();
    let timer: number | undefined;
    let warm: number | undefined;
    let visible = true;
    let alive = true;

    // Next playable slide in the bag; starts a freshly shuffled cycle when this one is used up.
    const peek = () => {
      for (let tries = 0; tries < 2 * SLIDES.length; tries++) {
        if (pos + 1 >= order.length) { order = buildCycle(all, curRef.current); pos = -1; }
        const i = order[pos + 1];
        if (!failed.has(i) && i !== curRef.current) return i;
        pos++; // skip a broken (or just-shown) slide
      }
      return -1;
    };
    // Fetch + decode once; resolves false on any error.
    const preload = (i: number) => {
      let p = ready.get(i);
      if (!p) {
        const im = new Image();
        im.decoding = "async";
        im.src = SLIDES[i].src;
        p = im.decode().then(() => true, () => false);
        ready.set(i, p);
      }
      return p;
    };

    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (warm !== undefined) window.clearTimeout(warm);
      timer = warm = undefined;
    };
    const schedule = (delay = intervalMs) => {
      stop();
      if (!alive || reduce.matches || document.hidden || !visible) return;
      timer = window.setTimeout(advance, delay);
      // Warm the cache for the upcoming slide well before it is needed (one image per interval).
      const n = peek();
      if (n >= 0) warm = window.setTimeout(() => { if (alive) preload(n); }, Math.min(8000, delay / 2));
    };
    const advance = async () => {
      timer = undefined;
      const n = peek();
      if (n < 0) return;
      const ok = await preload(n);
      if (!alive) return;
      // Broken file: skip it and try the next one now (ends when every other slide has failed).
      if (!ok) { failed.add(n); ready.delete(n); pos++; return advance(); }
      if (document.hidden || !visible || reduce.matches) return; // resumes via the listeners below
      pos++;
      setPrev(curRef.current);
      curRef.current = n;
      setCur(n);
      schedule();
    };

    const onVisibility = () => (document.hidden ? stop() : schedule());
    const onMotion = () => (reduce.matches ? stop() : schedule());
    document.addEventListener("visibilitychange", onVisibility);
    reduce.addEventListener?.("change", onMotion);
    const io = "IntersectionObserver" in window && root.current
      ? new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) schedule(); if (!visible) stop(); })
      : null;
    if (io && root.current) io.observe(root.current);

    // If the server-rendered first slide failed to load, move on to the next one straight away.
    const im = firstImg.current;
    const firstBroken = failed.has(0) || (im !== null && im.complete && im.naturalWidth === 0);
    if (firstBroken) failed.add(0);
    schedule(firstBroken ? 0 : intervalMs);

    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener?.("change", onMotion);
      io?.disconnect();
    };
  }, [intervalMs]);

  // During a change the new slide sits underneath, fully visible, and gently settles in; the old one sits on top and
  // fades out, then is removed. Nothing ever starts invisible, so a photo is always on screen.
  const layer = (i: number, entering: boolean, exiting: boolean) => {
    const cls = exiting ? "pf-out" : entering ? "pf-settle" : undefined;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local, pre-optimised hero photos
      <img key={"p" + i} ref={i === 0 ? firstImg : undefined} className={cls} src={SLIDES[i].src} width={960} height={1200}
        fetchPriority={i === 0 ? "high" : undefined} decoding="async" alt={exiting ? "" : altFor(i)}
        aria-hidden={exiting ? true : undefined} onAnimationEnd={exiting ? () => setPrev(null) : undefined}
        onError={(e) => { failedRef.current.add(i); e.currentTarget.style.visibility = "hidden"; }} />
    );
  };

  return (
    <span className="frame" ref={root}>
      {layer(cur, prev !== null, false)}
      {prev !== null && layer(prev, false, true)}
    </span>
  );
}
