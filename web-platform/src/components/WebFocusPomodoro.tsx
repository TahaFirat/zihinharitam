import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

const PRESETS = [
  { id: 'focus25', label: '25 dk Odak', seconds: 25 * 60 },
  { id: 'deep50', label: '50 dk Derin', seconds: 50 * 60 },
  { id: 'break5', label: '5 dk Mola', seconds: 5 * 60 },
];

function playSoftBell() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.75);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
  } catch {
    // Ignore audio context block
  }
}

export const WebFocusPomodoro: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [presetIdx, setPresetIdx] = useState(0);
  const [remaining, setRemaining] = useState(PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playSoftBell();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Pomodoro Odak Sayacı"
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
          running
            ? 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-400/40'
            : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
        }`}
      >
        <Timer className="h-3.5 w-3.5" />
        <span className="tabular-nums">{running || remaining !== PRESETS[presetIdx].seconds ? `${mins}:${secs}` : 'Odak'}</span>
      </button>

      {open && (
        <div className="fixed top-14 right-3 z-[130] w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl sm:absolute sm:top-10 sm:right-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800">Pomodoro Çalışma Sayacı</span>
            <span className="text-[10px] font-bold text-slate-400">{PRESETS[presetIdx].label}</span>
          </div>

          <div className="my-3 text-center text-3xl font-black tracking-tight text-slate-900 tabular-nums">
            {mins}:{secs}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {PRESETS.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPresetIdx(idx);
                  setRemaining(p.seconds);
                  setRunning(false);
                }}
                className={`rounded-lg py-1 text-[10px] font-bold transition ${
                  presetIdx === idx
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label.split(' ')[0]} dk
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (remaining === 0) setRemaining(PRESETS[presetIdx].seconds);
                setRunning((v) => !v);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-extrabold text-white hover:bg-indigo-600"
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{running ? 'Duraklat' : 'Başlat'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setRemaining(PRESETS[presetIdx].seconds);
              }}
              title="Sıfırla"
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
