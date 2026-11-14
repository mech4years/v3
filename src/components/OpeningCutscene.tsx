import React, { useEffect, useRef, useState } from 'react';
import { Radio, Volume2, VolumeX } from 'lucide-react';
import { HorrorAudioEngine } from '../game/audio';
import {
  CUTSCENE_TOTAL_DURATION,
  CutsceneOverlayState,
  OpeningCutsceneEngine,
} from '../game/cutscene';

interface Props {
  audio: HorrorAudioEngine;
  onComplete: () => void;
  onSkip: () => void;
}

export const OpeningCutscene: React.FC<Props> = ({ audio, onComplete, onSkip }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  onCompleteRef.current = onComplete;
  onSkipRef.current = onSkip;

  const [audioUnlocked, setAudioUnlocked] = useState(() => audio.isUnlocked());
  const [overlay, setOverlay] = useState<CutsceneOverlayState>({
    elapsed: 0,
    totalDuration: CUTSCENE_TOTAL_DURATION,
    sceneIndex: 1,
    fadeOpacity: 1,
    titleCard: { heading: 'YEAR 3059' },
    statementLines: null,
    radioBanner: null,
    damageFlash: 0,
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const unlockNow = () => {
      audio.unlock();
      if (audio.isUnlocked()) setAudioUnlocked(true);
    };
    unlockNow();

    const engine = new OpeningCutsceneEngine(
      el,
      audio,
      (nextState) => setOverlay(nextState),
      () => onCompleteRef.current()
    );

    const onKeyDown = (e: KeyboardEvent) => {
      unlockNow();
      if (e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        audio.playClick(true);
        audio.setCutsceneDrone('normal');
        onSkipRef.current();
      }
    };

    const onPointerDown = () => {
      unlockNow();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      engine.dispose();
    };
  }, [audio]);

  const progressPct = Math.min(100, (overlay.elapsed / overlay.totalDuration) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden select-none">
      {/* Isolated 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Black Fade Overlay */}
      {overlay.fadeOpacity > 0.01 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: overlay.fadeOpacity }}
        />
      )}

      {/* Impact Damage Vignette */}
      {overlay.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: Math.min(0.9, overlay.damageFlash),
            boxShadow: 'inset 0 0 130px 55px rgba(220, 38, 38, 0.85)',
          }}
        />
      )}

      {/* Top & Bottom Cinema Letterbox Bars */}
      <div className="absolute top-0 left-0 right-0 h-10 sm:h-14 bg-black z-10 flex items-center justify-between px-6">
        <span className="text-[11px] font-mono-tech tracking-[0.22em] text-zinc-500">
          THE WORLD HAS ROTTEN
        </span>
        <div className="flex items-center gap-4">
          {!audioUnlocked ? (
            <button
              onClick={() => {
                audio.unlock();
                setAudioUnlocked(true);
              }}
              className="flex items-center gap-1.5 text-[11px] font-mono-tech tracking-wider text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>CLICK TO ENABLE AUDIO</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-mono-tech tracking-wider text-zinc-500">
              <Volume2 className="w-3.5 h-3.5 text-red-500/80" />
              <span>AUDIO ACTIVE</span>
            </span>
          )}
        </div>
      </div>

      {/* Center Title Card ("YEAR 3059", "THREE YEARS LATER") */}
      {overlay.titleCard && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[0.3em] text-zinc-100">
            {overlay.titleCard.heading}
          </h2>
          {overlay.titleCard.subheading && (
            <p className="mt-3 text-xs sm:text-sm font-mono-tech tracking-[0.25em] text-red-400">
              {overlay.titleCard.subheading}
            </p>
          )}
        </div>
      )}

      {/* Statement Overlay ("THE METEORS WERE NOT THE INVASION." / "THEY WERE THE BEGINNING.") */}
      {overlay.statementLines && (
        <div className="absolute inset-x-0 bottom-24 sm:bottom-28 z-20 flex flex-col items-center justify-center pointer-events-none px-6 text-center space-y-2.5">
          {overlay.statementLines.map((line, i) => (
            <p
              key={i}
              className={`font-display tracking-[0.2em] ${
                i === 0
                  ? 'text-lg sm:text-2xl font-semibold text-zinc-100'
                  : 'text-xl sm:text-3xl font-bold text-red-500'
              }`}
              style={{ textShadow: '0 2px 18px rgba(0,0,0,0.95)' }}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Military Radio Banner (Scene 5) */}
      {overlay.radioBanner && (
        <div className="absolute inset-x-0 bottom-20 sm:bottom-24 z-20 flex justify-center pointer-events-none px-4">
          <div
            className={`max-w-xl w-full px-5 py-3.5 border ${
              overlay.radioBanner.disconnected
                ? 'bg-[#170608]/95 border-red-600 text-red-300'
                : 'bg-[#080b10]/92 border-red-900/75 text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono-tech tracking-widest text-red-400">
              <Radio className="w-3.5 h-3.5" />
              <span>{overlay.radioBanner.speaker}</span>
            </div>
            <p className="text-sm sm:text-base font-medium text-center mt-1.5 leading-snug">
              {overlay.radioBanner.text}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Letterbox Bar with Progress + Skip */}
      <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-14 bg-black z-20 flex items-center justify-between px-6 border-t border-zinc-900/80">
        <div className="flex items-center gap-3 text-[11px] font-mono-tech text-zinc-500">
          <span>PROLOGUE · ACT 0{overlay.sceneIndex} / 05</span>
          <div className="hidden sm:block w-36 h-1 bg-zinc-900 overflow-hidden">
            <div className="h-full bg-red-600/85" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <button
          onClick={() => {
            audio.unlock();
            audio.playClick(true);
            audio.setCutsceneDrone('normal');
            onSkip();
          }}
          className="px-4 py-1.5 bg-zinc-900 hover:bg-red-800 border border-zinc-700 hover:border-red-500 text-[11px] font-mono-tech tracking-widest text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          SKIP INTRO [SPACE / ESC]
        </button>
      </div>
    </div>
  );
};
