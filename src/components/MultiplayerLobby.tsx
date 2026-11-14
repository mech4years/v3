import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Crosshair,
  Globe,
  Lock,
  Play,
  RefreshCw,
  Send,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import { CHARACTER_LIST, CHARACTERS, MISSIONS, WEAPONS } from '../game/data';
import { multiplayerClient } from '../game/multiplayer';
import {
  CharacterId,
  MultiplayerMode,
  MultiplayerRoomState,
  MultiplayerRoomSummary,
} from '../game/types';

interface Props {
  selectedCharacter: CharacterId;
  onChangeCharacter: (charId: CharacterId) => void;
  onBack: () => void;
  onStartMatch: (room: MultiplayerRoomState, localPlayerId: string) => void;
}

export const MultiplayerLobby: React.FC<Props> = ({
  selectedCharacter,
  onChangeCharacter,
  onBack,
  onStartMatch,
}) => {
  const [connected, setConnected] = useState(multiplayerClient.connected);
  const [rooms, setRooms] = useState<MultiplayerRoomSummary[]>(multiplayerClient.publicRooms);
  const [room, setRoom] = useState<MultiplayerRoomState | null>(multiplayerClient.room);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [callsign, setCallsign] = useState<string>(() => {
    try {
      return localStorage.getItem('twhr_callsign_v1') || CHARACTERS[selectedCharacter].callsign;
    } catch {
      return CHARACTERS[selectedCharacter].callsign;
    }
  });
  const [roomName, setRoomName] = useState('VANGUARD STRIKE TEAM');
  const [mode, setMode] = useState<MultiplayerMode>('coop');
  const [missionId, setMissionId] = useState('mission_01');
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [chatText, setChatText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    multiplayerClient.connect();
    const unsub = multiplayerClient.subscribe({
      onConnectionChange: (isConn) => setConnected(isConn),
      onRoomList: (list) => setRooms([...list]),
      onRoomState: (nextRoom) => {
        setRoom(nextRoom ? { ...nextRoom, players: [...nextRoom.players], chat: [...nextRoom.chat] } : null);
        setErrorMsg(null);
      },
      onRoomStarted: (startedRoom) => {
        onStartMatch(startedRoom, multiplayerClient.clientId);
      },
      onError: (msg) => setErrorMsg(msg),
    });
    if (multiplayerClient.connected) {
      multiplayerClient.requestRoomList();
    }
    return unsub;
  }, [onStartMatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.chat.length]);

  const handleCallsignChange = (val: string) => {
    const clean = val.toUpperCase().slice(0, 16);
    setCallsign(clean);
    try {
      localStorage.setItem('twhr_callsign_v1', clean);
    } catch {
      // ignore
    }
  };

  const handleCharacterSelect = (charId: CharacterId) => {
    onChangeCharacter(charId);
    if (room) {
      multiplayerClient.updatePlayer({ characterId: charId, callsign });
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    multiplayerClient.createRoom({
      name: roomName.trim() || `${callsign || 'RAVEN'} SQUAD`,
      callsign: callsign.trim() || CHARACTERS[selectedCharacter].callsign,
      characterId: selectedCharacter,
      mode,
      missionId,
      isPublic,
    });
  };

  const handleJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setErrorMsg(null);
    multiplayerClient.joinRoom(
      joinCode.trim().toUpperCase(),
      callsign.trim() || CHARACTERS[selectedCharacter].callsign,
      selectedCharacter
    );
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    multiplayerClient.sendChat(chatText);
    setChatText('');
  };

  const localPlayer = room?.players.find((p) => p.id === multiplayerClient.clientId) ?? null;
  const isHost = Boolean(room && room.hostId === multiplayerClient.clientId);

  return (
    <div className="relative z-10 w-full h-full bg-[#06070a]/95 flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 bg-[#080a0e]">
        <button
          onClick={() => {
            if (room) multiplayerClient.leaveRoom();
            onBack();
          }}
          className="flex items-center gap-2 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO MENU</span>
        </button>

        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-red-500" />
          <h2 className="font-display text-lg font-bold tracking-wider">
            HELIOS TACTICAL NETWORK // MULTIPLAYER
          </h2>
        </div>

        <div className="text-xs font-mono-tech flex items-center gap-3 whitespace-nowrap shrink-0">
          <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>
            {connected ? 'WS UPLINK ONLINE' : 'CONNECTING TO RELAY...'}
          </span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-300">{CHARACTERS[selectedCharacter].callsign}</span>
        </div>
      </header>

      {errorMsg && (
        <div className="mx-6 mt-4 border border-red-700 bg-red-950/60 px-4 py-2 text-xs font-mono-tech text-red-200 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {!room ? (
        <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Identity & Host New Squad */}
          <div className="lg:col-span-5 space-y-5">
            <div className="border border-zinc-800 bg-[#090b10] p-5 space-y-4">
              <div className="text-xs font-mono-tech text-red-400 tracking-wider">
                OPERATIVE PROFILE
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono-tech text-zinc-400">CALLSIGN</label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => handleCallsignChange(e.target.value)}
                  maxLength={16}
                  placeholder="RAVEN"
                  className="w-full bg-[#060709] border border-zinc-700 focus:border-red-500 outline-none px-3 py-2 text-xs font-mono-tech text-zinc-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono-tech text-zinc-400">
                  SELECT OPERATIVE CLASS
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CHARACTER_LIST.map((ch) => {
                    const active = ch.id === selectedCharacter;
                    return (
                      <button
                        type="button"
                        key={ch.id}
                        onClick={() => handleCharacterSelect(ch.id)}
                        className={`py-2 px-1 border text-[11px] font-mono-tech font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-red-900/70 border-red-500 text-white'
                            : 'bg-[#060709] border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {ch.callsign}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono-tech pt-1">
                  {CHARACTERS[selectedCharacter].role} ·{' '}
                  {WEAPONS[CHARACTERS[selectedCharacter].primaryWeapon].name}
                </div>
              </div>
            </div>

            <form
              onSubmit={handleCreateRoom}
              className="border border-zinc-800 bg-[#090b10] p-5 space-y-4"
            >
              <div className="text-xs font-mono-tech text-red-400 tracking-wider">
                HOST NEW DEPLOYMENT ROOM
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono-tech text-zinc-400">ROOM NAME</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={28}
                  className="w-full bg-[#060709] border border-zinc-700 focus:border-red-500 outline-none px-3 py-2 text-xs font-mono-tech text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('coop');
                    if (missionId === 'mission_crucible') setMissionId('mission_01');
                  }}
                  className={`p-3 border text-left transition-colors cursor-pointer ${
                    mode === 'coop'
                      ? 'bg-emerald-950/50 border-emerald-500 text-zinc-100'
                      : 'bg-[#060709] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-mono-tech font-bold">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CO-OP SQUAD</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Up to 4 operatives fight monsters & share objectives.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('pvp');
                    setMissionId('mission_crucible');
                  }}
                  className={`p-3 border text-left transition-colors cursor-pointer ${
                    mode === 'pvp'
                      ? 'bg-red-950/50 border-red-500 text-zinc-100'
                      : 'bg-[#060709] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-mono-tech font-bold">
                    <Swords className="w-3.5 h-3.5 text-red-400" />
                    <span>PVP ARENA</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Operative vs operative deathmatch with 3s respawns.
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono-tech text-zinc-400">
                  TARGET SECTOR / ARENA
                </label>
                <select
                  value={missionId}
                  onChange={(e) => setMissionId(e.target.value)}
                  className="w-full bg-[#060709] border border-zinc-700 px-3 py-2 text-xs font-mono-tech text-zinc-100 outline-none"
                >
                  {MISSIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.isTutorial
                        ? `TUTORIAL · ${m.title}`
                        : m.isBonusArena
                          ? `ARENA · ${m.title}`
                          : `CH.${String(m.number).padStart(2, '0')} · ${m.title}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className="flex items-center gap-2 text-xs font-mono-tech text-zinc-300 hover:text-white cursor-pointer"
                >
                  {isPublic ? (
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{isPublic ? 'PUBLIC (LISTED IN BROWSER)' : 'PRIVATE (CODE ONLY)'}</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white tracking-wider cursor-pointer"
              >
                CREATE MULTIPLAYER ROOM
              </button>
            </form>
          </div>

          {/* Right: Join by Code & Public Room Directory */}
          <div className="lg:col-span-7 space-y-5">
            <form
              onSubmit={handleJoinCode}
              className="border border-zinc-800 bg-[#090b10] p-5 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[180px] space-y-1.5">
                <label className="block text-[11px] font-mono-tech text-zinc-400">
                  JOIN BY 5-CHARACTER ROOM CODE
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="E.G. K7M2P"
                  className="w-full bg-[#060709] border border-zinc-700 focus:border-red-500 outline-none px-3 py-2 text-sm font-mono-tech tracking-widest text-zinc-100 uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-zinc-800 hover:bg-red-700 border border-zinc-600 hover:border-red-500 text-xs font-mono-tech font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                JOIN ROOM
              </button>
            </form>

            <div className="border border-zinc-800 bg-[#090b10] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono-tech text-zinc-300 tracking-wider">
                  ACTIVE PUBLIC ROOMS ({rooms.length})
                </div>
                <button
                  onClick={() => multiplayerClient.requestRoomList()}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-[11px] font-mono-tech text-zinc-300 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>REFRESH</span>
                </button>
              </div>

              {rooms.length === 0 ? (
                <div className="border border-dashed border-zinc-800 py-12 text-center space-y-2">
                  <Crosshair className="w-6 h-6 text-zinc-600 mx-auto" />
                  <p className="text-xs font-mono-tech text-zinc-500">
                    NO PUBLIC SQUADS ACTIVE RIGHT NOW
                  </p>
                  <p className="text-xs text-zinc-500">
                    Create a room on the left and share its 5-character code with a teammate.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rooms.map((r) => {
                    const mission = MISSIONS.find((m) => m.id === r.missionId);
                    return (
                      <div
                        key={r.code}
                        className="border border-zinc-800 bg-[#06070a] p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-display font-bold text-sm text-zinc-100">
                              {r.name}
                            </span>
                            <span
                              className={`text-[10px] font-mono-tech px-1.5 py-0.5 border ${
                                r.mode === 'pvp'
                                  ? 'border-red-700 text-red-300 bg-red-950/40'
                                  : 'border-emerald-700 text-emerald-300 bg-emerald-950/40'
                              }`}
                            >
                              {r.mode.toUpperCase()}
                            </span>
                            <span className="text-[11px] font-mono-tech text-zinc-500">
                              #{r.code}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono-tech text-zinc-400">
                            HOST {r.hostCallsign} · {mission?.title ?? r.missionId.toUpperCase()} ·{' '}
                            {r.status === 'playing' ? 'IN PROGRESS' : 'STAGING'}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono-tech text-zinc-300 tabular-nums">
                            {r.playerCount}/{r.maxPlayers}
                          </span>
                          <button
                            onClick={() =>
                              multiplayerClient.joinRoom(
                                r.code,
                                callsign.trim() || CHARACTERS[selectedCharacter].callsign,
                                selectedCharacter
                              )
                            }
                            disabled={r.playerCount >= r.maxPlayers}
                            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-mono-tech font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {r.status === 'playing' ? 'DROP IN' : 'JOIN SQUAD'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Active Room Staging View */
        <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <div className="border border-zinc-800 bg-[#090b10] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2.5 text-xs font-mono-tech">
                    <span
                      className={`px-2 py-0.5 border ${
                        room.mode === 'pvp'
                          ? 'border-red-600 text-red-300 bg-red-950/50'
                          : 'border-emerald-600 text-emerald-300 bg-emerald-950/50'
                      }`}
                    >
                      {room.mode === 'pvp' ? 'PVP ARENA' : 'CO-OP SQUAD'}
                    </span>
                    <span className="text-zinc-400">
                      {MISSIONS.find((m) => m.id === room.missionId)?.title ?? room.missionId}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-zinc-100 mt-1">
                    {room.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-2 border border-amber-600/70 bg-amber-950/30 hover:bg-amber-950/60 text-xs font-mono-tech text-amber-300 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>CODE: {room.code}</span>
                  </button>
                  <button
                    onClick={() => multiplayerClient.leaveRoom()}
                    className="px-3.5 py-2 border border-zinc-700 hover:border-red-600 text-xs font-mono-tech text-zinc-300 hover:text-red-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    LEAVE
                  </button>
                </div>
              </div>

              {isHost && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-zinc-800/80">
                  <div>
                    <label className="block text-[10px] font-mono-tech text-zinc-400 mb-1">
                      GAME MODE (HOST)
                    </label>
                    <select
                      value={room.mode}
                      onChange={(e) =>
                        multiplayerClient.updateConfig({
                          mode: e.target.value === 'pvp' ? 'pvp' : 'coop',
                        })
                      }
                      className="w-full bg-[#060709] border border-zinc-700 px-3 py-1.5 text-xs font-mono-tech text-zinc-100 outline-none"
                    >
                      <option value="coop">CO-OP CAMPAIGN</option>
                      <option value="pvp">PVP ARENA DEATHMATCH</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono-tech text-zinc-400 mb-1">
                      SECTOR / MAP (HOST)
                    </label>
                    <select
                      value={room.missionId}
                      onChange={(e) =>
                        multiplayerClient.updateConfig({ missionId: e.target.value })
                      }
                      className="w-full bg-[#060709] border border-zinc-700 px-3 py-1.5 text-xs font-mono-tech text-zinc-100 outline-none"
                    >
                      {MISSIONS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.isTutorial
                            ? `TUTORIAL · ${m.title}`
                            : m.isBonusArena
                              ? `ARENA · ${m.title}`
                              : `CH.${String(m.number).padStart(2, '0')} · ${m.title}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Operative Roster */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono-tech text-zinc-400">
                  SQUAD ROSTER ({room.players.length}/{room.maxPlayers})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {room.players.map((p) => {
                    const isSelf = p.id === multiplayerClient.clientId;
                    const charDef = CHARACTERS[p.characterId];
                    return (
                      <div
                        key={p.id}
                        className={`border p-3 space-y-1.5 ${
                          isSelf
                            ? 'border-red-600/80 bg-[#12090b]'
                            : 'border-zinc-800 bg-[#06070a]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono-tech">
                          <span className="font-bold text-zinc-100">
                            {p.callsign} {isSelf && '(YOU)'}
                          </span>
                          <span
                            className={
                              p.isHost
                                ? 'text-amber-400'
                                : p.ready
                                  ? 'text-emerald-400'
                                  : 'text-zinc-500'
                            }
                          >
                            {p.isHost ? 'HOST' : p.ready ? 'READY' : 'NOT READY'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono-tech text-zinc-400">
                          {charDef.callsign} · {WEAPONS[p.weaponId]?.name ?? p.weaponId}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Local Operative Class Switcher inside Lobby */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                <div className="text-[11px] font-mono-tech text-zinc-400">SWITCH YOUR OPERATIVE</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {CHARACTER_LIST.map((ch) => {
                    const active = (localPlayer?.characterId ?? selectedCharacter) === ch.id;
                    return (
                      <button
                        type="button"
                        key={ch.id}
                        onClick={() => handleCharacterSelect(ch.id)}
                        className={`py-2 px-1 border text-[11px] font-mono-tech font-semibold cursor-pointer ${
                          active
                            ? 'bg-red-800 border-red-500 text-white'
                            : 'bg-[#060709] border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {ch.callsign}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                {!isHost && localPlayer && (
                  <button
                    onClick={() => multiplayerClient.updatePlayer({ ready: !localPlayer.ready })}
                    className={`px-5 py-2.5 border text-xs font-mono-tech font-semibold cursor-pointer ${
                      localPlayer.ready
                        ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:border-zinc-500'
                    }`}
                  >
                    {localPlayer.ready ? 'READY CHECKED ✓' : 'MARK READY'}
                  </button>
                )}
                {isHost ? (
                  <button
                    onClick={() => multiplayerClient.startMatch()}
                    className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>DEPLOY SQUAD ({room.players.length})</span>
                  </button>
                ) : room.status === 'playing' ? (
                  <button
                    onClick={() => onStartMatch(room, multiplayerClient.clientId)}
                    className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-xs font-mono-tech font-semibold text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>JOIN ACTIVE MATCH</span>
                  </button>
                ) : (
                  <span className="text-xs font-mono-tech text-zinc-400">
                    WAITING FOR HOST TO DEPLOY...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Squad Chat */}
          <div className="lg:col-span-5 border border-zinc-800 bg-[#090b10] p-5 flex flex-col h-[460px]">
            <div className="text-xs font-mono-tech text-red-400 tracking-wider pb-3 border-b border-zinc-800">
              SQUAD RADIO CHAT
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
              {room.chat.map((c) => (
                <div
                  key={c.id}
                  className={c.system ? 'text-amber-300/90 font-mono-tech text-[11px]' : 'text-zinc-200'}
                >
                  {!c.system && (
                    <span className="font-mono-tech font-bold text-red-400 mr-2">
                      {c.senderCallsign}:
                    </span>
                  )}
                  <span>{c.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="pt-3 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                maxLength={180}
                placeholder="Transmit message..."
                className="flex-1 bg-[#060709] border border-zinc-700 focus:border-red-500 outline-none px-3 py-2 text-xs text-zinc-100"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-red-700 hover:bg-red-600 text-white cursor-pointer"
                aria-label="Send Chat"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
