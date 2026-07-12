// Socket.IO game server: wires the wire-protocol events to the room manager and
// the pure game engine, manages per-turn timers, reconnection, and persistence
// of finished games. All game mutations are authoritative on the server.

import type { Server, Socket } from "socket.io";
import { z } from "zod";
import * as engine from "../game/engine.js";
import { getPackWords } from "../game/words.js";
import {
  RoomManager,
  buildRoomView,
  sanitizeName,
  type Room,
  type Player,
} from "../rooms/roomManager.js";
import { recordFinishedGame } from "../db/history.js";
import { verifyToken } from "../auth/auth.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomView,
  PlayerRole,
  Team,
} from "../../shared/protocol.js";
import { MAX_CHAT_LENGTH } from "../../shared/protocol.js";

interface SocketData {
  playerId?: string;
  roomCode?: string;
  userId?: string | null;
  displayName?: string | null;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Grace period before an empty room is discarded, so a full-team refresh survives.
const ROOM_GRACE_MS = 5 * 60 * 1000;

const nameSchema = z.string().min(1).max(40);
const teamSchema = z.union([z.literal("red"), z.literal("blue"), z.null()]);
const roleSchema = z.union([z.literal("spymaster"), z.literal("operative")]);

export class GameServer {
  private manager = new RoomManager();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  constructor(private io: IO) {
    this.io.on("connection", (socket) => this.onConnection(socket));
  }

  private onConnection(socket: IOSocket): void {
    // Optional account identity from the handshake JWT.
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;
    socket.data.userId = payload?.userId ?? null;
    socket.data.displayName = payload?.displayName ?? null;

    socket.on("room:create", (payload, cb) => this.handleCreate(socket, payload, cb));
    socket.on("room:join", (payload, cb) => this.handleJoin(socket, payload, cb));
    socket.on("room:rejoin", (payload, cb) => this.handleRejoin(socket, payload, cb));
    socket.on("room:leave", (cb) => this.handleLeave(socket, cb));

    socket.on("player:setTeam", (payload, cb) => this.handleSetTeam(socket, payload, cb));
    socket.on("player:setRole", (payload, cb) => this.handleSetRole(socket, payload, cb));
    socket.on("player:rename", (payload, cb) => this.handleRename(socket, payload, cb));
    socket.on("settings:update", (payload, cb) => this.handleSettings(socket, payload, cb));
    socket.on("room:setVariant", (payload, cb) => this.handleSetVariant(socket, payload, cb));
    socket.on("room:setWordPack", (payload, cb) => this.handleSetWordPack(socket, payload, cb));

    socket.on("teams:reset", (cb) => this.handleTeamsReset(socket, cb));
    socket.on("teams:randomize", (cb) => this.handleTeamsRandomize(socket, cb));
    socket.on("teams:lock", (payload, cb) => this.handleTeamsLock(socket, payload, cb));

    socket.on("game:start", (cb) => this.handleStart(socket, cb));
    socket.on("game:clue", (payload, cb) => this.handleClue(socket, payload, cb));
    socket.on("game:guess", (payload, cb) => this.handleGuess(socket, payload, cb));
    socket.on("game:endTurn", (cb) => this.handleEndTurn(socket, cb));
    socket.on("game:newGame", (cb) => this.handleNewGame(socket, cb));

    socket.on("chat:send", (payload, cb) => this.handleChat(socket, payload, cb));

    socket.on("disconnect", () => this.onDisconnect(socket));
  }

  // --- helpers -----------------------------------------------------------

  private ackOk(cb?: (a: { ok: boolean; error?: string }) => void, error?: string): void {
    if (cb) cb(error ? { ok: false, error } : { ok: true });
  }

  private currentRoomAndPlayer(socket: IOSocket): { room: Room; player: Player } | null {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) return null;
    const room = this.manager.get(roomCode);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;
    return { room, player };
  }

  /** Send each connected player their tailored view of the room. */
  private broadcast(room: Room): void {
    for (const player of room.players.values()) {
      if (player.connected && player.socketId) {
        const view: RoomView = buildRoomView(room, player.id);
        this.io.to(player.socketId).emit("room:update", view);
      }
    }
  }

  private attach(socket: IOSocket, room: Room, player: Player): void {
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    player.socketId = socket.id;
    player.connected = true;
    player.lastSeen = Date.now();
    socket.join(room.code);
    const t = this.cleanupTimers.get(room.code);
    if (t) {
      clearTimeout(t);
      this.cleanupTimers.delete(room.code);
    }
  }

