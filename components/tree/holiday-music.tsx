"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";

// A gentle, unaccompanied arrangement of the traditional GLORIA melody.
// Source: https://thewordalone.org/worship/angels-we-have-heard-on-high-gloria
// Transposed to C major; synthesized locally without an audio download.
const MELODY: readonly (readonly [number, number])[] = [
  [64, 1], [64, 1], [64, 1], [67, 1], [67, 1.5], [65, 0.5], [64, 2], [64, 1],
  [62, 1], [64, 1], [67, 1], [64, 1.5], [62, 0.5], [60, 2], [64, 1], [64, 1],
  [64, 1], [67, 1], [67, 1.5], [65, 0.5], [64, 2], [64, 1], [62, 1], [64, 1],
  [67, 1], [64, 1.5], [62, 0.5], [60, 2], [67, 2], [69, 0.5], [67, 0.5], [65, 0.5],
  [64, 0.5], [65, 2], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5], [64, 2], [65, 0.5],
  [64, 0.5], [62, 0.5], [60, 0.5], [62, 1.5], [55, 0.5], [55, 2], [60, 1], [62, 1],
  [64, 1], [65, 1], [64, 2], [62, 1], [0, 1], [67, 2], [69, 0.5], [67, 0.5],
  [65, 0.5], [64, 0.5], [65, 2], [67, 0.5], [65, 0.5], [64, 0.5], [62, 0.5], [64, 2],
  [65, 0.5], [64, 0.5], [62, 0.5], [60, 0.5], [62, 1.5], [55, 0.5], [55, 2], [60, 1],
  [62, 1], [64, 1], [65, 1], [64, 2], [62, 2], [60, 4],
];

function createMusic() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.38;
  master.connect(context.destination);
  let nextAt = context.currentTime + 0.1;
  let index = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const beat = 60 / 62;

  function bell(midi: number, when: number, duration: number) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (const [multiple, volume] of [[1, 0.1], [2, 0.018], [3, 0.004]]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple;
      envelope.gain.setValueAtTime(0, when);
      envelope.gain.linearRampToValueAtTime(volume, when + 0.035);
      envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 1.6);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(when);
      oscillator.stop(when + duration + 1.7);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
  }

  function schedule() {
    while (nextAt < context.currentTime + 1.5) {
      const [note, beats] = MELODY[index];
      if (note > 0) bell(note, nextAt, Math.min(beats * beat, 1.8));
      nextAt += beats * beat;
      index += 1;
      if (index === MELODY.length) {
        index = 0;
        nextAt += 4 * beat;
      }
    }
  }

  return {
    async start() {
      try {
        await context.resume();
        schedule();
        timer = setInterval(schedule, 250);
      } catch (error) {
        await context.close();
        throw error;
      }
    },
    async stop() {
      if (timer) clearInterval(timer);
      if (context.state === "closed") return;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.06);
      // Let the short fade finish before releasing the audio device.
      await new Promise<void>((resolve) => setTimeout(resolve, 220));
      await context.close();
    },
  };
}

export function HolidayMusic() {
  const player = useRef<ReturnType<typeof createMusic> | null>(null);
  const busy = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => {
    void player.current?.stop();
    player.current = null;
  }, []);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (player.current) {
        const current = player.current;
        player.current = null;
        setPlaying(false);
        await current.stop();
      } else {
        const current = createMusic();
        player.current = current;
        await current.start();
        // A component may have unmounted while the audio device was opening.
        if (player.current !== current) return;
        setPlaying(true);
        setFailed(false);
      }
    } catch {
      player.current = null;
      setPlaying(false);
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="absolute bottom-36 right-5 z-20 sm:right-8">
      <button
        type="button"
        aria-label={playing ? "Turn off Angels We Have Heard on High" : "Play Angels We Have Heard on High"}
        aria-pressed={playing}
        title={playing ? "Turn music off" : "Angels We Have Heard on High — soft bells"}
        onClick={() => void toggle()}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#547064]/20 bg-white/65 text-[#426052] shadow-sm backdrop-blur transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#426052]"
      >
        {playing ? <Music2 aria-hidden="true" className="size-4" /> : <VolumeX aria-hidden="true" className="size-4 opacity-65" />}
      </button>
      {failed && <p role="status" className="absolute right-0 mt-2 w-44 rounded-lg bg-white/90 p-2 text-xs text-[#536b62]">Music could not start. Tap to try again.</p>}
    </div>
  );
}
