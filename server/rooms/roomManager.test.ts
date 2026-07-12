import { describe, it, expect } from "vitest";
import { RoomManager } from "./roomManager.js";

function mgrWith(...specs: Array<{ variant?: "classic" | "pictures" | "coop"; isPublic?: boolean; extra?: number; started?: boolean }>) {
  const m = new RoomManager();
  const rooms = specs.map((s) => {
    const { room } = m.createRoom({ name: "Host", userId: null, variant: s.variant, isPublic: s.isPublic });
    for (let i = 0; i < (s.extra ?? 0); i++) m.addPlayer(room, `P${i}`, null);
    if (s.started) room.game = {} as never; // simulate a game in progress
    return room;
  });
  return { m, rooms };
}

describe("matchmaking: findOpenPublicRoom", () => {
  it("returns an open public lobby room", () => {
    const { m, rooms } = mgrWith({});
    expect(m.findOpenPublicRoom()?.code).toBe(rooms[0].code);
  });

  it("excludes private rooms", () => {
    const { m } = mgrWith({ isPublic: false });
    expect(m.findOpenPublicRoom()).toBeNull();
  });

  it("excludes rooms whose game has started", () => {
    const { m } = mgrWith({ started: true });
    expect(m.findOpenPublicRoom()).toBeNull();
  });

  it("filters by variant when requested", () => {
    const { m, rooms } = mgrWith({ variant: "classic" }, { variant: "pictures" });
    expect(m.findOpenPublicRoom("pictures")?.code).toBe(rooms[1].code);
    expect(m.findOpenPublicRoom("coop")).toBeNull();
  });

  it("prefers the fullest joinable room", () => {
    const { m, rooms } = mgrWith({ extra: 0 }, { extra: 3 }, { extra: 1 });
    expect(m.findOpenPublicRoom()?.code).toBe(rooms[1].code); // 4 players
  });

  it("excludes full rooms (>= MATCH_CAP players)", () => {
    const { m } = mgrWith({ extra: RoomManager.MATCH_CAP + 2 });
    expect(m.findOpenPublicRoom()).toBeNull();
  });

  it("reports match stats for open public rooms only", () => {
    const { m } = mgrWith({ extra: 1 }, { isPublic: false }, { started: true });
    const stats = m.matchStats();
    expect(stats.openRooms).toBe(1);
    expect(stats.players).toBe(2); // host + 1
  });
});
