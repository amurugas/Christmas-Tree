"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ShootingStar } from "@/components/tree/shooting-star";
import { HolidayMusic } from "@/components/tree/holiday-music";
import { ForestWaldo } from "@/components/tree/forest-waldo";
import { SnowCanvas } from "@/components/tree/snow-canvas";
import { createTreeScene, type TreeScene } from "@/components/tree/tree-scene";
import { TREE_SLOT_COUNT } from "@/lib/tree/anchors";
import { formatOrnamentCallout } from "@/lib/tree/model";

type Ornament = {
  id: string;
  initials: string;
  message: string;
  slot: number;
  originalName: string;
  modelUrl: string;
};

/** Pointer travel (CSS px) after which a press counts as a spin, not a click. */
const DRAG_THRESHOLD = 6;

export function TreeExperience({ ornaments, arrivalId }: { ornaments: Ornament[]; arrivalId?: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TreeScene | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerRef = useRef<{ id: number; startX: number; startY: number; dragged: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [autoMessageId, setAutoMessageId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleOrnaments = useMemo(
    () => ornaments.filter((item) => item.slot >= 1 && item.slot <= TREE_SLOT_COUNT),
    [ornaments],
  );
  const latestOrnaments = useRef(visibleOrnaments);
  const status = visibleOrnaments.length
    ? `${visibleOrnaments.length} community ornaments on the tree`
    : "Traditional decorations for now — add yours to make it our tree";

  // Build the scene once; ornament changes are applied slot by slot below.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = createTreeScene({
      mount,
      getButton: (id) => buttonRefs.current.get(id),
      onReveal: setAutoMessageId,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    sceneRef.current = scene;
    scene.sync(latestOrnaments.current);
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    latestOrnaments.current = visibleOrnaments;
    sceneRef.current?.sync(visibleOrnaments, arrivalId);
  }, [visibleOrnaments, arrivalId]);

  useEffect(() => {
    sceneRef.current?.zoom(zoom);
  }, [zoom]);

  useEffect(() => {
    if (!autoMessageId) return;
    const timer = setTimeout(() => setAutoMessageId(null), 2600);
    return () => clearTimeout(timer);
  }, [autoMessageId]);

  const adjustZoom = (delta: number) => {
    setZoom((current) => Math.max(1, Math.min(1.3, Math.round((current + delta) * 100) / 100)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, dragged: false };
    sceneRef.current?.pointerDown(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.dragged && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > DRAG_THRESHOLD) {
      pointer.dragged = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    sceneRef.current?.pointerMove(event.clientX);
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    suppressClickRef.current = pointer.dragged;
    pointerRef.current = null;
    sceneRef.current?.pointerUp();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      adjustZoom(event.key === "-" ? -0.05 : 0.05);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    sceneRef.current?.nudge(event.key === "ArrowLeft" ? -1 : 1);
  };

  return (
    <main className="tree-backdrop relative min-h-[100svh] overflow-hidden text-[#fff4e8]">
      <ShootingStar />
      <ForestWaldo />
      <SnowCanvas className="pointer-events-none absolute inset-0 z-0 h-full w-full" />

      <div
        tabIndex={0}
        role="group"
        aria-roledescription="3D tree"
        aria-label="Community tree. Drag sideways or use the left and right arrow keys to spin it."
        className="tree-stage absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#426052]/60"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div ref={mountRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          {visibleOrnaments.map((ornament) => {
            const active = activeId === ornament.id;
            const showMessage = active || (!activeId && autoMessageId === ornament.id);
            return (
              <button
                key={ornament.id}
                ref={(element) => {
                  if (element) buttonRefs.current.set(ornament.id, element);
                  else buttonRefs.current.delete(ornament.id);
                }}
                type="button"
                aria-label={ornament.message ? `${ornament.message} — ${ornament.initials}, ornament slot ${ornament.slot}` : `Ornament by ${ornament.initials}, slot ${ornament.slot}`}
                aria-pressed={active}
                className="group pointer-events-auto absolute left-0 top-0 h-11 w-11 rounded-full opacity-0 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[#ffe19a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#153228]"
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setActiveId(ornament.id);
                }}
                onPointerLeave={() => setActiveId((current) => current === ornament.id ? null : current)}
                onFocus={() => setActiveId(ornament.id)}
                onBlur={() => setActiveId((current) => current === ornament.id ? null : current)}
                onClick={() => setActiveId((current) => current === ornament.id ? null : ornament.id)}
              >
                <span className={`absolute left-1/2 top-[-1.8rem] w-max max-w-[min(16rem,70vw)] -translate-x-1/2 whitespace-normal rounded-xl border border-white/15 bg-[#10271f]/92 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#fff4cf] shadow-lg backdrop-blur transition duration-500 ${showMessage ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}>
                  {formatOrnamentCallout(ornament.message, ornament.initials)}
                </span>
                <span className="sr-only">{ornament.originalName}</span>
              </button>
            );
          })}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-6 p-5 sm:p-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#e3d2c7]">MKA community tree</p>
          <h1 className="mt-2 font-serif text-2xl tracking-[-0.03em] sm:text-4xl">Made brighter together.</h1>
        </div>
        <p className="max-w-40 text-right text-[11px] leading-relaxed text-[#f0e4df]/85 sm:max-w-60 sm:text-xs">
          Drag sideways to spin the tree · tap an ornament to see who made it
        </p>
      </header>

      <HolidayMusic />

      <div
        role="group"
        aria-label="Tree zoom"
        className="absolute bottom-20 right-5 z-20 flex items-center rounded-full border border-[#547064]/20 bg-white/65 p-1 text-[#426052] shadow-sm backdrop-blur sm:right-8"
      >
        <button type="button" aria-label="Zoom out" disabled={zoom <= 1}
          onClick={() => adjustZoom(-0.05)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[#426052] disabled:opacity-30">
          −
        </button>
        <span aria-live="polite" className="w-10 text-center text-[10px] tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom >= 1.3}
          onClick={() => adjustZoom(0.05)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[#426052] disabled:opacity-30">
          +
        </button>
      </div>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-5 sm:p-8">
        <div className="max-w-[70vw]">
          <p aria-live="polite" className="sr-only">{status}</p>
          <p className="font-serif text-[9px] italic tracking-[0.025em] text-[#58665e]/65 sm:text-[10px]">
            Happy Holidays from Adv Geom TST
          </p>
        </div>
        <span className="rounded-full border border-[#547064]/20 bg-white/65 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-[#426052] backdrop-blur">
          {TREE_SLOT_COUNT} branches
        </span>
      </footer>
    </main>
  );
}
