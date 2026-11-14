import {
  CharacterId,
  MultiplayerChatMessage,
  MultiplayerMode,
  MultiplayerPlayerState,
  MultiplayerRoomState,
  MultiplayerRoomSummary,
  WeaponId,
} from './types';

export interface RemoteFireEvent {
  playerId: string;
  origin?: { x: number; y: number; z: number };
  hitPoint?: { x: number; y: number; z: number };
  weaponId?: WeaponId;
}

export interface PvpDamagedEvent {
  targetId: string;
  attackerId: string;
  damage: number;
  health: number;
  armor: number;
  crit?: boolean;
}

export interface PvpKillEvent {
  victimId: string;
  victimCallsign: string;
  attackerId: string;
  attackerCallsign: string;
  players: MultiplayerPlayerState[];
}

export interface PvpRespawnEvent {
  playerId: string;
  spawn: { x: number; y: number; z: number; yaw: number };
  health: number;
  armor: number;
  players: MultiplayerPlayerState[];
}

export interface CoopInteractEvent {
  playerId: string;
  callsign: string;
  interactableId: string;
  doorId?: string | null;
  missionStage?: number | null;
}

export interface CoopPuzzleSolveEvent {
  playerId: string;
  callsign: string;
  puzzleId: string;
  interactableId?: string | null;
  doorId?: string | null;
}

export interface CoopEnemySyncEntry {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  state: string;
  active: boolean;
}

export interface CoopEnemyDamageEvent {
  playerId: string;
  enemyId: string;
  damage: number;
  zone: string;
  hitPoint: { x: number; y: number; z: number };
}

export interface MultiplayerEvents {
  onConnectionChange?: (connected: boolean) => void;
  onRoomList?: (rooms: MultiplayerRoomSummary[]) => void;
  onRoomState?: (room: MultiplayerRoomState | null) => void;
  onRoomStarted?: (room: MultiplayerRoomState) => void;
  onError?: (message: string) => void;
  onChatMessage?: (message: MultiplayerChatMessage) => void;
  onRemotePlayerUpdate?: (player: MultiplayerPlayerState) => void;
  onRemoteFire?: (ev: RemoteFireEvent) => void;
  onPvpDamaged?: (ev: PvpDamagedEvent) => void;
  onPvpKill?: (ev: PvpKillEvent) => void;
  onPvpRespawn?: (ev: PvpRespawnEvent) => void;
  onCoopInteract?: (ev: CoopInteractEvent) => void;
  onCoopPuzzleSolve?: (ev: CoopPuzzleSolveEvent) => void;
  onCoopEnemySync?: (enemies: CoopEnemySyncEntry[]) => void;
  onCoopEnemyDamage?: (ev: CoopEnemyDamageEvent) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private outgoingQueue: string[] = [];
  private listeners = new Set<MultiplayerEvents>();
  private intentionallyClosed = false;

  public connected = false;
  public clientId = '';
  public publicRooms: MultiplayerRoomSummary[] = [];
  public room: MultiplayerRoomState | null = null;

