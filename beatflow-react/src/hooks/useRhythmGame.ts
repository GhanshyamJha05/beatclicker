import { useCallback, useEffect, useRef, useState } from "react";

const LANES = ["A", "S", "D", "J", "K", "L"] as const;
type LaneKey = (typeof LANES)[number];

const KEY_TO_INDEX: Record<LaneKey, number> = {
  A: 0,
  S: 1,
  D: 2,
  J: 3,
  K: 4,
  L: 5,
};

const NOTE_COLORS: Record<LaneKey, string> = {
  A: "#60a5fa",
  S: "#34d399",
  D: "#a78bfa",
  J: "#f9a8d4",
  K: "#fbbf24",
  L: "#fb7185",
};

const BPM = 96;
const BEAT_MS = 60000 / BPM;
const TRAVEL_TIME = 2000;

const HIT_WINDOWS = {
  perfect: 70,
  great: 130,
  good: 200,
};

type NoteModel = {
  id: number;
  key: LaneKey;
  laneIndex: number;
  time: number;
  xPercent: number;
  yPercent: number;
  hit: boolean;
  miss: boolean;
};

type UseRhythmGameArgs = {
  level: "easy" | "normal" | "hard";
  songId: "chill" | "groove" | "spark";
};

export function useRhythmGame({ level }: UseRhythmGameArgs) {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [judgement, setJudgement] = useState("Ready");
  const [notes, setNotes] = useState<NoteModel[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const chartRef = useRef<{ time: number; key: LaneKey }[]>([]);
  const accuracySumRef = useRef(0);
  const accuracyCountRef = useRef(0);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStartRef = useRef(0);
  const pausedSongTimeRef = useRef(0);
  const lastBeatIndexRef = useRef(-1);

  const buildChart = useCallback(() => {
    const events: { time: number; key: LaneKey }[] = [];
    const bars = level === "easy" ? 12 : 16;

    for (let bar = 0; bar < bars; bar += 1) {
      const barStart = bar * 4 * BEAT_MS;
      events.push({ time: barStart + 0 * BEAT_MS, key: "A" });
      events.push({ time: barStart + 2 * BEAT_MS, key: "J" });

      if (level !== "easy" && bar % 4 === 1) {
        events.push({ time: barStart + 0.5 * BEAT_MS, key: "S" });
        events.push({ time: barStart + 2.5 * BEAT_MS, key: "K" });
      }
    }

    chartRef.current = events;
  }, [level]);

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
  }, []);

  const getSongTime = useCallback(() => {
    if (!isRunning && pausedSongTimeRef.current) {
      return pausedSongTimeRef.current;
    }

    const ctx = audioCtxRef.current;
    if (!ctx || !audioStartRef.current) {
      return performance.now() - startTimeRef.current;
    }
    return (ctx.currentTime - audioStartRef.current) * 1000;
  }, [isRunning]);

  const playHitSound = useCallback((kind: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 260;
    const freq =
      kind === "Perfect"
        ? base * 1.1
        : kind === "Great"
        ? base
        : kind === "Good"
        ? base * 0.9
        : base * 0.8;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }, []);

  const playBackgroundBeat = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Soft sub pulse
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);

    // Gentle tick for timing
    const tickOsc = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tickOsc.type = "triangle";
    tickOsc.frequency.setValueAtTime(1800, t);
    tickGain.gain.setValueAtTime(0.02, t);
    tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    tickOsc.connect(tickGain).connect(ctx.destination);
    tickOsc.start(t);
    tickOsc.stop(t + 0.08);
  }, []);

  const loop = useCallback(() => {
    if (!isRunning) return;
    const t = getSongTime();
    const chart = chartRef.current;

    // very light background beat on each 1/4 note
    const beatIndex = Math.floor(t / BEAT_MS);
    if (audioCtxRef.current && beatIndex > lastBeatIndexRef.current) {
      lastBeatIndexRef.current = beatIndex;
      playBackgroundBeat();
    }

    setNotes((prev) => {
      const next: NoteModel[] = [];
      chart.forEach((ev, idx) => {
        const existing = prev.find((n) => n.id === idx);
        const hit = existing?.hit ?? false;
        const miss = existing?.miss ?? false;

        const dt = ev.time - t;
        const progress = 1 - dt / TRAVEL_TIME;
        const clamped = Math.min(Math.max(progress, 0), 1);
        const laneIndex = KEY_TO_INDEX[ev.key];
        const xPercent = ((laneIndex + 0.5) / 6) * 100;
        const yPercent = 5 + 85 * clamped; // 5% from top to just above receptors

        const model: NoteModel = {
          id: idx,
          key: ev.key,
          laneIndex,
          time: ev.time,
          xPercent,
          yPercent,
          hit,
          miss,
        };

        if (!hit && !miss && t - ev.time > HIT_WINDOWS.good + 120) {
          model.miss = true;
        }

        next.push(model);
      });

      return next;
    });

    rafRef.current = requestAnimationFrame(loop);
  }, [getSongTime, isRunning]);

  const start = useCallback(() => {
    ensureAudio();
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") ctx.resume();

    buildChart();
    setNotes([]);
    setScore(0);
    setCombo(0);
    setJudgement("Ready");
    accuracySumRef.current = 0;
    accuracyCountRef.current = 0;
    setAccuracy(100);
    pausedSongTimeRef.current = 0;

    startTimeRef.current = performance.now();
    audioStartRef.current = ctx ? ctx.currentTime + 0.06 : 0;

    setIsRunning(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [buildChart, ensureAudio, loop]);

  const pauseOrResume = useCallback(() => {
    if (!isRunning) {
      start();
      return;
    }
    pausedSongTimeRef.current = getSongTime();
    setIsRunning(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, [getSongTime, isRunning, start]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toUpperCase() as LaneKey;
      if (!LANES.includes(key)) return;
      if (!isRunning) return;
      if (e.repeat) return;

      e.preventDefault();
      const t = getSongTime();

      setNotes((prev) => {
        let bestIndex = -1;
        let bestDiff = Infinity;

        prev.forEach((n, idx) => {
          if (n.key !== key || n.hit || n.miss) return;
          const diff = Math.abs(n.time - t);
          if (diff < bestDiff && diff <= HIT_WINDOWS.good) {
            bestDiff = diff;
            bestIndex = idx;
          }
        });

        if (bestIndex === -1) return prev;

        const updated = [...prev];
        const note = updated[bestIndex];
        note.hit = true;

        let type = "Good";
        if (bestDiff <= HIT_WINDOWS.perfect) type = "Perfect";
        else if (bestDiff <= HIT_WINDOWS.great) type = "Great";

        playHitSound(type);

        setCombo((c) => c + 1);
        setScore((s) => s + (type === "Perfect" ? 1000 : type === "Great" ? 600 : 300));

        const weight =
          type === "Perfect" ? 1 : type === "Great" ? 0.8 : type === "Good" ? 0.5 : 0;
        accuracySumRef.current += weight;
        accuracyCountRef.current += 1;
        const acc =
          accuracyCountRef.current === 0
            ? 100
            : (accuracySumRef.current / accuracyCountRef.current) * 100;
        setAccuracy(acc);
        setJudgement(type);

        return updated;
      });
    },
    [getSongTime, isRunning, playHitSound]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const lanes = LANES.map((k, index) => ({
    id: k,
    key: k,
    index,
    isSpacer: false as const,
  }));

  return {
    score,
    combo,
    accuracy,
    judgement,
    lanes,
    notes: notes.map((n) => ({
      ...n,
      color: NOTE_COLORS[n.key],
    })),
    isRunning,
    start,
    pauseOrResume,
    handleKeyDown,
  };
}

