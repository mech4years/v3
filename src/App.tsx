import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  GraduationCap,
  Lock,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Skull,
  Unlock,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { CharacterShowcase3D } from './components/CharacterShowcase3D';
import { EndingModal } from './components/EndingModal';
import { GameHud } from './components/GameHud';
import { InventoryDrawer } from './components/InventoryDrawer';
import { MenuBackground3D } from './components/MenuBackground3D';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { OpeningCutscene } from './components/OpeningCutscene';
import { PuzzleModal } from './components/PuzzleModal';
import { SettingsModal } from './components/SettingsModal';
import { WorkbenchModal } from './components/WorkbenchModal';
import { HorrorAudioEngine } from './game/audio';
import {
  CHARACTER_LIST,
  CHARACTERS,
  DEFAULT_SETTINGS,
  FACTIONS,
  MISSIONS,
  WEAPONS,
  WORLD_REGIONS,
  loadCampaignState,
  resetCampaignState,
  saveCampaignState,
} from './game/data';
import { FirstPersonGameEngine, MultiplayerEngineConfig, SAVE_STORAGE_KEY } from './game/engine';
import { multiplayerClient } from './game/multiplayer';
import {
  CampaignState,
  ChapterStats,
  CharacterId,
  CheckpointSave,
  GameScreen,
  GameSettings,
  HudSnapshot,
  MultiplayerRoomState,
} from './game/types';

const SETTINGS_STORAGE_KEY = 'twhr_settings_v1';

function loadStoredSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  return { ...DEFAULT_SETTINGS, touchControls: isTouch && window.innerWidth < 900 };
}

