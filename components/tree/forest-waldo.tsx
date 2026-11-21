"use client";

import { useEffect, useState } from "react";

const HIDING_SPOTS = [12, 23, 77, 88];

/** An occasional, purely decorative peek from the distant forest. */
export function ForestWaldo() {
  const [peek, setPeek] = useState({ visible: false, left: 12, flip: false });

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const schedule = (delay = 170000) => {
      timer = setTimeout(() => {
        if (stopped) return;
        if (document.hidden || motion.matches) {
          schedule();
          return;
        }
        const left = HIDING_SPOTS[Math.floor(Math.random() * HIDING_SPOTS.length)];
        setPeek({ visible: true, left, flip: left > 50 });
        timer = setTimeout(() => {
          if (stopped) return;
          setPeek((current) => ({ ...current, visible: false }));
          schedule();
        }, 10000);
      }, delay);
    };
    schedule(60000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="forest-waldo pointer-events-none absolute z-0"
      style={{ left: `${peek.left}%`, bottom: "29%", transform: `translateX(-50%) scaleX(${peek.flip ? -1 : 1})` }}
    >
      <svg width="100" height="126" viewBox="0 0 100 126" fill="none">
        <g className={`forest-waldo-person ${peek.visible ? "is-peeking" : ""}`}>
          <path d="M36 109 35 83H49L52 109" fill="#637c99" />
          <path d="m31 57 21 2 5 29-28-1Z" fill="#f4eee5" />
          <path d="m30 64 23 2m-24 8 26 2m-26 7 27 2" stroke="#b54349" strokeWidth="5" />
          <path d="m51 64 10 7 6-13" stroke="#f4eee5" strokeWidth="8" strokeLinecap="round" />
          <path d="m54 67 6 3m3-7 3-5" stroke="#b54349" strokeWidth="5" />
          <path d="m67 58 1-7" stroke="#edc8aa" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="43" cy="43" rx="12" ry="15" fill="#edc8aa" />
          <path d="M32 39q-3-12 9-13 14-1 14 14l-5-5-15 2Z" fill="#72553e" />
          <path d="M31 34q0-15 12-16 13 2 13 16" fill="#f4eee5" />
          <path d="M34 25h17" stroke="#b54349" strokeWidth="5" />
          <path d="M30 34h27" stroke="#b54349" strokeWidth="6" strokeLinecap="round" />
          <circle cx="43" cy="17" r="5" fill="#b54349" />
          <g stroke="#3b4141" strokeWidth="1.5">
            <circle cx="38" cy="43" r="4" /><circle cx="49" cy="43" r="4" />
            <path d="M42 43h3m-12-1-3-2" />
          </g>
          <path d="m44 49 4 1m-8 4q4 3 8-1" stroke="#936252" strokeWidth="1.3" strokeLinecap="round" />
        </g>
        <path d="M23 123V55" stroke="#5d667c" strokeWidth="5" />
        <path d="m24 7-16 30h9L0 63h12L-9 93H6l-17 25h70L42 93h14L36 63h12L31 37h9Z" fill="#626f87" />
      </svg>
    </div>
  );
}