  public connect(): void {
    this.intentionallyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      while (this.outgoingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const next = this.outgoingQueue.shift();
        if (next) ws.send(next);
      }
      this.emit((l) => l.onConnectionChange?.(true));
      this.requestRoomList();
    };

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type ?? '');
      switch (type) {
        case 'connected': {
          this.clientId = String(msg.clientId ?? '');
          if (Array.isArray(msg.rooms)) {
            this.publicRooms = msg.rooms as MultiplayerRoomSummary[];
            this.emit((l) => l.onRoomList?.(this.publicRooms));
          }
          break;
        }
        case 'room:list_update': {
          if (Array.isArray(msg.rooms)) {
            this.publicRooms = msg.rooms as MultiplayerRoomSummary[];
            this.emit((l) => l.onRoomList?.(this.publicRooms));
          }
          break;
        }
        case 'room:joined':
        case 'room:state': {
          this.room = (msg.room as MultiplayerRoomState) ?? null;
          if (msg.playerId) this.clientId = String(msg.playerId);
          this.emit((l) => l.onRoomState?.(this.room));
          break;
        }
        case 'room:started': {
          this.room = (msg.room as MultiplayerRoomState) ?? null;
          this.emit((l) => l.onRoomState?.(this.room));
          if (this.room) {
            const started = this.room;
            this.emit((l) => l.onRoomStarted?.(started));
          }
          break;
        }
        case 'room:left': {
          this.room = null;
          if (Array.isArray(msg.rooms)) {
            this.publicRooms = msg.rooms as MultiplayerRoomSummary[];
            this.emit((l) => l.onRoomList?.(this.publicRooms));
          }
          this.emit((l) => l.onRoomState?.(null));
          break;
        }
        case 'room:error': {
          this.emit((l) => l.onError?.(String(msg.message ?? 'Multiplayer error')));
          break;
        }
        case 'chat:message': {
          const chatMsg = msg.message as MultiplayerChatMessage;
          if (this.room && chatMsg) {
            this.room.chat = [...this.room.chat, chatMsg].slice(-60);
            this.emit((l) => l.onChatMessage?.(chatMsg));
            this.emit((l) => l.onRoomState?.(this.room));
          }
          break;
        }
        case 'player:remote_update': {
          const rp = msg.player as MultiplayerPlayerState | undefined;
          if (this.room && rp) {
            const idx = this.room.players.findIndex((p) => p.id === rp.id);
            if (idx >= 0) {
              this.room.players[idx] = { ...this.room.players[idx], ...rp };
            }
            this.emit((l) => l.onRemotePlayerUpdate?.(rp));
          }
          break;
        }
        case 'weapon:remote_fire': {
          this.emit((l) => l.onRemoteFire?.(msg as unknown as RemoteFireEvent));
          break;
        }
        case 'pvp:damaged': {
          const ev = msg as unknown as PvpDamagedEvent;
          if (this.room) {
            const t = this.room.players.find((p) => p.id === ev.targetId);
            if (t) {
              t.health = ev.health;
              t.armor = ev.armor;
            }
          }
          this.emit((l) => l.onPvpDamaged?.(ev));
          break;
        }
        case 'pvp:kill': {
          const ev = msg as unknown as PvpKillEvent;
          if (this.room && Array.isArray(ev.players)) {
            this.room.players = ev.players;
          }
          this.emit((l) => l.onPvpKill?.(ev));
          break;
        }
        case 'pvp:respawn': {
          const ev = msg as unknown as PvpRespawnEvent;
          if (this.room && Array.isArray(ev.players)) {
            this.room.players = ev.players;
          }
          this.emit((l) => l.onPvpRespawn?.(ev));
          break;
        }
        case 'coop:remote_interact': {
          this.emit((l) => l.onCoopInteract?.(msg as unknown as CoopInteractEvent));
          break;
        }
        case 'coop:remote_puzzle_solve': {
          this.emit((l) => l.onCoopPuzzleSolve?.(msg as unknown as CoopPuzzleSolveEvent));
          break;
        }
        case 'coop:remote_enemy_sync': {
          if (Array.isArray(msg.enemies)) {
            this.emit((l) => l.onCoopEnemySync?.(msg.enemies as CoopEnemySyncEntry[]));
          }
          break;
        }
        case 'coop:remote_enemy_damage': {
          this.emit((l) => l.onCoopEnemyDamage?.(msg as unknown as CoopEnemyDamageEvent));
          break;
        }
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.emit((l) => l.onConnectionChange?.(false));
      if (!this.intentionallyClosed && this.reconnectTimer === null) {
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 1800);
      }
    };
  }

  public disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.room = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public subscribe(listener: MultiplayerEvents): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(fn: (listener: MultiplayerEvents) => void): void {
    for (const listener of this.listeners) {
      fn(listener);
    }
  }

  private send(payload: unknown): void {
    const encoded = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encoded);
    } else {
      this.outgoingQueue.push(encoded);
      this.connect();
    }
  }

  public requestRoomList(): void {
    this.send({ type: 'room:list' });
  }

  public createRoom(opts: {
    name: string;
    callsign: string;
    characterId: CharacterId;
    mode: MultiplayerMode;
    missionId: string;
    isPublic: boolean;
  }): void {
    this.send({ type: 'room:create', ...opts });
  }

  public joinRoom(code: string, callsign: string, characterId: CharacterId): void {
    this.send({ type: 'room:join', code: code.trim().toUpperCase(), callsign, characterId });
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
    this.room = null;
    this.emit((l) => l.onRoomState?.(null));
  }

  public updatePlayer(opts: { callsign?: string; characterId?: CharacterId; ready?: boolean }): void {
    this.send({ type: 'room:update_player', ...opts });
  }

  public updateConfig(opts: { mode?: MultiplayerMode; missionId?: string; isPublic?: boolean }): void {
    this.send({ type: 'room:update_config', ...opts });
  }

  public startMatch(): void {
    this.send({ type: 'room:start' });
  }

  public returnToLobby(): void {
    this.send({ type: 'room:return_lobby' });
  }

  public sendChat(text: string): void {
    if (!text.trim()) return;
    this.send({ type: 'chat:send', text: text.trim() });
  }

  public sendPlayerTransform(data: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    armor: number;
    weaponId: WeaponId;
    crouching: boolean;
    flashlightOn: boolean;
    abilityActive: boolean;
  }): void {
    this.send({ type: 'player:update', ...data });
  }

  public sendWeaponFire(data: {
    weaponId: WeaponId;
    origin: { x: number; y: number; z: number };
    hitPoint: { x: number; y: number; z: number };
  }): void {
    this.send({ type: 'weapon:fire', ...data });
  }

  public sendPvpHit(targetId: string, damage: number, crit: boolean): void {
    this.send({ type: 'pvp:hit', targetId, damage, crit });
  }

  public sendCoopInteract(interactableId: string, doorId?: string | null, missionStage?: number | null): void {
    this.send({ type: 'coop:interact', interactableId, doorId, missionStage });
  }

  public sendCoopPuzzleSolve(
    puzzleId: string,
    interactableId?: string | null,
    doorId?: string | null
  ): void {
    this.send({ type: 'coop:puzzle_solve', puzzleId, interactableId, doorId });
  }

  public sendCoopEnemySync(enemies: CoopEnemySyncEntry[]): void {
    this.send({ type: 'coop:enemy_sync', enemies });
  }

  public sendCoopEnemyDamage(
    enemyId: string,
    damage: number,
    zone: string,
    hitPoint: { x: number; y: number; z: number }
  ): void {
    this.send({ type: 'coop:enemy_damage', enemyId, damage, zone, hitPoint });
  }
}

export const multiplayerClient = new MultiplayerClient();