  private system(room: Room, text: string): void {
    this.manager.addChat(room, {
      authorId: "system",
      authorName: "System",
      team: null,
      text,
      system: true,
    });
  }

  // --- turn timer --------------------------------------------------------

  private resetTurnTimer(room: Room): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    room.turnDeadline = null;

    const secs = room.settings.turnSeconds;
    if (!room.game || room.game.phase !== "playing" || !secs || secs <= 0) return;

    room.turnDeadline = Date.now() + secs * 1000;
    const teamAtStart = room.game.currentTeam;
    room.turnTimer = setTimeout(() => {
      if (!room.game || room.game.phase !== "playing") return;
      if (room.game.currentTeam !== teamAtStart) return; // turn already changed
      const res = engine.forceEndTurn(room.game);
      room.game = res.state;
      this.system(room, `⏱ Time expired — ${teamAtStart.toUpperCase()} team's turn ended.`);
      this.resetTurnTimer(room);
      this.broadcast(room);
    }, secs * 1000);
  }

  /** Run a game mutation, reset the timer when the turn owner changed, persist on finish. */
  private applyGame(room: Room, mutate: () => string | undefined): string | undefined {
    const before = room.game?.currentTeam;
    const beforePhase = room.game?.phase;
    const error = mutate();
    if (error) return error;

    const after = room.game?.currentTeam;
    if (after !== before || beforePhase !== room.game?.phase) {
      this.resetTurnTimer(room);
    }
    if (room.game?.phase === "finished" && !room.recorded) {
      room.recorded = true;
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
        room.turnDeadline = null;
      }
      void recordFinishedGame(room);
    }
    return undefined;
  }

  // --- room lifecycle ----------------------------------------------------

  private handleCreate(
    socket: IOSocket,
    payload: { name: string; variant?: string; wordPack?: string; settings?: { turnSeconds?: number | null } },
    cb: (a: any) => void,
  ): void {
    const parsed = nameSchema.safeParse(payload?.name);
    const name = parsed.success ? payload.name : socket.data.displayName || "Anonymous";
    const settings = this.normalizeSettings(payload?.settings);
    const variant = this.normalizeVariant(payload?.variant);
    const { room, player } = this.manager.createRoom({
      name,
      userId: socket.data.userId ?? null,
      variant,
      wordPack: payload?.wordPack,
      settings,
    });
    this.autoPlace(room, player);
    this.attach(socket, room, player);
    this.system(room, `${player.name} created the room — ${this.variantLabel(variant)}.`);
    cb({ ok: true, code: room.code, identity: { playerId: player.id, token: player.token } });
    this.broadcast(room);
  }

  private handleJoin(
    socket: IOSocket,
    payload: { code: string; name: string },
    cb: (a: any) => void,
  ): void {
    const room = this.manager.get(payload?.code || "");
    if (!room) return cb({ ok: false, error: "Room not found." });
    if (room.players.size >= 30) return cb({ ok: false, error: "Room is full." });

    const name = nameSchema.safeParse(payload?.name).success
      ? payload.name
      : socket.data.displayName || "Anonymous";
    const player = this.manager.addPlayer(room, name, socket.data.userId ?? null);
    // Auto-place into an available slot (only while in the lobby); the player can
    // switch team/role afterwards.
    if (!room.game || room.game.phase !== "playing") this.autoPlace(room, player);
    this.attach(socket, room, player);
    this.system(room, `${player.name} joined.`);
    cb({ ok: true, code: room.code, identity: { playerId: player.id, token: player.token } });
    this.broadcast(room);
  }

  private handleRejoin(
    socket: IOSocket,
    payload: { code: string; playerId: string; token: string },
    cb: (a: any) => void,
  ): void {
    const room = this.manager.get(payload?.code || "");
    if (!room) return cb({ ok: false, error: "Room no longer exists." });
    const player = room.players.get(payload?.playerId);
    if (!player || player.token !== payload?.token) {
      return cb({ ok: false, error: "Could not restore your seat." });
    }
    this.attach(socket, room, player);
    cb({ ok: true, code: room.code, identity: { playerId: player.id, token: player.token } });
    this.broadcast(room);
  }

  private handleLeave(socket: IOSocket, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (ctx) {
      const { room, player } = ctx;
      socket.leave(room.code);
      this.system(room, `${player.name} left.`);
      this.manager.removePlayer(room, player.id);
      socket.data.roomCode = undefined;
      socket.data.playerId = undefined;
      if (this.manager.connectedCount(room) === 0) {
        this.scheduleCleanup(room);
      } else {
        this.broadcast(room);
      }
    }
    this.ackOk(cb);
  }

  private onDisconnect(socket: IOSocket): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return;
    const { room, player } = ctx;
    player.connected = false;
    player.socketId = null;
    player.lastSeen = Date.now();
    if (this.manager.connectedCount(room) === 0) {
      this.scheduleCleanup(room);
    } else {
      this.broadcast(room);
    }
  }

  private scheduleCleanup(room: Room): void {
    if (this.cleanupTimers.has(room.code)) return;
    const timer = setTimeout(() => {
      // Only delete if still empty.
      if (this.manager.connectedCount(room) === 0) {
        this.manager.deleteRoom(room.code);
      }
      this.cleanupTimers.delete(room.code);
    }, ROOM_GRACE_MS);
    this.cleanupTimers.set(room.code, timer);
  }

  // --- lobby actions -----------------------------------------------------

  private handleSetTeam(socket: IOSocket, payload: { team: Team | null }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (room.game?.phase === "playing") return this.ackOk(cb, "You cannot switch teams mid-game.");
    if (room.teamsLocked && player.id !== room.hostId) {
      return this.ackOk(cb, "Teams are locked by the host.");
    }
    if (!teamSchema.safeParse(payload?.team).success) return this.ackOk(cb, "Invalid team.");
    player.team = payload.team;
    if (player.team === null) player.role = "operative"; // spectators are not spymasters
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleSetRole(socket: IOSocket, payload: { role: PlayerRole }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (room.game?.phase === "playing") return this.ackOk(cb, "You cannot change role mid-game.");
    if (room.teamsLocked && player.id !== room.hostId) {
      return this.ackOk(cb, "Teams are locked by the host.");
    }
    if (!roleSchema.safeParse(payload?.role).success) return this.ackOk(cb, "Invalid role.");
    if (payload.role === "spymaster" && player.team === null) {
      return this.ackOk(cb, "Pick a team before becoming spymaster.");
    }
    player.role = payload.role;
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleRename(socket: IOSocket, payload: { name: string }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (!nameSchema.safeParse(payload?.name).success) return this.ackOk(cb, "Invalid name.");
    player.name = sanitizeName(payload.name);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private normalizeVariant(v?: string): "classic" | "pictures" | "coop" {
    return v === "pictures" ? "pictures" : v === "coop" ? "coop" : "classic";
  }

  private variantLabel(v: string): string {
    if (v === "pictures") return "Codenames: Pictures";
    if (v === "coop") return "Codenames (co-op)";
    return "Codenames (classic)";
  }

  /**
   * Place a newly-joined player into an available slot automatically. Co-op uses
   * a single human team (blue). Competitive variants balance the two teams. Each
   * team's first member becomes its spymaster. Players may switch afterwards.
   */
  private autoPlace(room: Room, player: Player): void {
    const others = [...room.players.values()].filter((p) => p.id !== player.id);
    const count = (team: Team, role?: PlayerRole) =>
      others.filter((p) => p.team === team && (role ? p.role === role : true)).length;

    if (room.variant === "coop") {
      player.team = "blue";
      player.role = count("blue", "spymaster") === 0 ? "spymaster" : "operative";
      return;
    }
    // Competitive: join the smaller team; become its spymaster if it has none.
    const team: Team = count("blue") <= count("red") ? "blue" : "red";
    player.team = team;
    player.role = count(team, "spymaster") === 0 ? "spymaster" : "operative";
  }

  private normalizeSettings(s?: { turnSeconds?: number | null }): { turnSeconds: number | null } {
    let turnSeconds: number | null = null;
    if (s && typeof s.turnSeconds === "number" && s.turnSeconds > 0) {
      turnSeconds = Math.min(600, Math.max(15, Math.floor(s.turnSeconds)));
    }
    return { turnSeconds };
  }

  private handleSettings(socket: IOSocket, payload: { turnSeconds?: number | null }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (player.id !== room.hostId) return this.ackOk(cb, "Only the host can change settings.");
    room.settings = this.normalizeSettings(payload);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleSetVariant(socket: IOSocket, payload: { variant: string }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (player.id !== room.hostId) return this.ackOk(cb, "Only the host can change the game.");
    if (room.game?.phase === "playing") return this.ackOk(cb, "You cannot change the game mid-match.");
    const variant = this.normalizeVariant(payload?.variant);
    if (variant === room.variant) return this.ackOk(cb);
    const wasCoop = room.variant === "coop";
    room.variant = variant;
    // Switching into/out of co-op changes the team model — reset seats cleanly.
    if (wasCoop || variant === "coop") {
      for (const p of room.players.values()) {
        p.team = null;
        p.role = "operative";
      }
    }
    this.system(room, `The host switched the game to ${this.variantLabel(variant)}.`);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleSetWordPack(socket: IOSocket, payload: { packId: string }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (player.id !== room.hostId) return this.ackOk(cb, "Only the host can change the word pack.");
    if (room.game?.phase === "playing") return this.ackOk(cb, "You cannot change the word pack mid-match.");
    room.wordPack = String(payload?.packId || "mixed");
    this.ackOk(cb);
    this.broadcast(room);
  }

  // --- team admin tools (host only) --------------------------------------

  private hostGuard(socket: IOSocket, cb?: (a: any) => void): Room | null {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) {
      this.ackOk(cb, "You are not in a room.");
      return null;
    }
    if (ctx.player.id !== ctx.room.hostId) {
      this.ackOk(cb, "Only the host can do that.");
      return null;
    }
    if (ctx.room.game?.phase === "playing") {
      this.ackOk(cb, "You cannot change teams mid-game.");
      return null;
    }
    return ctx.room;
  }

  private handleTeamsReset(socket: IOSocket, cb?: (a: any) => void): void {
    const room = this.hostGuard(socket, cb);
    if (!room) return;
    for (const p of room.players.values()) {
      p.team = null;
      p.role = "operative";
    }
    this.system(room, "The host reset all teams.");
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleTeamsRandomize(socket: IOSocket, cb?: (a: any) => void): void {
    const room = this.hostGuard(socket, cb);
    if (!room) return;
    // Shuffle all players and split evenly; first player on each team is spymaster.
    const ids = [...room.order];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ids.forEach((id, index) => {
      const p = room.players.get(id);
      if (!p) return;
      p.team = index % 2 === 0 ? "red" : "blue";
      p.role = "operative";
    });
    const firstRed = ids.map((id) => room.players.get(id)).find((p) => p?.team === "red");
    const firstBlue = ids.map((id) => room.players.get(id)).find((p) => p?.team === "blue");
    if (firstRed) firstRed.role = "spymaster";
    if (firstBlue) firstBlue.role = "spymaster";
    this.system(room, "The host randomized the teams.");
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleTeamsLock(socket: IOSocket, payload: { locked: boolean }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    if (ctx.player.id !== ctx.room.hostId) return this.ackOk(cb, "Only the host can lock teams.");
    ctx.room.teamsLocked = !!payload?.locked;
    this.system(ctx.room, ctx.room.teamsLocked ? "Teams locked by the host." : "Teams unlocked.");
    this.ackOk(cb);
    this.broadcast(ctx.room);
  }

  // --- game actions ------------------------------------------------------

  private teamComposition(room: Room) {
    const stats = {
      red: { spymasters: 0, operatives: 0 },
      blue: { spymasters: 0, operatives: 0 },
    };
    for (const p of room.players.values()) {
      if (p.team === "red" || p.team === "blue") {
        if (p.role === "spymaster") stats[p.team].spymasters++;
        else stats[p.team].operatives++;
      }
    }
    return stats;
  }

  private handleStart(socket: IOSocket, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (player.id !== room.hostId) return this.ackOk(cb, "Only the host can start the game.");
    if (room.game?.phase === "playing") return this.ackOk(cb, "The game is already running.");

    const c = this.teamComposition(room);
    if (room.variant === "coop") {
      // Co-op: only the human team (blue) needs a spymaster + an operative.
      if (c.blue.spymasters < 1) return this.ackOk(cb, "Your team needs a spymaster.");
      if (c.blue.operatives < 1) return this.ackOk(cb, "Your team needs at least one operative.");
    } else {
      for (const team of ["red", "blue"] as const) {
        if (c[team].spymasters < 1) return this.ackOk(cb, `The ${team} team needs a spymaster.`);
        if (c[team].operatives < 1) return this.ackOk(cb, `The ${team} team needs at least one operative.`);
      }
    }

    const isWordGame = engine.VARIANTS[room.variant].kind === "word";
    room.game = engine.createGame({
      variant: room.variant,
      words: isWordGame ? getPackWords(room.wordPack) : undefined,
    });
    room.recorded = false;
    room.createdAt = Date.now();
    if (room.variant === "coop") {
      this.system(room, "Co-op game started. Find all your agents before the simulated opponent finds theirs!");
    } else {
      const startingAgents = engine.VARIANTS[room.variant].startingAgents;
      this.system(
        room,
        `Game started. ${room.game.startingTeam.toUpperCase()} team goes first (${startingAgents} agents).`,
      );
    }
    this.resetTurnTimer(room);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleClue(
    socket: IOSocket,
    payload: { word: string; count: number },
    cb?: (a: any) => void,
  ): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (!room.game) return this.ackOk(cb, "No game in progress.");
    if (player.role !== "spymaster" || player.team !== room.game.currentTeam) {
      return this.ackOk(cb, "Only the current team's spymaster can give a clue.");
    }
    const word = String(payload?.word ?? "");
    const count = Number(payload?.count);
    const error = this.applyGame(room, () => {
      const res = engine.giveClue(room.game!, player.team as Team, word, count);
      if (res.error) return res.error;
      room.game = res.state;
      return undefined;
    });
    if (error) return this.ackOk(cb, error);
    this.system(room, `${player.name} (${player.team}) gave the clue: ${word.trim().toUpperCase()} ${count}`);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleGuess(socket: IOSocket, payload: { cardIndex: number }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (!room.game) return this.ackOk(cb, "No game in progress.");
    if (player.role !== "operative" || player.team !== room.game.currentTeam) {
      return this.ackOk(cb, "Only the current team's operatives can guess.");
    }
    const idx = Number(payload?.cardIndex);
    let word = "";
    let role = "";
    const error = this.applyGame(room, () => {
      const res = engine.guess(room.game!, player.team as Team, idx);
      if (res.error) return res.error;
      room.game = res.state;
      if (res.outcome) {
        word = res.outcome.word;
        role = res.outcome.role;
      }
      return undefined;
    });
    if (error) return this.ackOk(cb, error);
    this.system(room, `${player.name} (${player.team}) guessed ${word.toUpperCase()} — ${role}.`);
    if (room.game.phase === "finished") {
      const reason =
        room.game.winReason === "assassin-revealed"
          ? "the assassin was revealed"
          : "all agents were found";
      this.system(room, `🏆 ${room.game.winner?.toUpperCase()} team wins — ${reason}!`);
    }
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleEndTurn(socket: IOSocket, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    if (!room.game) return this.ackOk(cb, "No game in progress.");
    if (player.role !== "operative" || player.team !== room.game.currentTeam) {
      return this.ackOk(cb, "Only the current team's operatives can end the turn.");
    }
    const error = this.applyGame(room, () => {
      const res = engine.endTurn(room.game!, player.team as Team);
      if (res.error) return res.error;
      room.game = res.state;
      return undefined;
    });
    if (error) return this.ackOk(cb, error);
    this.system(room, `${player.name} (${player.team}) ended the turn.`);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleNewGame(socket: IOSocket, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    // Any player may return everyone to the lobby once a game has finished;
    // while a game is still in progress, only the host may end it.
    const finished = room.game?.phase === "finished";
    if (!finished && player.id !== room.hostId) {
      return this.ackOk(cb, "Only the host can return to the lobby during a game.");
    }
    // Reset to lobby; teams/roles are preserved for a quick rematch.
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    room.game = null;
    room.turnDeadline = null;
    room.recorded = false;
    this.system(room, `${player.name} returned everyone to the lobby.`);
    this.ackOk(cb);
    this.broadcast(room);
  }

  private handleChat(socket: IOSocket, payload: { text: string }, cb?: (a: any) => void): void {
    const ctx = this.currentRoomAndPlayer(socket);
    if (!ctx) return this.ackOk(cb, "You are not in a room.");
    const { room, player } = ctx;
    const text = String(payload?.text ?? "").trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return this.ackOk(cb, "Empty message.");
    this.manager.addChat(room, {
      authorId: player.id,
      authorName: player.name,
      team: player.team,
      text,
      system: false,
    });
    this.ackOk(cb);
    this.broadcast(room);
  }
}
