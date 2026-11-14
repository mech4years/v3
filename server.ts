import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  CharacterId,
  MultiplayerChatMessage,
  MultiplayerMode,
  MultiplayerPlayerState,
  MultiplayerRoomState,
  MultiplayerRoomSummary,
  WeaponId,
} from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const CHARACTER_MAX_STATS: Record<CharacterId, { health: number; armor: number; weapon: WeaponId }> = {
  raven: { health: 100, armor: 75, weapon: 'assault_rifle' },
  ghost: { health: 85, armor: 45, weapon: 'sniper_rifle' },
  brute: { health: 150, armor: 100, weapon: 'heavy_mg' },
  nyx: { health: 100, armor: 65, weapon: 'tactical_rifle' },
  zero: { health: 110, armor: 75, weapon: 'energy_rifle' },
};

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
}

interface ServerRoom {
  state: MultiplayerRoomState;
  clients: Map<string, ConnectedClient>;
  respawnTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const rooms = new Map<string, ServerRoom>();
const clients = new Map<string, ConnectedClient>();

function makeId(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `R${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function sanitizeCallsign(raw: unknown): string {
  const s = String(raw ?? 'OPERATIVE')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .slice(0, 16)
    .toUpperCase();
  return s.length > 0 ? s : 'OPERATIVE';
}

function sanitizeChatText(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .slice(0, 180);
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: ServerRoom, payload: unknown, exceptId?: string): void {
  const encoded = JSON.stringify(payload);
  for (const client of room.clients.values()) {
    if (exceptId && client.id === exceptId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(encoded);
    }
  }
}

function getPublicRoomList(): MultiplayerRoomSummary[] {
  const list: MultiplayerRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.state.isPublic) continue;
    const host = room.state.players.find((p) => p.id === room.state.hostId);
    list.push({
      code: room.state.code,
      name: room.state.name,
      mode: room.state.mode,
      missionId: room.state.missionId,
      status: room.state.status,
      playerCount: room.state.players.length,
      maxPlayers: room.state.maxPlayers,
      isPublic: room.state.isPublic,
      hostCallsign: host?.callsign ?? 'HOST',
    });
  }
  return list;
}

function broadcastRoomList(): void {
  const payload = JSON.stringify({ type: 'room:list_update', rooms: getPublicRoomList() });
  for (const c of clients.values()) {
    if (!c.roomCode && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  }
}

function pushSystemChat(room: ServerRoom, text: string): void {
  const msg: MultiplayerChatMessage = {
    id: makeId(10),
    senderId: 'system',
    senderCallsign: 'TACTICAL NET',
    text,
    timestamp: Date.now(),
    system: true,
  };
  room.state.chat.push(msg);
  if (room.state.chat.length > 60) {
    room.state.chat.splice(0, room.state.chat.length - 60);
  }
  broadcastRoom(room, { type: 'chat:message', message: msg });
}

function removeClientFromRoom(client: ConnectedClient): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  const leaving = room.state.players.find((p) => p.id === client.id);
  const timer = room.respawnTimers.get(client.id);
  if (timer) {
    clearTimeout(timer);
    room.respawnTimers.delete(client.id);
  }

  room.clients.delete(client.id);
  room.state.players = room.state.players.filter((p) => p.id !== client.id);

  if (room.state.players.length === 0) {
    for (const t of room.respawnTimers.values()) clearTimeout(t);
    room.respawnTimers.clear();
    rooms.delete(room.state.code);
    broadcastRoomList();
    return;
  }

  if (room.state.hostId === client.id) {
    room.state.hostId = room.state.players[0].id;
    room.state.players[0].isHost = true;
    room.state.players[0].ready = true;
  }

  if (leaving) {
    pushSystemChat(room, `${leaving.callsign} disconnected from squad.`);
  }
  broadcastRoom(room, { type: 'room:state', room: room.state });
  broadcastRoomList();
}

function createInitialPlayerState(
  id: string,
  callsign: string,
  characterId: CharacterId,
  isHost: boolean
): MultiplayerPlayerState {
  const stats = CHARACTER_MAX_STATS[characterId] ?? CHARACTER_MAX_STATS.raven;
  return {
    id,
    callsign,
    characterId,
    ready: isHost,
    isHost,
    x: 0,
    y: 0.05,
    z: 18,
    yaw: 0,
    pitch: 0,
    health: stats.health,
    maxHealth: stats.health,
    armor: stats.armor,
    weaponId: stats.weapon,
    crouching: false,
    flashlightOn: true,
    abilityActive: false,
    alive: true,
    kills: 0,
    deaths: 0,
  };
}

function getPvpSpawnCoords(index: number): { x: number; y: number; z: number; yaw: number } {
  const spots = [
    { x: -10, y: 0.05, z: 22, yaw: 0.45 },
    { x: 10, y: 0.05, z: -22, yaw: -2.65 },
    { x: 10, y: 0.05, z: 22, yaw: -0.45 },
    { x: -10, y: 0.05, z: -22, yaw: 2.65 },
  ];
  return spots[index % spots.length];
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, clients: clients.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getPublicRoomList() });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = makeId(10);
    const client: ConnectedClient = { id: clientId, ws, roomCode: null };
    clients.set(clientId, client);

    sendJson(ws, {
      type: 'connected',
      clientId,
      rooms: getPublicRoomList(),
    });

    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(rawData)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type ?? '');

      if (type === 'room:list') {
        sendJson(ws, { type: 'room:list_update', rooms: getPublicRoomList() });
        return;
      }

      if (type === 'room:create') {
        removeClientFromRoom(client);
        const code = makeRoomCode();
        const mode: MultiplayerMode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        const missionId = String(msg.missionId || (mode === 'pvp' ? 'mission_crucible' : 'mission_01'));
        const characterId = (['raven', 'ghost', 'brute', 'nyx', 'zero'].includes(String(msg.characterId))
          ? String(msg.characterId)
          : 'raven') as CharacterId;
        const callsign = sanitizeCallsign(msg.callsign);
        const roomName = String(msg.name || `${callsign} SQUAD`).trim().slice(0, 28) || `${callsign} SQUAD`;
        const isPublic = msg.isPublic !== false;

        const hostPlayer = createInitialPlayerState(clientId, callsign, characterId, true);
        const roomState: MultiplayerRoomState = {
          code,
          name: roomName,
          mode,
          missionId,
          status: 'lobby',
          isPublic,
          hostId: clientId,
          maxPlayers: 4,
          players: [hostPlayer],
          solvedPuzzles: [],
          activatedInteractables: [],
          chat: [
            {
              id: makeId(10),
              senderId: 'system',
              senderCallsign: 'TACTICAL NET',
              text: `Sector room ${code} created (${mode.toUpperCase()}). Share code to deploy together.`,
              timestamp: Date.now(),
              system: true,
            },
          ],
        };

        const room: ServerRoom = {
          state: roomState,
          clients: new Map([[clientId, client]]),
          respawnTimers: new Map(),
        };
        rooms.set(code, room);
        client.roomCode = code;
        sendJson(ws, { type: 'room:joined', room: roomState, playerId: clientId });
        broadcastRoomList();
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code ?? '').trim().toUpperCase();
        const targetRoom = rooms.get(code);
        if (!targetRoom) {
          sendJson(ws, { type: 'room:error', message: `Room "${code}" not found.` });
          return;
        }
        if (targetRoom.state.players.length >= targetRoom.state.maxPlayers) {
          sendJson(ws, { type: 'room:error', message: `Room ${code} is full (4/4 operatives).` });
          return;
        }

        removeClientFromRoom(client);
        const callsign = sanitizeCallsign(msg.callsign);
        const characterId = (['raven', 'ghost', 'brute', 'nyx', 'zero'].includes(String(msg.characterId))
          ? String(msg.characterId)
          : 'raven') as CharacterId;
        const newPlayer = createInitialPlayerState(clientId, callsign, characterId, false);
        targetRoom.state.players.push(newPlayer);
        targetRoom.clients.set(clientId, client);
        client.roomCode = code;

        pushSystemChat(targetRoom, `${callsign} joined the squad.`);
        sendJson(ws, { type: 'room:joined', room: targetRoom.state, playerId: clientId });
        broadcastRoom(targetRoom, { type: 'room:state', room: targetRoom.state });
        broadcastRoomList();
        return;
      }

      if (type === 'room:leave') {
        removeClientFromRoom(client);
        sendJson(ws, { type: 'room:left', rooms: getPublicRoomList() });
        return;
      }

      if (!client.roomCode) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;
      const player = room.state.players.find((p) => p.id === clientId);
      if (!player) return;

      if (type === 'room:update_player') {
        if (typeof msg.callsign === 'string') {
          player.callsign = sanitizeCallsign(msg.callsign);
        }
        if (
          typeof msg.characterId === 'string' &&
          ['raven', 'ghost', 'brute', 'nyx', 'zero'].includes(msg.characterId)
        ) {
          const cid = msg.characterId as CharacterId;
          player.characterId = cid;
          const stats = CHARACTER_MAX_STATS[cid];
          player.maxHealth = stats.health;
          player.health = stats.health;
          player.armor = stats.armor;
          player.weaponId = stats.weapon;
        }
        if (typeof msg.ready === 'boolean') {
          player.ready = player.isHost ? true : msg.ready;
        }
        broadcastRoom(room, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:update_config' && room.state.hostId === clientId) {
        if (msg.mode === 'coop' || msg.mode === 'pvp') {
          room.state.mode = msg.mode;
        }
        if (typeof msg.missionId === 'string' && msg.missionId.trim().length > 0) {
          room.state.missionId = msg.missionId.trim();
        }
        if (typeof msg.isPublic === 'boolean') {
          room.state.isPublic = msg.isPublic;
        }
        broadcastRoom(room, { type: 'room:state', room: room.state });
        broadcastRoomList();
        return;
      }

      if (type === 'room:start' && room.state.hostId === clientId) {
        room.state.status = 'playing';
        room.state.solvedPuzzles = [];
        room.state.activatedInteractables = [];
        room.state.players.forEach((p, idx) => {
          const stats = CHARACTER_MAX_STATS[p.characterId];
          p.health = stats.health;
          p.maxHealth = stats.health;
          p.armor = stats.armor;
          p.alive = true;
          p.kills = 0;
          p.deaths = 0;
          if (room.state.mode === 'pvp') {
            const sp = getPvpSpawnCoords(idx);
            p.x = sp.x;
            p.y = sp.y;
            p.z = sp.z;
            p.yaw = sp.yaw;
          }
        });
        pushSystemChat(
          room,
          `Deployment authorized (${room.state.mode.toUpperCase()}) in ${room.state.missionId.toUpperCase()}.`
        );
        broadcastRoom(room, { type: 'room:started', room: room.state });
        broadcastRoomList();
        return;
      }

      if (type === 'room:return_lobby' && room.state.hostId === clientId) {
        room.state.status = 'lobby';
        broadcastRoom(room, { type: 'room:state', room: room.state });
        broadcastRoomList();
        return;
      }

      if (type === 'chat:send') {
        const text = sanitizeChatText(msg.text);
        if (!text) return;
        const chatMsg: MultiplayerChatMessage = {
          id: makeId(10),
          senderId: clientId,
          senderCallsign: player.callsign,
          text,
          timestamp: Date.now(),
        };
        room.state.chat.push(chatMsg);
        if (room.state.chat.length > 60) {
          room.state.chat.splice(0, room.state.chat.length - 60);
        }
        broadcastRoom(room, { type: 'chat:message', message: chatMsg });
        return;
      }

      if (type === 'player:update') {
        if (typeof msg.x === 'number') player.x = msg.x;
        if (typeof msg.y === 'number') player.y = msg.y;
        if (typeof msg.z === 'number') player.z = msg.z;
        if (typeof msg.yaw === 'number') player.yaw = msg.yaw;
        if (typeof msg.pitch === 'number') player.pitch = msg.pitch;
        if (typeof msg.health === 'number' && room.state.mode === 'coop') {
          player.health = Math.max(0, msg.health);
          player.alive = player.health > 0;
        }
        if (typeof msg.armor === 'number' && room.state.mode === 'coop') {
          player.armor = Math.max(0, msg.armor);
        }
        if (typeof msg.weaponId === 'string') player.weaponId = msg.weaponId as WeaponId;
        if (typeof msg.crouching === 'boolean') player.crouching = msg.crouching;
        if (typeof msg.flashlightOn === 'boolean') player.flashlightOn = msg.flashlightOn;
        if (typeof msg.abilityActive === 'boolean') player.abilityActive = msg.abilityActive;

        broadcastRoom(
          room,
          {
            type: 'player:remote_update',
            player: {
              id: player.id,
              callsign: player.callsign,
              characterId: player.characterId,
              x: player.x,
              y: player.y,
              z: player.z,
              yaw: player.yaw,
              pitch: player.pitch,
              health: player.health,
              maxHealth: player.maxHealth,
              armor: player.armor,
              weaponId: player.weaponId,
              crouching: player.crouching,
              flashlightOn: player.flashlightOn,
              abilityActive: player.abilityActive,
              alive: player.alive,
              kills: player.kills,
              deaths: player.deaths,
            },
          },
          clientId
        );
        return;
      }

      if (type === 'weapon:fire') {
        broadcastRoom(
          room,
          {
            type: 'weapon:remote_fire',
            playerId: clientId,
            origin: msg.origin,
            hitPoint: msg.hitPoint,
            weaponId: msg.weaponId,
          },
          clientId
        );
        return;
      }

      if (type === 'pvp:hit' && room.state.mode === 'pvp') {
        const targetId = String(msg.targetId ?? '');
        const rawDamage = Number(msg.damage ?? 0);
        if (!player.alive || targetId === clientId || !Number.isFinite(rawDamage) || rawDamage <= 0) {
          return;
        }
        const target = room.state.players.find((p) => p.id === targetId);
        if (!target || !target.alive) return;

        let dmg = Math.min(180, rawDamage);
        if (target.armor > 0) {
          const absorbed = Math.min(target.armor, dmg * 0.45);
          target.armor = Math.max(0, target.armor - absorbed);
          dmg -= absorbed;
        }
        target.health = Math.max(0, target.health - dmg);

        broadcastRoom(room, {
          type: 'pvp:damaged',
          targetId: target.id,
          attackerId: clientId,
          damage: Math.round(dmg),
          health: Math.round(target.health),
          armor: Math.round(target.armor),
          crit: Boolean(msg.crit),
        });

        if (target.health <= 0) {
          target.alive = false;
          target.deaths += 1;
          player.kills += 1;
          pushSystemChat(room, `${player.callsign} eliminated ${target.callsign}!`);
          broadcastRoom(room, {
            type: 'pvp:kill',
            victimId: target.id,
            victimCallsign: target.callsign,
            attackerId: player.id,
            attackerCallsign: player.callsign,
            players: room.state.players,
          });

          const existing = room.respawnTimers.get(target.id);
          if (existing) clearTimeout(existing);
          const idx = Math.floor(Math.random() * 4);
          const respawnTimer = setTimeout(() => {
            room.respawnTimers.delete(target.id);
            const t = room.state.players.find((p) => p.id === target.id);
            if (!t) return;
            const stats = CHARACTER_MAX_STATS[t.characterId];
            const sp = getPvpSpawnCoords(idx);
            t.health = stats.health;
            t.maxHealth = stats.health;
            t.armor = stats.armor;
            t.alive = true;
            t.x = sp.x;
            t.y = sp.y;
            t.z = sp.z;
            t.yaw = sp.yaw;
            broadcastRoom(room, {
              type: 'pvp:respawn',
              playerId: t.id,
              spawn: sp,
              health: t.health,
              armor: t.armor,
              players: room.state.players,
            });
          }, 3000);
          room.respawnTimers.set(target.id, respawnTimer);
        }
        return;
      }

      if (type === 'coop:interact' && room.state.mode === 'coop') {
        const interactableId = String(msg.interactableId ?? '');
        if (!interactableId) return;
        if (!room.state.activatedInteractables.includes(interactableId)) {
          room.state.activatedInteractables.push(interactableId);
        }
        broadcastRoom(
          room,
          {
            type: 'coop:remote_interact',
            playerId: clientId,
            callsign: player.callsign,
            interactableId,
            doorId: msg.doorId ?? null,
            missionStage: typeof msg.missionStage === 'number' ? msg.missionStage : null,
          },
          clientId
        );
        return;
      }

      if (type === 'coop:puzzle_solve' && room.state.mode === 'coop') {
        const puzzleId = String(msg.puzzleId ?? '');
        if (!puzzleId) return;
        if (!room.state.solvedPuzzles.includes(puzzleId)) {
          room.state.solvedPuzzles.push(puzzleId);
        }
        pushSystemChat(room, `${player.callsign} calibrated generator ${puzzleId.toUpperCase()}.`);
        broadcastRoom(
          room,
          {
            type: 'coop:remote_puzzle_solve',
            playerId: clientId,
            callsign: player.callsign,
            puzzleId,
            interactableId: msg.interactableId ?? null,
            doorId: msg.doorId ?? null,
          },
          clientId
        );
        return;
      }

      if (type === 'coop:enemy_sync' && room.state.mode === 'coop' && room.state.hostId === clientId) {
        broadcastRoom(
          room,
          {
            type: 'coop:remote_enemy_sync',
            enemies: msg.enemies,
          },
          clientId
        );
        return;
      }

      if (type === 'coop:enemy_damage' && room.state.mode === 'coop') {
        broadcastRoom(
          room,
          {
            type: 'coop:remote_enemy_damage',
            playerId: clientId,
            enemyId: msg.enemyId,
            damage: msg.damage,
            zone: msg.zone,
            hitPoint: msg.hitPoint,
          },
          clientId
        );
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      removeClientFromRoom(client);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