function loadCheckpointSave(): CheckpointSave | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CheckpointSave;
  } catch {
    // ignore
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('cutscene');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('raven');
  const [activeMissionId, setActiveMissionId] = useState<string>('mission_01');
  const [settings, setSettings] = useState<GameSettings>(loadStoredSettings);
  const [campaign, setCampaign] = useState<CampaignState>(loadCampaignState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuWorkbenchOpen, setMenuWorkbenchOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [savedCheckpoint, setSavedCheckpoint] = useState<CheckpointSave | null>(loadCheckpointSave);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [finaleInfo, setFinaleInfo] = useState<{
    title: string;
    summary: string;
    stats?: ChapterStats;
  } | null>(null);
  const [missionTab, setMissionTab] = useState<'missions' | 'world' | 'factions'>('missions');

  const gameMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FirstPersonGameEngine | null>(null);
  const audioRef = useRef<HorrorAudioEngine | null>(null);
  const pendingRestoreRef = useRef<CheckpointSave | null>(null);
  const introModeRef = useRef<'none' | 'cutscene_end' | 'cutscene_skip'>('none');
  const multiplayerConfigRef = useRef<MultiplayerEngineConfig | null>(null);

  if (!audioRef.current) {
    audioRef.current = new HorrorAudioEngine();
  }

  const updateCampaign = useCallback((next: CampaignState) => {
    saveCampaignState(next);
    setCampaign(next);
    engineRef.current?.refreshCampaignState(next);
  }, []);

  const handleSettingsChange = useCallback((next: GameSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    engineRef.current?.updateSettings(next);
    audioRef.current?.applySettings(next);
  }, []);

  const stopGameEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    audioRef.current?.setBossMusic(false);
    setHud(null);
    setInventoryOpen(false);
  }, []);

  const launchMission = useCallback(
    (
      missionId: string,
      charId: CharacterId,
      restore: CheckpointSave | null = null,
      introMode: 'none' | 'cutscene_end' | 'cutscene_skip' = 'none'
    ) => {
      audioRef.current?.unlock();
      audioRef.current?.playClick(true);
      stopGameEngine();
      multiplayerConfigRef.current = null;
      setActiveMissionId(missionId);
      setSelectedCharacter(charId);
      pendingRestoreRef.current = restore;
      introModeRef.current = introMode;
      setFinaleInfo(null);
      setMenuWorkbenchOpen(false);
      setScreen('playing');
    },
    [stopGameEngine]
  );

  const launchMultiplayerMatch = useCallback(
    (room: MultiplayerRoomState, localPlayerId: string) => {
      const localPlayer = room.players.find((p) => p.id === localPlayerId);
      const charId = localPlayer?.characterId ?? selectedCharacter;
      audioRef.current?.unlock();
      audioRef.current?.playClick(true);
      stopGameEngine();
      multiplayerConfigRef.current = { room, localPlayerId };
      setActiveMissionId(room.missionId);
      setSelectedCharacter(charId);
      pendingRestoreRef.current = null;
      introModeRef.current = 'none';
      setFinaleInfo(null);
      setMenuWorkbenchOpen(false);
      setScreen('playing');
    },
    [selectedCharacter, stopGameEngine]
  );

  const launchOpeningCutscene = useCallback(
    (charId: CharacterId) => {
      audioRef.current?.unlock();
      audioRef.current?.playClick(true);
      stopGameEngine();
      multiplayerConfigRef.current = null;
      setActiveMissionId('mission_01');
      setSelectedCharacter(charId);
      pendingRestoreRef.current = null;
      setFinaleInfo(null);
      setScreen('cutscene');
    },
    [stopGameEngine]
  );

  const handleCutsceneComplete = useCallback(() => {
    audioRef.current?.unlock();
    stopGameEngine();
    multiplayerConfigRef.current = null;
    setActiveMissionId('mission_01');
    pendingRestoreRef.current = null;
    introModeRef.current = 'cutscene_end';
    setFinaleInfo(null);
    setScreen('playing');
  }, [stopGameEngine]);

  const handleCutsceneSkip = useCallback(() => {
    audioRef.current?.unlock();
    stopGameEngine();
    multiplayerConfigRef.current = null;
    setActiveMissionId('mission_01');
    pendingRestoreRef.current = null;
    introModeRef.current = 'cutscene_skip';
    setFinaleInfo(null);
    setScreen('playing');
  }, [stopGameEngine]);

  useEffect(() => {
    const isGameplay =
      screen === 'playing' ||
      screen === 'paused' ||
      screen === 'dead' ||
      screen === 'mission_complete';

    if (!isGameplay) {
      stopGameEngine();
      setSavedCheckpoint(loadCheckpointSave());
      setCampaign(loadCampaignState());
      return;
    }

    if (engineRef.current || !gameMountRef.current || !audioRef.current) return;

    const introMode = introModeRef.current;
    introModeRef.current = 'none';

    const engine = new FirstPersonGameEngine(
      gameMountRef.current,
      selectedCharacter,
      activeMissionId,
      settings,
      audioRef.current,
      {
        onHudUpdate: (snapshot) => setHud(snapshot),
        onLoreCollected: () => {
          setSavedCheckpoint(loadCheckpointSave());
          setCampaign(loadCampaignState());
        },
        onCampaignSync: (nextCamp) => setCampaign(nextCamp),
        onPauseRequested: () => setScreen('paused'),
        onPlayerDied: () => setScreen('dead'),
        onMissionComplete: (title, summary, stats) => {
          setCampaign(loadCampaignState());
          setFinaleInfo({ title, summary, stats });
          setScreen('mission_complete');
        },
      },
      pendingRestoreRef.current,
      introMode,
      campaign,
      multiplayerConfigRef.current
    );
    pendingRestoreRef.current = null;
    engineRef.current = engine;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && screen === 'playing') {
        if (hud?.activePuzzleId || hud?.workbenchOpen || hud?.endingChoiceOpen) return;
        e.preventDefault();
        setInventoryOpen((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, hud?.activePuzzleId, hud?.workbenchOpen, hud?.endingChoiceOpen]);

  useEffect(() => {
    return () => {
      stopGameEngine();
      audioRef.current?.dispose();
    };
  }, [stopGameEngine]);

  const resumeGame = () => {
    setInventoryOpen(false);
    setScreen('playing');
    engineRef.current?.setPaused(false);
    engineRef.current?.requestPointerLock();
  };

  const activeChar = CHARACTERS[selectedCharacter];
  const mainChapters = MISSIONS.filter((m) => !m.isBonusArena && !m.isTutorial);
  const completedMainCount = mainChapters.filter((m) =>
    campaign.completedMissionIds.includes(m.id)
  ).length;
  const currentMissionDef = MISSIONS.find((m) => m.id === activeMissionId);
  const nextMissionDef =
    !multiplayerConfigRef.current && currentMissionDef?.isTutorial
      ? MISSIONS.find((m) => m.id === 'mission_01')
      : !multiplayerConfigRef.current &&
          currentMissionDef &&
          !currentMissionDef.isBonusArena &&
          currentMissionDef.number < 12
        ? MISSIONS.find(
            (m) => m.number === currentMissionDef.number + 1 && !m.isBonusArena && !m.isTutorial
          )
        : undefined;

  return (
    <div className="relative w-full h-full bg-[#060709] text-zinc-100 overflow-hidden">
      {/* Opening 3D Cinematic Cutscene */}
      {screen === 'cutscene' && audioRef.current && (
        <OpeningCutscene
          audio={audioRef.current}
          onComplete={handleCutsceneComplete}
          onSkip={handleCutsceneSkip}
        />
      )}

      {/* Live 3D Background for Menu / Sub-menus */}
      {(screen === 'menu' ||
        screen === 'missions' ||
        screen === 'multiplayer' ||
        screen === 'credits' ||
        screen === 'settings') && <MenuBackground3D />}

      {/* Main Menu */}
      {screen === 'menu' && (
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 sm:p-12 bg-gradient-to-r from-black/85 via-black/45 to-transparent">
          <div className="flex items-center justify-between text-xs font-mono-tech text-zinc-400">
            <span>YEAR 3062 AD · 12-CHAPTER SURVIVAL HORROR CAMPAIGN</span>
            <span>OPERATIVE: {activeChar.callsign}</span>
          </div>

          <div className="max-w-xl space-y-8 my-auto">
            <div className="space-y-3">
              <p className="text-xs font-mono-tech tracking-[0.25em] text-red-500">
                THE METEORS WERE ONLY THE BEGINNING
              </p>
              <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-zinc-100 leading-[0.98]">
                THE WORLD HAS ROTTEN
              </h1>
              <p className="text-sm text-zinc-300 max-w-md leading-relaxed">
                Three years after THEY infected Earth’s metals and hijacked the HELIOS satellite grid,
                descend from the ruined Quarantine Zone to the alien chamber beneath the crust.
              </p>
            </div>

            <nav className="flex flex-col items-start gap-2.5 w-full max-w-xs">
              <button
                onClick={() => launchOpeningCutscene(selectedCharacter)}
                className="w-full flex items-center justify-between px-5 py-3 bg-red-700 hover:bg-red-600 text-white font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>NEW CAMPAIGN (CH.01)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                disabled={!savedCheckpoint}
                onClick={() => {
                  if (savedCheckpoint) {
                    launchMission(
                      savedCheckpoint.missionId,
                      savedCheckpoint.characterId,
                      savedCheckpoint
                    );
                  }
                }}
                className={`w-full flex items-center justify-between px-5 py-3 border font-display font-semibold tracking-wider transition-colors ${
                  savedCheckpoint
                    ? 'bg-[#0b0d12]/90 hover:bg-zinc-900 border-zinc-700 text-zinc-100 cursor-pointer'
                    : 'bg-[#0b0d12]/50 border-zinc-900 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <span>CONTINUE SAVE</span>
                <span className="font-mono-tech text-[11px]">
                  {savedCheckpoint ? savedCheckpoint.missionId.toUpperCase() : 'NO SAVE'}
                </span>
              </button>

              <button
                onClick={() => launchMission('mission_tutorial', selectedCharacter, null)}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#091219]/90 hover:bg-sky-950/70 border border-sky-700/80 text-sky-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>TRAINING PROTOCOL (TUTORIAL)</span>
                <GraduationCap className="w-4 h-4 text-sky-400" />
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setScreen('multiplayer');
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-amber-700/70 text-amber-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>MULTIPLAYER (CO-OP / PVP)</span>
                <Users className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setScreen('missions');
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>CAMPAIGN CHAPTERS ({completedMainCount}/12)</span>
                <Crosshair className="w-4 h-4 text-red-400" />
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setScreen('characters');
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>CHARACTER SELECTION</span>
                <UserCheck className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setMenuWorkbenchOpen(true);
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>ARMORY WORKBENCH</span>
                <span className="font-mono-tech text-[11px] text-amber-400 tabular-nums">
                  {campaign.salvageCores} CORES
                </span>
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>SETTINGS</span>
                <SettingsIcon className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                onClick={() => {
                  audioRef.current?.playClick(true);
                  setScreen('credits');
                }}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#0b0d12]/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 font-display font-semibold tracking-wider transition-colors cursor-pointer"
              >
                <span>CREDITS</span>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono-tech text-zinc-500 tabular-nums">
            <span>
              PROGRESS: {completedMainCount}/12 CHAPTERS · {campaign.collectedLoreIds.length}/36 LOGS ·{' '}
              {campaign.secretsFoundIds.length}/12 SECRETS
            </span>
            <span>SALVAGE CORES: {campaign.salvageCores}</span>
          </div>
        </div>
      )}

      {/* 3D Character Selection Screen */}
      {screen === 'characters' && (
        <div className="relative z-10 w-full h-full bg-[#06070a] flex flex-col">
          <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <button
              onClick={() => setScreen('menu')}
              className="flex items-center gap-2 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>BACK TO MENU</span>
            </button>
            <h2 className="font-display text-lg font-bold tracking-wider">OPERATIVE SELECTION</h2>
            <button
              onClick={() => launchMission('mission_01', selectedCharacter, null)}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white cursor-pointer"
            >
              DEPLOY AS {activeChar.callsign}
            </button>
          </header>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            <div className="lg:col-span-3 border-r border-zinc-800 p-4 space-y-2 overflow-y-auto bg-[#080a0e]">
              {CHARACTER_LIST.map((char) => {
                const selected = char.id === selectedCharacter;
                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      audioRef.current?.playClick(true);
                      setSelectedCharacter(char.id);
                    }}
                    className={`w-full text-left p-3.5 border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-red-950/60 border-red-600 text-zinc-100'
                        : 'bg-[#0b0d12] border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold tracking-wider text-base">
                        {char.callsign}
                      </span>
                      <span className="font-mono-tech text-[11px] text-red-400">
                        HP {char.stats.health}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{char.role}</div>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-5 relative bg-[#07090d] flex flex-col">
              <CharacterShowcase3D characterId={selectedCharacter} />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-mono-tech text-zinc-400 bg-black/75 px-3 py-1 border border-zinc-800">
                DRAG TO ROTATE FULL-BODY 3D MODEL
              </div>
            </div>

            <div className="lg:col-span-4 border-l border-zinc-800 p-6 overflow-y-auto space-y-5 bg-[#080a0e]">
              <div>
                <div className="text-xs font-mono-tech text-red-400">{activeChar.role}</div>
                <h3 className="font-display text-3xl font-bold tracking-wide text-zinc-100 mt-0.5">
                  {activeChar.callsign}
                </h3>
                <p className="text-xs text-zinc-300 mt-2 leading-relaxed">{activeChar.bio}</p>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  Loadout: {activeChar.appearanceSummary}
                </p>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-zinc-800">
                {[
                  { label: 'Health', value: activeChar.stats.health, max: 150 },
                  { label: 'Speed', value: activeChar.stats.speed, max: 100 },
                  { label: 'Armor', value: activeChar.stats.armor, max: 100 },
                  {
                    label: activeChar.stats.specialtyLabel,
                    value: activeChar.stats.specialtyValue,
                    max: 100,
                  },
                ].map((s) => (
                  <div key={s.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono-tech">
                      <span className="text-zinc-400">{s.label}</span>
                      <span className="text-zinc-200">{s.value}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900">
                      <div
                        className="h-full bg-red-600"
                        style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-zinc-800 bg-[#0b0d12] p-4 space-y-1.5">
                <div className="text-[11px] font-mono-tech text-zinc-400">PRIMARY WEAPON</div>
                <div className="font-display font-semibold text-zinc-100">
                  {WEAPONS[activeChar.primaryWeapon].name}
                </div>
                <div className="text-xs text-zinc-400">
                  DMG {WEAPONS[activeChar.primaryWeapon].damage} · MAG{' '}
                  {WEAPONS[activeChar.primaryWeapon].magSize} · PLUS{' '}
                  {WEAPONS[campaign.equippedSecondary].name}
                </div>
              </div>

              <div className="border border-red-900/60 bg-[#12090b] p-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono-tech text-red-400">
                  <span>SPECIAL ABILITY [Q]</span>
                  <span>CD {activeChar.ability.cooldown}s</span>
                </div>
                <div className="font-display font-bold text-lg text-zinc-100">
                  {activeChar.ability.name}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {activeChar.ability.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Chapter Campaign Map & Missions Screen */}
      {screen === 'missions' && (
        <div className="relative z-10 w-full h-full bg-black/88 flex flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-[#080a0e]">
            <button
              onClick={() => setScreen('menu')}
              className="flex items-center gap-2 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>BACK TO MENU</span>
            </button>
            <div className="flex items-center gap-2">
              {(['missions', 'world', 'factions'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMissionTab(t)}
                  className={`px-3 py-1.5 text-xs font-mono-tech uppercase cursor-pointer ${
                    missionTab === t
                      ? 'bg-red-900 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMenuWorkbenchOpen(true)}
                className="px-3 py-1.5 border border-amber-600/70 bg-amber-950/40 hover:bg-amber-900/50 text-xs font-mono-tech text-amber-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>WORKBENCH ({campaign.salvageCores})</span>
              </button>
              <button
                onClick={() =>
                  updateCampaign({
                    ...campaign,
                    unlockAllChapters: !campaign.unlockAllChapters,
                  })
                }
                className={`px-3 py-1.5 border text-xs font-mono-tech flex items-center gap-1.5 cursor-pointer ${
                  campaign.unlockAllChapters
                    ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {campaign.unlockAllChapters ? (
                  <Unlock className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>{campaign.unlockAllChapters ? 'ALL UNLOCKED' : 'UNLOCK ALL CHAPTERS'}</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-5">
            {missionTab === 'missions' && (
              <>
                {/* Campaign Progress Tracker Bar */}
                <div className="border border-zinc-800 bg-[#090b10] p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono-tech tabular-nums">
                  <div>
                    <div className="text-zinc-500">CHAPTERS CLEARED</div>
                    <div className="text-base font-bold text-zinc-100 mt-0.5">
                      {completedMainCount} / 12
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">ARCHIVES RECOVERED</div>
                    <div className="text-base font-bold text-sky-400 mt-0.5">
                      {campaign.collectedLoreIds.length} / 36
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">SECRET CACHES</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">
                      {campaign.secretsFoundIds.length} / 12
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">SALVAGE CORES</div>
                    <div className="text-base font-bold text-amber-300 mt-0.5">
                      {campaign.salvageCores}
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => {
                        const fresh = resetCampaignState();
                        setCampaign(fresh);
                        localStorage.removeItem(SAVE_STORAGE_KEY);
                        setSavedCheckpoint(null);
                      }}
                      className="px-3 py-1.5 border border-zinc-800 hover:border-red-600 text-[11px] text-zinc-400 hover:text-red-300 cursor-pointer"
                    >
                      RESET CAMPAIGN
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {MISSIONS.map((m) => {
                    const isUnlocked =
                      m.isTutorial ||
                      m.isBonusArena ||
                      campaign.unlockAllChapters ||
                      m.number <= campaign.unlockedLevel;
                    const isCleared = campaign.completedMissionIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        className={`border p-4 flex flex-col justify-between space-y-4 ${
                          m.isTutorial
                            ? 'border-sky-700/80 bg-[#081018]'
                            : m.isBonusArena
                              ? 'border-amber-700/80 bg-[#120e08]'
                              : isUnlocked
                                ? 'border-red-800/80 bg-[#0d0a0c]'
                                : 'border-zinc-800/80 bg-[#090b0f]/90 opacity-65'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono-tech">
                            <span
                              className={
                                m.isTutorial
                                  ? 'text-sky-400'
                                  : m.isBonusArena
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                              }
                            >
                              {m.isTutorial
                                ? 'TRAINING BAY 00'
                                : m.isBonusArena
                                  ? 'BONUS ARENA'
                                  : `LEVEL ${String(m.number).padStart(2, '0')}`}
                            </span>
                            <span className="text-zinc-400 truncate max-w-[170px]">{m.region}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-lg font-bold text-zinc-100">
                              {m.title}
                            </h3>
                            {isCleared && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{m.summary}</p>
                          <div className="pt-1 text-[11px] font-mono-tech text-zinc-500">
                            THREAT: <span className="text-zinc-300">{m.primaryMonster}</span>
                            {m.hasZeroG && ' · ZERO-G'}
                            {m.hasFlooding && ' · FLOODED'}
                          </div>
                        </div>

                        {isUnlocked ? (
                          <button
                            onClick={() => launchMission(m.id, selectedCharacter, null)}
                            className={`w-full py-2 px-3 text-xs font-mono-tech font-semibold text-white flex items-center justify-center gap-2 cursor-pointer ${
                              m.isTutorial
                                ? 'bg-sky-700 hover:bg-sky-600'
                                : m.isBonusArena
                                  ? 'bg-amber-700 hover:bg-amber-600'
                                  : 'bg-red-700 hover:bg-red-600'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>
                              {m.isTutorial
                                ? 'DEPLOY · TUTORIAL'
                                : m.isBossMission
                                  ? 'DEPLOY · BOSS CHAPTER'
                                  : 'DEPLOY CHAPTER'}
                            </span>
                          </button>
                        ) : (
                          <div className="w-full py-2 px-3 border border-zinc-800 text-xs font-mono-tech text-zinc-500 flex items-center justify-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            <span>COMPLETE LEVEL {String(m.number - 1).padStart(2, '0')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {missionTab === 'world' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {WORLD_REGIONS.map((r) => (
                  <div key={r.id} className="border border-zinc-800 bg-[#090b0f] p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold text-zinc-100">{r.name}</h3>
                      <span className="text-xs font-mono-tech text-red-400">{r.status}</span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            )}

            {missionTab === 'factions' && (
              <div className="space-y-4">
                {FACTIONS.map((f) => (
                  <div key={f.id} className="border border-zinc-800 bg-[#090b0f] p-5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold text-zinc-100">{f.name}</h3>
                      <span className="text-xs italic text-red-400">"{f.motto}"</span>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{f.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multiplayer Lobby Screen */}
      {screen === 'multiplayer' && (
        <MultiplayerLobby
          selectedCharacter={selectedCharacter}
          onChangeCharacter={(charId) => setSelectedCharacter(charId)}
          onBack={() => setScreen('menu')}
          onStartMatch={launchMultiplayerMatch}
        />
      )}

      {/* Credits Screen */}
      {screen === 'credits' && (
        <div className="relative z-10 w-full h-full bg-black/85 flex items-center justify-center p-6">
          <div className="max-w-xl w-full border border-zinc-800 bg-[#0b0d12] p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-mono-tech text-red-500">3062 AD // ARCHIVE</p>
              <h2 className="font-display text-3xl font-bold tracking-wider">
                THE WORLD HAS ROTTEN
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                A 12-chapter first-person 3D sci-fi survival horror campaign built with procedural
                WebGL geometry, physically-based materials, spatial Web Audio synthesis, and
                real-time biomechanical AI.
              </p>
            </div>
            <div className="border-t border-zinc-800 pt-4 space-y-2 text-xs text-zinc-400 font-mono-tech">
              <div className="flex justify-between">
                <span>CAMPAIGN</span>
                <span className="text-zinc-200">12 CHAPTERS + TITANFORGED CRUCIBLE</span>
              </div>
              <div className="flex justify-between">
                <span>OPERATIVES</span>
                <span className="text-zinc-200">RAVEN · GHOST · BRUTE · NYX · ZERO</span>
              </div>
              <div className="flex justify-between">
                <span>ENDINGS UNLOCKED</span>
                <span className="text-zinc-200">
                  {campaign.endingsReached.length > 0
                    ? campaign.endingsReached.join(', ')
                    : 'NONE YET'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setScreen('menu')}
              className="w-full py-3 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white cursor-pointer"
            >
              RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Isolated 3D Gameplay Canvas Mount */}
      <div
        ref={gameMountRef}
        className={`fixed inset-0 z-10 ${
          screen === 'playing' ||
          screen === 'paused' ||
          screen === 'dead' ||
          screen === 'mission_complete'
            ? 'block'
            : 'hidden'
        }`}
      />

      {/* Active HUD */}
      {screen === 'playing' &&
        hud &&
        !inventoryOpen &&
        !hud.activePuzzleId &&
        !hud.workbenchOpen &&
        !hud.endingChoiceOpen && (
          <GameHud
            hud={hud}
            characterId={selectedCharacter}
            settings={settings}
            onLockPointer={() => engineRef.current?.requestPointerLock()}
            onPause={() => {
              engineRef.current?.setPaused(true);
              setScreen('paused');
            }}
            onOpenInventory={() => {
              engineRef.current?.setPaused(true);
              setInventoryOpen(true);
            }}
            onTouchMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
            onTouchLook={(dx, dy) => engineRef.current?.addTouchLook(dx, dy)}
            onTouchAction={(act) => engineRef.current?.triggerTouchAction(act)}
            onSendChat={(text) => multiplayerClient.sendChat(text)}
            onChatFocusChange={(focused) => engineRef.current?.setChatFocused(focused)}
          />
        )}

      {/* Engineering Math Puzzle Modal */}
      {screen === 'playing' && hud?.activePuzzleId && (
        <PuzzleModal
          puzzleId={hud.activePuzzleId}
          audio={audioRef.current}
          initialChallenge={engineRef.current?.getGeneratorChallenge(hud.activePuzzleId)}
          onChallengeChange={(next) => {
            if (hud.activePuzzleId) {
              engineRef.current?.updateGeneratorChallenge(hud.activePuzzleId, next);
            }
          }}
          onResolve={(solved) => {
            if (hud.activePuzzleId) {
              engineRef.current?.solvePuzzle(hud.activePuzzleId, solved);
            }
          }}
        />
      )}

      {/* In-Game Armory Workbench Modal */}
      {screen === 'playing' && hud?.workbenchOpen && (
        <WorkbenchModal
          campaign={campaign}
          characterId={selectedCharacter}
          audio={audioRef.current}
          onUpdateCampaign={updateCampaign}
          onClose={() => engineRef.current?.closeWorkbench(loadCampaignState())}
        />
      )}

      {/* Level 12 Master HELIOS Control Spire Ending Choice Modal */}
      {screen === 'playing' && hud?.endingChoiceOpen && (
        <EndingModal
          onSelectEnding={(endingId) => {
            engineRef.current?.selectEnding(endingId);
          }}
        />
      )}

      {/* Menu / Chapter Complete Workbench Modal */}
      {menuWorkbenchOpen && (
        <WorkbenchModal
          campaign={campaign}
          characterId={selectedCharacter}
          audio={audioRef.current}
          onUpdateCampaign={updateCampaign}
          onClose={() => setMenuWorkbenchOpen(false)}
        />
      )}

      {/* Inventory & Lore Drawer */}
      {screen === 'playing' && hud && inventoryOpen && (
        <InventoryDrawer
          hud={hud}
          onClose={() => {
            setInventoryOpen(false);
            engineRef.current?.setPaused(false);
            engineRef.current?.requestPointerLock();
          }}
        />
      )}

      {/* Pause Menu */}
      {screen === 'paused' && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0b0d12] border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="font-display text-xl font-bold tracking-wider">SIMULATION PAUSED</h2>
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div className="space-y-2.5">
              <button
                onClick={resumeGame}
                className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white cursor-pointer"
              >
                RESUME GAME
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full py-2.5 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-zinc-200 cursor-pointer"
              >
                SETTINGS
              </button>
              {!multiplayerConfigRef.current && (
                <button
                  onClick={() => launchMission(activeMissionId, selectedCharacter, null)}
                  className="w-full py-2.5 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-zinc-200 cursor-pointer"
                >
                  RESTART CHAPTER
                </button>
              )}
              {multiplayerConfigRef.current && (
                <button
                  onClick={() => {
                    stopGameEngine();
                    multiplayerConfigRef.current = null;
                    setScreen('multiplayer');
                  }}
                  className="w-full py-2.5 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-amber-300 cursor-pointer"
                >
                  RETURN TO SQUAD LOBBY
                </button>
              )}
              <button
                onClick={() => {
                  stopGameEngine();
                  if (multiplayerConfigRef.current) {
                    multiplayerClient.leaveRoom();
                    multiplayerConfigRef.current = null;
                  }
                  setScreen('menu');
                }}
                className="w-full py-2.5 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-800 text-xs font-mono-tech text-zinc-400 cursor-pointer"
              >
                EXIT TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Death Screen */}
      {screen === 'dead' && (
        <div className="fixed inset-0 z-30 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-red-900/70 bg-[#0e0708] p-8 text-center space-y-5">
            <Skull className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h2 className="font-display text-3xl font-bold tracking-wider text-red-500">
                SIGNAL LOST
              </h2>
              <p className="text-sm text-zinc-400 mt-2">
                {activeChar.callsign} fell in {currentMissionDef?.title ?? 'the quarantine zone'}.
                Your metallic gear remains behind.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              {!multiplayerConfigRef.current &&
                savedCheckpoint &&
                savedCheckpoint.missionId === activeMissionId && (
                  <button
                    onClick={() =>
                      launchMission(activeMissionId, selectedCharacter, savedCheckpoint)
                    }
                    className="w-full py-3 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>RELOAD LAST CHECKPOINT</span>
                  </button>
                )}
              {!multiplayerConfigRef.current ? (
                <button
                  onClick={() => launchMission(activeMissionId, selectedCharacter, null)}
                  className="w-full py-3 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-700 text-xs font-mono-tech text-zinc-200 cursor-pointer"
                >
                  RESTART CHAPTER
                </button>
              ) : (
                <button
                  onClick={() => {
                    stopGameEngine();
                    multiplayerConfigRef.current = null;
                    setScreen('multiplayer');
                  }}
                  className="w-full py-3 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white cursor-pointer"
                >
                  RETURN TO SQUAD LOBBY
                </button>
              )}
              <button
                onClick={() => {
                  stopGameEngine();
                  if (multiplayerConfigRef.current) {
                    multiplayerClient.leaveRoom();
                    multiplayerConfigRef.current = null;
                  }
                  setScreen('menu');
                }}
                className="w-full py-3 bg-[#080a0e] hover:bg-zinc-900 border border-zinc-800 text-xs font-mono-tech text-zinc-400 cursor-pointer"
              >
                RETURN TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Complete / Level 12 Ending Cut-to-Black Screen */}
      {screen === 'mission_complete' && (
        <div className="fixed inset-0 z-40 bg-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full text-center space-y-6">
            <p className="text-xs font-mono-tech tracking-[0.3em] text-red-500">
              {activeMissionId === 'mission_12'
                ? 'CAMPAIGN FINALE'
                : currentMissionDef?.isTutorial
                  ? 'TRAINING BAY 00 COMPLETE'
                  : `CHAPTER ${String(currentMissionDef?.number ?? 1).padStart(2, '0')} COMPLETE`}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-zinc-100">
              {finaleInfo?.title || 'THE WORLD HAS ROTTEN'}
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-xl mx-auto">
              {finaleInfo?.summary}
            </p>

            {activeMissionId === 'mission_12' && (
              <div className="border-y border-red-900/70 py-5 space-y-1.5">
                <div className="font-display text-2xl sm:text-3xl font-bold tracking-[0.22em] text-zinc-100">
                  THE WORLD HAS ROTTEN.
                </div>
                <div className="font-mono-tech text-xs sm:text-sm tracking-[0.25em] text-red-400">
                  BUT SOMETHING IS STILL GROWING.
                </div>
              </div>
            )}

            {finaleInfo?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-zinc-800 bg-[#090b10] p-4 text-xs font-mono-tech tabular-nums">
                <div>
                  <div className="text-zinc-500">TIME</div>
                  <div className="text-zinc-100 font-bold mt-0.5">
                    {Math.floor(finaleInfo.stats.elapsedSeconds / 60)}m{' '}
                    {finaleInfo.stats.elapsedSeconds % 60}s
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">HOSTILES</div>
                  <div className="text-red-400 font-bold mt-0.5">
                    {finaleInfo.stats.enemiesDefeated}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">SALVAGE EARNED</div>
                  <div className="text-amber-400 font-bold mt-0.5">
                    +{finaleInfo.stats.salvageEarned}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">SECRETS / LOGS</div>
                  <div className="text-sky-400 font-bold mt-0.5">
                    {finaleInfo.stats.secretsFound}/{finaleInfo.stats.secretsTotal} ·{' '}
                    {finaleInfo.stats.docsFound}/{finaleInfo.stats.docsTotal}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {nextMissionDef && (
                <button
                  onClick={() => launchMission(nextMissionDef.id, selectedCharacter, null)}
                  className="px-6 py-3 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white cursor-pointer flex items-center gap-2"
                >
                  <span>
                    PROCEED TO LEVEL {String(nextMissionDef.number).padStart(2, '0')}:{' '}
                    {nextMissionDef.title}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setMenuWorkbenchOpen(true)}
                className="px-5 py-3 border border-amber-600/80 bg-amber-950/40 hover:bg-amber-900/50 text-xs font-mono-tech text-amber-300 cursor-pointer flex items-center gap-2"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>ARMORY WORKBENCH ({campaign.salvageCores})</span>
              </button>
              {!multiplayerConfigRef.current && (
                <button
                  onClick={() => launchMission(activeMissionId, selectedCharacter, null)}
                  className="px-5 py-3 border border-zinc-700 hover:border-zinc-500 text-xs font-mono-tech text-zinc-200 cursor-pointer"
                >
                  REPLAY CHAPTER
                </button>
              )}
              {multiplayerConfigRef.current ? (
                <button
                  onClick={() => {
                    stopGameEngine();
                    multiplayerConfigRef.current = null;
                    setScreen('multiplayer');
                  }}
                  className="px-5 py-3 border border-zinc-700 hover:border-zinc-500 text-xs font-mono-tech text-amber-300 cursor-pointer"
                >
                  SQUAD LOBBY
                </button>
              ) : (
                <button
                  onClick={() => {
                    stopGameEngine();
                    setScreen('missions');
                  }}
                  className="px-5 py-3 border border-zinc-800 hover:border-zinc-600 text-xs font-mono-tech text-zinc-400 cursor-pointer"
                >
                  CAMPAIGN MAP
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
