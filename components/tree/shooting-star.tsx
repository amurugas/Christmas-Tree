"use client";

import { useEffect, useState } from "react";

export function ShootingStar() {
  const [star, setStar] = useState({ visible: false, left: 20, top: 15 });
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (stopped) return;
        if (document.hidden || motion.matches) { schedule(45000); return; }
        setStar({ visible: true, left: 10 + Math.random() * 45, top: 12 + Math.random() * 12 });
        timer = setTimeout(() => {
          if (stopped) return;
          setStar((current) => ({ ...current, visible: false }));
          schedule(45000 + Math.random() * 45000);
        }, 2400);
      }, delay);
    };
    schedule(20000);
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  return star.visible ? <span aria-hidden="true" className="shooting-star pointer-events-none absolute z-0"
    style={{ left: `${star.left}%`, top: `${star.top}%` }} /> : null;
}
