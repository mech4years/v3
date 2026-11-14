import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Flashlight,
  HeartPulse,
  MessageSquare,
  Pause,
  Radio,
  Send,
  Shield,
  Swords,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import { CHARACTERS, WEAPONS } from '../game/data';
import { CharacterId, GameSettings, HudSnapshot } from '../game/types';

interface Props {
  hud: HudSnapshot;
  characterId: CharacterId;
  settings: GameSettings;
  onLockPointer: () => void;
  onPause: () => void;
  onOpenInventory: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onTouchAction: (
    action:
      | 'shoot_start'
      | 'shoot_end'
      | 'aim'
      | 'reload'
      | 'interact'
      | 'ability'
      | 'flashlight'
      | 'jump'
      | 'switch'
      | 'heal'
  ) => void;
  onSendChat?: (text: string) => void;
  onChatFocusChange?: (focused: boolean) => void;
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const GameHud: React.FC<Props> = ({
  hud,
  characterId,
  settings,
  onLockPointer,
  onPause,
  onOpenInventory,
  onTouchMove,
  onTouchLook,
  onTouchAction,
  onSendChat,
  onChatFocusChange,
}) => {
  const charDef = CHARACTERS[characterId];
  const activeWeapon = hud.weapons[hud.activeSlot];
  const weaponDef = WEAPONS[activeWeapon.id];
  const secondarySlot = hud.activeSlot === 0 ? 1 : 0;
  const secondaryWeapon = hud.weapons[secondarySlot];

  const cardinalIdx = Math.round(hud.compassHeading / 45) % 8;
  const cardinal = COMPASS_LABELS[cardinalIdx];

  // Dynamic 4-prong reticle gap (px)
  const prongGap = hud.isAiming
    ? Math.round(3 + hud.moveSpread * 4)
    : Math.round(7 + hud.moveSpread * 12);

  // Objective direction indicator relative to camera forward
  let objDirArrow = '';
  let objGuideText = '';
  if (hud.objectiveBearingDeg !== null) {
    if (Math.abs(hud.objectiveBearingDeg) <= 18) {
      objDirArrow = '▲';
      objGuideText = 'STRAIGHT AHEAD';
    } else if (hud.objectiveBearingDeg > 18 && hud.objectiveBearingDeg <= 135) {
      objDirArrow = '▶';
      objGuideText = 'TURN RIGHT';
    } else if (hud.objectiveBearingDeg < -18 && hud.objectiveBearingDeg >= -135) {
      objDirArrow = '◀';
      objGuideText = 'TURN LEFT';
    } else {
      objDirArrow = '▼';
      objGuideText = 'TURN AROUND';
    }
  }

  // Touch joystick refs
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const lookLastRef = useRef<{ x: number; y: number } | null>(null);

  // In-game multiplayer radio chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);
  const mpActive = Boolean(hud.multiplayer?.active);

  useEffect(() => {
    if (!mpActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !chatOpen) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        setChatOpen(true);
        onChatFocusChange?.(true);
        window.setTimeout(() => chatInputRef.current?.focus(), 20);
      } else if (e.code === 'Escape' && chatOpen) {
        e.preventDefault();
        e.stopPropagation();
        setChatOpen(false);
        setChatInput('');
        onChatFocusChange?.(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mpActive, chatOpen, onChatFocusChange]);

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && onSendChat) {
      onSendChat(chatInput.trim());
    }
    setChatInput('');
    setChatOpen(false);
    onChatFocusChange?.(false);
    onLockPointer();
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Sniper Scope Optical Overlay during ADS */}
      {hud.isSniperAds && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, transparent 29%, rgba(3,4,6,0.92) 34%, rgba(2,3,5,0.98) 65%)',
          }}
        >
          {/* Optical Aperture Ring */}
          <div className="relative w-[min(62vw,62vh)] h-[min(62vw,62vh)] rounded-full border border-sky-400/35 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-sky-300/35" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-sky-300/35" />
            <div className="w-2 h-2 rounded-full bg-red-500/90" />
            <div className="absolute bottom-5 text-[10px] font-mono-tech tracking-widest text-sky-300/80">
              4.5X BALLISTIC OPTIC · M99 LONGBOW
            </div>
          </div>
        </div>
      )}

      {/* Damage Vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-75"
          style={{
            opacity: Math.min(0.85, hud.damageFlash),
            boxShadow: 'inset 0 0 110px 45px rgba(185, 28, 28, 0.85)',
          }}
        />
      )}

      {/* Top Row: Objective (Left), Compass & Boss Bar (Center), Minimap (Right) */}
      <div className="flex items-start justify-between p-4 sm:p-5 gap-4">
        {/* Top-Left Mission Objective */}
        <div className="bg-[#080a0e]/85 border border-zinc-800 px-4 py-3 max-w-xs sm:max-w-sm">
          <div className="flex items-center gap-2 text-[11px] font-mono-tech tracking-widest text-red-400">
            <span>OBJECTIVE</span>
            <span aria-hidden="true">·</span>
            <span>{charDef.callsign}</span>
            {hud.objectiveDistance !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 tabular-nums">{hud.objectiveDistance}M</span>
              </>
            )}
          </div>
          <div
            className={`font-display font-semibold text-zinc-100 mt-0.5 tracking-wide ${
              settings.largeHudText ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
            }`}
          >
            {hud.objectiveTitle}
          </div>
          <div
            className={`text-zinc-300 mt-1 leading-relaxed ${
              settings.largeHudText ? 'text-sm sm:text-base' : 'text-xs'
            }`}
          >
            {hud.objectiveDetail}
          </div>
          {hud.subObjectiveProgress && (
            <div className="text-[11px] font-mono-tech text-sky-400 mt-1.5 tabular-nums">
              {hud.subObjectiveProgress}
            </div>
          )}
          <div className="flex items-center gap-3 text-[11px] font-mono-tech text-zinc-400 mt-2 pt-1.5 border-t border-zinc-800/80 tabular-nums">
            <span className="text-amber-400">SALVAGE {hud.salvageCores}</span>
            {hud.secretsTotalInLevel > 0 && (
              <>
                <span className="text-zinc-600">|</span>
                <span>
                  SECRETS {hud.secretsFoundInLevel}/{hud.secretsTotalInLevel}
                </span>
              </>
            )}
            {hud.inZeroG && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-sky-300 font-semibold">ZERO-G</span>
              </>
            )}
            {hud.inWater && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-cyan-400 font-semibold">SUBMERGED</span>
              </>
            )}
          </div>
          {hud.checkpointSavedTimer > 0 && (
            <div className="text-[11px] font-mono-tech text-amber-400 mt-1.5">
              CHECKPOINT SAVED
            </div>
          )}

          {/* Interactive Tutorial Checklist */}
          {hud.tutorial && (
            <div className="mt-2.5 pt-2 border-t border-sky-800/70 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono-tech text-sky-400 tracking-widest">
                <span>TRAINING CHECKLIST</span>
                <span className="tabular-nums">
                  {hud.tutorial.completedSteps.length}/{hud.tutorial.total}
                </span>
              </div>
              <div className="w-full h-1 bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-200"
                  style={{
                    width: `${Math.round(
                      (hud.tutorial.completedSteps.length / Math.max(1, hud.tutorial.total)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-start gap-1.5 text-xs text-zinc-100 pt-0.5">
                {hud.tutorial.completedSteps.length >= hud.tutorial.total ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                )}
                <div className="leading-snug">
                  <div className="font-mono-tech text-[11px] font-semibold text-sky-300">
                    STEP {hud.tutorial.index + 1}/{hud.tutorial.total}: {hud.tutorial.label}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{hud.tutorial.hint}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top-Center Compass & Boss Health */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-[#080a0e]/85 border border-zinc-800 px-5 py-1.5 flex items-center gap-3.5 text-xs font-mono-tech text-zinc-300 tabular-nums">
            <span>HDG {String(hud.compassHeading).padStart(3, '0')}°</span>
            <span className="text-red-400 font-semibold">{cardinal}</span>
            {hud.objectiveDistance !== null && settings.navigationAssist && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-amber-400 font-semibold">
                  {objDirArrow} {objGuideText} · {hud.objectiveDistance}m
                </span>
              </>
            )}
            <span className="text-zinc-600">|</span>
            <span>KILLS {hud.enemiesDefeated}</span>
          </div>

          {hud.boss.active && (
            <div className="w-[320px] sm:w-[480px] bg-[#0a0708]/92 border border-red-900/80 px-4 py-2.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold tracking-wider text-red-400">
                    {hud.boss.name}
                  </span>
                  {hud.boss.isEnraged && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-tech font-bold bg-red-950 border border-red-600/80 text-red-300">
                      ENRAGED
                    </span>
                  )}
                </div>
                <span className="font-mono-tech text-[11px] text-zinc-300">
                  {hud.boss.subtitle}
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-900 border border-zinc-800 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-100"
                  style={{ width: `${Math.max(0, (hud.boss.health / hud.boss.maxHealth) * 100)}%` }}
                />
              </div>
              {hud.boss.activeWarning && (
                <div className="mt-1.5 text-center text-[11px] font-mono-tech font-bold tracking-[0.16em] text-amber-300 bg-amber-950/60 border border-amber-600/60 py-0.5 px-2">
                  ⚠ {hud.boss.activeWarning}
                </div>
              )}
            </div>
          )}

          {hud.radioBanner && (
            <div className="max-w-lg bg-[#090b10]/92 border border-red-900/60 px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-2 text-[11px] font-mono-tech text-red-400">
                <Radio className="w-3.5 h-3.5" />
                <span>{hud.radioBanner.speaker}</span>
              </div>
              <p
                className={`text-zinc-100 mt-1 leading-snug ${
                  settings.largeHudText ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                }`}
              >
                {hud.radioBanner.text}
              </p>
            </div>
          )}

          {hud.secretToast && (
            <div className="max-w-md bg-[#120e07]/95 border border-amber-500/80 px-5 py-2 text-center">
              <div className="text-[11px] font-mono-tech tracking-widest text-amber-400">
                SECRET DISCOVERED · +{hud.secretToast.salvage} SALVAGE CORES
              </div>
              <div className="font-display text-sm font-bold text-zinc-100 mt-0.5">
                {hud.secretToast.title}
              </div>
            </div>
          )}

          {hud.missionBanner && (
            <div
              className="mt-4 max-w-xl bg-[#07090d]/92 border-y border-red-600/80 px-8 py-4 text-center transition-opacity duration-300"
              style={{ opacity: Math.min(1, hud.missionBanner.timer / 1.2) }}
            >
              <div className="font-display text-lg sm:text-2xl font-bold tracking-[0.22em] text-zinc-100">
                {hud.missionBanner.title}
              </div>
              <div className="text-xs sm:text-sm font-mono-tech tracking-wider text-red-400 mt-1.5">
                {hud.missionBanner.objective}
              </div>
            </div>
          )}

          {hud.chapterIntro && !hud.missionBanner && (
            <div
              className="mt-6 max-w-xl bg-[#07090d]/94 border-y border-red-600/80 px-8 py-4 text-center transition-opacity duration-300"
              style={{ opacity: Math.min(1, hud.chapterIntro.timer / 1.0) }}
            >
              <div className="text-[11px] font-mono-tech tracking-[0.26em] text-red-400">
                {hud.chapterIntro.number === 0
                  ? `TRAINING BAY 00 · ${hud.chapterIntro.region}`
                  : `CHAPTER ${String(hud.chapterIntro.number).padStart(2, '0')} · ${hud.chapterIntro.region}`}
              </div>
              <div className="font-display text-xl sm:text-2xl font-bold tracking-[0.18em] text-zinc-100 mt-1">
                {hud.chapterIntro.title}
              </div>
              <div className="text-xs font-mono-tech tracking-wider text-amber-400 mt-1">
                {hud.chapterIntro.subtitle}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Minimap & Quick Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onOpenInventory}
              className="bg-[#080a0e]/85 hover:bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-mono-tech text-zinc-300 transition-colors cursor-pointer"
            >
              [TAB] LOGS
            </button>
            <button
              onClick={onPause}
              className="bg-[#080a0e]/85 hover:bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-mono-tech text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>ESC</span>
            </button>
          </div>

          {settings.showMinimap && (
            <div className="w-32 h-32 bg-[#080a0e]/85 border border-zinc-800 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="w-20 h-20 rounded-full border border-zinc-500" />
              </div>
              {/* Player center triangle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-zinc-100 rotate-45" />
              {/* Radar Blips rotated relative to player yaw */}
              {hud.minimapBlips.map((b, idx) => {
                const dx = b.x - hud.minimapPlayer.x;
                const dz = b.z - hud.minimapPlayer.z;
                const cosY = Math.cos(hud.minimapPlayer.yaw);
                const sinY = Math.sin(hud.minimapPlayer.yaw);
                const rx = dx * cosY - dz * sinY;
                const rz = dx * sinY + dz * cosY;
                const scale = 1.6;
                const px = Math.max(-56, Math.min(56, rx * scale));
                const py = Math.max(-56, Math.min(56, rz * scale));
                const color =
                  b.kind === 'objective'
                    ? 'bg-amber-400 w-2.5 h-2.5'
                    : b.kind === 'teammate'
                      ? 'bg-emerald-400 w-2.5 h-2.5'
                      : b.kind === 'rival'
                        ? 'bg-red-500 w-2.5 h-2.5'
                        : b.kind === 'boss'
                          ? 'bg-red-500 w-3 h-3'
                          : 'bg-red-400 w-2 h-2';
                return (
                  <div
                    key={idx}
                    className={`absolute rounded-full ${color}`}
                    style={{
                      left: `calc(50% + ${px}px)`,
                      top: `calc(50% + ${py}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Multiplayer Squad / PvP Scoreboard */}
          {hud.multiplayer?.active && (
            <div className="w-56 bg-[#080a0e]/88 border border-zinc-800 p-2.5 space-y-1.5 tabular-nums">
              <div className="flex items-center justify-between text-[10px] font-mono-tech border-b border-zinc-800 pb-1">
                <span className="flex items-center gap-1 text-zinc-200 font-semibold">
                  {hud.multiplayer.mode === 'pvp' ? (
                    <Swords className="w-3 h-3 text-red-400" />
                  ) : (
                    <Users className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>{hud.multiplayer.mode === 'pvp' ? 'PVP ARENA' : 'CO-OP SQUAD'}</span>
                </span>
                <span className="text-amber-400">#{hud.multiplayer.roomCode}</span>
              </div>
              <div className="space-y-1">
                {hud.multiplayer.players.map((p) => {
                  const isSelf = p.id === hud.multiplayer?.localPlayerId;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between text-[11px] font-mono-tech ${
                        !p.alive ? 'opacity-45 line-through' : ''
                      }`}
                    >
                      <span
                        className={`truncate max-w-[105px] ${
                          isSelf
                            ? 'text-zinc-100 font-bold'
                            : hud.multiplayer?.mode === 'pvp'
                              ? 'text-red-300'
                              : 'text-emerald-300'
                        }`}
                      >
                        {p.callsign}
                      </span>
                      <span className="text-zinc-400">
                        {hud.multiplayer?.mode === 'pvp'
                          ? `${p.kills}K/${p.deaths}D`
                          : `${Math.max(0, Math.round(p.health))}HP`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PvP Respawn Banner */}
      {hud.multiplayer?.active &&
        hud.multiplayer.respawningIn !== null &&
        hud.multiplayer.respawningIn > 0 && (
          <div className="fixed inset-x-0 top-1/3 flex justify-center z-30 pointer-events-none">
            <div className="bg-[#0e0708]/95 border border-red-600 px-8 py-4 text-center space-y-1">
              <div className="text-xs font-mono-tech tracking-[0.25em] text-red-400">
                OPERATIVE DOWN
              </div>
              <div className="font-display text-2xl font-bold text-zinc-100 tabular-nums">
                REDEPLOYING IN {hud.multiplayer.respawningIn.toFixed(1)}S
              </div>
            </div>
          </div>
        )}

      {/* Center Dynamic Reticle, Hitmarker, Reload & Interact Prompt */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        {!hud.isSniperAds && (
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* Center Dot */}
            <div className="w-1 h-1 rounded-full bg-zinc-100/90" />
            {/* 4 Dynamic Prongs */}
            <div
              className="absolute w-[1.5px] h-2 bg-zinc-100/85"
              style={{ transform: `translateY(-${prongGap}px)` }}
            />
            <div
              className="absolute w-[1.5px] h-2 bg-zinc-100/85"
              style={{ transform: `translateY(${prongGap}px)` }}
            />
            <div
              className="absolute h-[1.5px] w-2 bg-zinc-100/85"
              style={{ transform: `translateX(-${prongGap}px)` }}
            />
            <div
              className="absolute h-[1.5px] w-2 bg-zinc-100/85"
              style={{ transform: `translateX(${prongGap}px)` }}
            />

            {/* Hitmarker Feedback */}
            {hud.hitMarkerTimer > 0 && (
              <div
                className={`absolute w-7 h-7 border-2 rotate-45 pointer-events-none ${
                  hud.hitMarkerCrit ? 'border-amber-400 scale-110' : 'border-red-500'
                }`}
              />
            )}
          </div>
        )}

        {hud.hitMarkerTimer > 0 && hud.hitMarkerCrit && (
          <div className="mt-0.5 text-[10px] font-mono-tech tracking-widest text-amber-400 font-bold">
            CRIT
          </div>
        )}

        {hud.isReloading && (
          <div className="mt-3 w-28 bg-zinc-900/90 border border-zinc-700 p-0.5">
            <div
              className="h-1 bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
            />
          </div>
        )}

        {hud.interactPrompt && (
          <div
            className={`mt-6 bg-[#090b10]/94 border border-amber-500/80 px-4 py-1.5 font-mono-tech tracking-wider text-amber-300 ${
              settings.largeHudText ? 'text-sm sm:text-base' : 'text-xs'
            }`}
          >
            {hud.interactPrompt}
          </div>
        )}
      </div>

      {/* Bottom-Center Non-Occluding Mouse Look Prompt & Controls */}
      {!settings.touchControls && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
          {!hud.pointerLocked && (
            <button
              onClick={onLockPointer}
              className="pointer-events-auto bg-red-950/92 hover:bg-red-900 border border-red-600/85 px-4 py-1.5 text-[11px] font-mono-tech tracking-widest text-zinc-100 cursor-pointer transition-colors"
            >
              CLICK VIEWPORT TO ENGAGE MOUSE LOOK
            </button>
          )}
          <div className="hidden lg:flex items-center gap-3 bg-[#080a0e]/75 border border-zinc-800/80 px-4 py-1.5 text-[11px] font-mono-tech text-zinc-400 whitespace-nowrap">
            <span>WASD MOVE</span>
            <span>·</span>
            <span>SHIFT SPRINT</span>
            <span>·</span>
            <span>C/CTRL CROUCH</span>
            <span>·</span>
            <span>LMB FIRE</span>
            <span>·</span>
            <span>RMB AIM</span>
            <span>·</span>
            <span>R RELOAD</span>
            <span>·</span>
            <span>V MELEE</span>
            <span>·</span>
            <span>Q ABILITY</span>
          </div>
        </div>
      )}

      {/* In-Game Multiplayer Radio Chat above Bottom-Left Vitals */}
      {hud.multiplayer?.active && (
        <div className="fixed bottom-48 left-4 sm:left-5 w-72 z-25 flex flex-col gap-1.5">
          {hud.multiplayer.chat.length > 0 && (
            <div className="bg-[#080a0e]/82 border border-zinc-800/90 px-3 py-2 space-y-1 max-h-28 overflow-hidden text-[11px]">
              {hud.multiplayer.chat.slice(-4).map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.system ? 'font-mono-tech text-amber-300/90' : 'text-zinc-200 leading-tight'
                  }
                >
                  {!msg.system && (
                    <span className="font-mono-tech font-bold text-red-400 mr-1.5">
                      {msg.senderCallsign}:
                    </span>
                  )}
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
          )}

          {chatOpen ? (
            <form
              onSubmit={submitChat}
              className="pointer-events-auto flex items-center gap-1 bg-[#060709]/95 border border-red-600/80 p-1"
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={160}
                placeholder="Squad radio message..."
                className="flex-1 bg-transparent px-2 py-1 text-xs text-zinc-100 outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white cursor-pointer"
                aria-label="Transmit Radio Chat"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setChatOpen(true);
                onChatFocusChange?.(true);
                window.setTimeout(() => chatInputRef.current?.focus(), 20);
              }}
              className="pointer-events-auto self-start bg-[#080a0e]/80 hover:bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[10px] font-mono-tech text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>[T] SQUAD CHAT</span>
            </button>
          )}
        </div>
      )}

      {/* Bottom HUD Corners: Vitals (Left) & Weapon/Ability (Right) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-5 flex items-end justify-between gap-4 pointer-events-none">
        {/* Bottom-Left: Health, Armor, Stamina, Flashlight, Medkits */}
        <div className="bg-[#080a0e]/85 border border-zinc-800 p-3.5 w-64 sm:w-72 space-y-2 tabular-nums">
          <div className="flex items-center justify-between text-xs font-mono-tech">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <HeartPulse className="w-4 h-4 text-red-500" />
              <span>HEALTH</span>
            </span>
            <span className="text-zinc-100 font-semibold">
              {hud.health} / {hud.maxHealth}
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-900 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                hud.health < 30 ? 'bg-red-500' : 'bg-red-600'
              }`}
              style={{ width: `${Math.max(0, (hud.health / hud.maxHealth) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-mono-tech">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>ARMOR</span>
            </span>
            <span className="text-zinc-200">
              {hud.armor} / {hud.maxArmor}
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-100"
              style={{ width: `${Math.max(0, (hud.armor / hud.maxArmor) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-tech text-zinc-400">
            <span>STAMINA</span>
            <span className="text-zinc-300">{hud.stamina}%</span>
          </div>
          <div className="w-full h-1 bg-zinc-900 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                hud.stamina < 25 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/90 text-[11px] font-mono-tech text-zinc-300">
            <span className="flex items-center gap-1">
              <Flashlight className={`w-3.5 h-3.5 ${hud.flashlightOn ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>[F] {hud.flashlightBattery}%</span>
            </span>
            <span>[H] MEDKIT ×{hud.medkits}</span>
          </div>
        </div>

        {/* Bottom-Right: Weapon, Ammo, Special Ability */}
        <div className="bg-[#080a0e]/85 border border-zinc-800 p-3.5 w-64 sm:w-72 space-y-2.5 text-right tabular-nums">
          <div>
            <div className="text-[11px] font-mono-tech text-zinc-400 tracking-wider">
              {weaponDef.category} · SLOT {hud.activeSlot + 1}
            </div>
            <div className="font-display text-sm font-semibold text-zinc-100 tracking-wide">
              {weaponDef.name}
            </div>
          </div>

          <div className="flex items-baseline justify-end gap-2 font-mono-tech">
            <span className={`text-3xl font-bold ${activeWeapon.ammoInMag <= 4 ? 'text-red-400' : 'text-zinc-100'}`}>
              {String(activeWeapon.ammoInMag).padStart(2, '0')}
            </span>
            <span className="text-sm text-zinc-500">/ {activeWeapon.reserveAmmo}</span>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/90 text-[11px] font-mono-tech">
            <span className="text-zinc-400 truncate max-w-[125px]">
              [{secondarySlot + 1}] {WEAPONS[secondaryWeapon.id].name}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-red-400" />
              {hud.abilityActive ? (
                <span className="text-amber-400">
                  {charDef.ability.name} ACTIVE {hud.abilityActiveRemaining.toFixed(1)}s
                </span>
              ) : hud.abilityCooldownRemaining > 0 ? (
                <span className="text-zinc-400">
                  [Q] {hud.abilityCooldownRemaining.toFixed(0)}s
                </span>
              ) : (
                <span className="text-red-400 font-semibold">[Q] {charDef.ability.name} READY</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Touch Controls Overlay */}
      {settings.touchControls && (
        <div className="fixed inset-0 pointer-events-none z-30">
          {/* Left Virtual Stick */}
          <div
            className="fixed bottom-32 left-6 w-28 h-28 rounded-full border border-zinc-600/70 bg-black/50 pointer-events-auto touch-none flex items-center justify-center"
            onTouchStart={(e) => {
              const t = e.touches[0];
              moveStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!moveStartRef.current) return;
              const t = e.touches[0];
              const dx = Math.max(-40, Math.min(40, t.clientX - moveStartRef.current.x)) / 40;
              const dy = Math.max(-40, Math.min(40, t.clientY - moveStartRef.current.y)) / 40;
              onTouchMove(dx, dy);
            }}
            onTouchEnd={() => {
              moveStartRef.current = null;
              onTouchMove(0, 0);
            }}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-400/50 border border-zinc-300/60" />
          </div>

          {/* Right Look Pad */}
          <div
            className="fixed top-20 right-0 w-1/2 h-1/2 pointer-events-auto touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              lookLastRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!lookLastRef.current) return;
              const t = e.touches[0];
              onTouchLook(t.clientX - lookLastRef.current.x, t.clientY - lookLastRef.current.y);
              lookLastRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={() => {
              lookLastRef.current = null;
            }}
          />

          {/* Action Buttons */}
          <div className="fixed bottom-32 right-6 grid grid-cols-3 gap-2 pointer-events-auto">
            <button
              onTouchStart={() => onTouchAction('shoot_start')}
              onTouchEnd={() => onTouchAction('shoot_end')}
              className="w-14 h-14 bg-red-800/85 border border-red-500 text-xs font-mono-tech text-white"
            >
              FIRE
            </button>
            <button
              onClick={() => onTouchAction('aim')}
              className="w-14 h-14 bg-zinc-900/85 border border-zinc-700 text-xs font-mono-tech text-zinc-200"
            >
              AIM
            </button>
            <button
              onClick={() => onTouchAction('reload')}
              className="w-14 h-14 bg-zinc-900/85 border border-zinc-700 text-xs font-mono-tech text-zinc-200"
            >
              RELOAD
            </button>
            <button
              onClick={() => onTouchAction('interact')}
              className="w-14 h-14 bg-amber-900/85 border border-amber-500 text-xs font-mono-tech text-amber-200"
            >
              USE
            </button>
            <button
              onClick={() => onTouchAction('ability')}
              className="w-14 h-14 bg-zinc-900/85 border border-red-700 text-xs font-mono-tech text-red-300"
            >
              SKILL
            </button>
            <button
              onClick={() => onTouchAction('flashlight')}
              className="w-14 h-14 bg-zinc-900/85 border border-zinc-700 text-xs font-mono-tech text-zinc-200"
            >
              LIGHT
            </button>
          </div>
        </div>
      )}

      {/* Subtle Audio Active Indicator in corner */}
      <div className="sr-only">
        <Volume2 />
      </div>
    </div>
  );
};
