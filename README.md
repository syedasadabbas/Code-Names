# Codenames — Online Multiplayer

A real-time, multi-room web implementation of the party game **Codenames**
(designed by Vlaada Chvátil). Two teams race to identify their secret agents from
a 5×5 grid of codenames using one-word clues — while avoiding the assassin.

This is a fan-made project for private play with friends. It is not affiliated
with or endorsed by Czech Games Edition.

---

## Features

- **Three game types** — choose on the main page when creating a room:
  - **Codenames (classic)** — 25 word cards, 5×5, 9 vs 8 agents, **4+ players** (scales to large groups — more operatives per team).
  - **Codenames: Pictures** — 20 picture cards, 5×4, 8 vs 7 agents, 4+ players.
  - **Co-op** — the base-game "fewer players" variant (**2+ players**): your team plays against a *simulated opponent* that covers one of its agents each round. Win by finding all your agents; lose on the assassin or if the opponent finds all of theirs first. Your score is the enemy agents you never contacted.
- **Themed word packs + difficulty** — for word-based games the host picks a pack in the lobby: Mixed, Everyday, Animals, Food & Drink, Geography, Movies & TV, Sports, Science & Tech (tagged easy/medium/hard).
- **Auto-seating** — joining players are placed into an open slot automatically (teams kept balanced; first per team becomes spymaster) and can still switch to any open seat.
- **Real-time multiplayer** over WebSockets (Socket.IO) — clue-giving, guessing,
  team changes, chat, and the turn timer all sync instantly across clients.
- **Multi-room** — create a room, share the 4-letter code, and play many games in
  parallel. Each room has its own authoritative game state and variant on the server.
- **Full role support** — spymasters (who see the key card) and field operatives,
  plus spectators.
- **Reconnection** — refresh or drop your connection and reclaim your seat.
- **Turn timer** (optional) — configurable per-turn countdown; the turn auto-ends
  when time runs out.
- **Chat & event log** per room.
- **Themed lobby** — Blue / Game Settings / Red layout with Operatives &
  Spymasters panels, spectators, JOIN TEAM buttons, and host tools
  (switch game, timer, reset / randomize / lock teams).
- **Exit & return** — every player can exit the room; when a game ends, anyone
  can return the room to the lobby for a rematch (host can end mid-game).
- **Sound effects** — synthesized via the Web Audio API (no bundled audio):
  distinct cues for card select, turn change, clue given, chat, correct guess,
  wrong guess, bystander, assassin, and win/lose. Toggle + volume in Preferences.
- **Settings & accessibility** — tabbed Settings (Admin / Player / Preferences /
  Accessibility): dark/light/system theme, text size, colorblind-assistive card
  symbols, reduced motion, and sound controls.
- **Optional accounts** — play as a guest, or register to have completed games
  recorded to your **history**. Guests never need an account.
- **Local-first persistence** — SQLite via Prisma; no external services required.

## Rules implemented

- Board depends on the variant:
  - **Classic:** 25 cards — starting team **9** agents, other **8**, **7** bystanders, **1 assassin**.
  - **Pictures:** 20 cards — starting team **8** agents, other **7**, **4** bystanders, **1 assassin**.
  - **Co-op:** 25 cards — your team **9** agents, simulated opponent **8**, **7** bystanders, **1 assassin**;
    the opponent covers one of its agents at the end of each of your turns.
- The starting team gets the extra agent and the first turn.
- Spymaster gives a **one-word clue + a number**. The clue is rejected if it is
  empty, multi-word, out of range (0–9), or matches/contains a word on the board.
- Operatives may guess **exactly the clue number** of times (no bonus guess), and
  must guess at least once before passing.
- Guessing a bystander or an opponent's agent ends the turn; guessing the
  **assassin** loses the game immediately.
- A team wins by revealing all of its agents (possible even on the opponent's turn).
- Clue number **0** means unlimited guesses for that turn.

---

## Tech stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Frontend     | Next.js 15 (App Router, React 19) + Tailwind CSS    |
| Real-time    | Socket.IO (server + client)                         |
| Server       | Custom Node HTTP server hosting Next.js + Socket.IO |
| Persistence  | Prisma ORM + SQLite (local-first)                   |
| Auth         | bcrypt password hashing + JWT (optional accounts)   |
| Unit tests   | Vitest (pure game engine)                           |
| E2E tests    | Playwright (multi-client real-time game)            |
| Language     | TypeScript end-to-end                               |

## Project structure

```
server/
  index.ts            Custom server: Next.js + Socket.IO on one port
  game/               Pure, unit-tested game engine (no I/O)
    engine.ts         Board/key generation, clue/guess/turn/win rules
    engine.test.ts    Vitest unit tests
    types.ts, words.ts
  rooms/roomManager.ts In-memory rooms + per-viewer state serialization
  socket/gameServer.ts Socket.IO event handlers (authoritative)
  db/                 Prisma client + game-history persistence
  auth/auth.ts        Password hashing + JWT
shared/protocol.ts    Wire types shared by client and server
src/
  app/                Next.js routes (home, /room/[code], /history, /api/auth/*)
  components/         React UI (Lobby, GameBoard, CardTile, CluePanel, Chat, …)
  hooks/useRoom.ts    Socket connection + room state + reconnection
  lib/                Socket + client-side identity helpers
prisma/schema.prisma  User, GameRecord, GameParticipant
tests/e2e/            Playwright end-to-end tests
```

Distances, times, and any measurements in code/comments use **metric units**
(the turn timer is configured in seconds).

---

## Getting started

Requirements: Node.js 20+ (developed on Node 22) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (defaults are fine for local play)
cp .env.example .env      # then edit JWT_SECRET for anything non-local

# 3. Create the local SQLite database
npm run db:push

# 4a. Development (hot reload)
npm run dev

# 4b. Production
npm run build
npm start
```

Open http://localhost:3000, create a room, and share the code. You need at least
**4 players** (each team needs one spymaster and one operative) to start a game.

### Environment variables (`.env`)

| Variable         | Purpose                                    | Default                   |
| ---------------- | ------------------------------------------ | ------------------------- |
| `PORT`           | HTTP + WebSocket port                      | `3000`                    |
| `DATABASE_URL`   | SQLite database location                   | `file:./prisma/dev.db`    |
| `JWT_SECRET`     | Secret for signing account tokens          | dev placeholder — change! |
| `JWT_EXPIRES_IN` | Account token lifetime                     | `7d`                      |

---

## Testing

```bash
npm test          # Vitest unit tests for the game engine (16 tests)
npm run typecheck # tsc --noEmit across the whole project
npm run test:e2e  # Playwright: full 4-player real-time game to a win
```

The Playwright config runs the **production** server (`npm start`) automatically,
which is much lighter than dev-mode compilation. Run `npm run build` first, and
install the browser once with `npx playwright install chromium`.

> **Note:** E2E tests launch a headless Chromium. On a machine already running
> many browser processes you may see `net::ERR_INSUFFICIENT_RESOURCES`; this is
> host resource pressure, not an app bug — close some processes and retry.

---

## Notes & limitations

- Room/game state lives in server memory. Restarting the server clears active
  rooms (only finished-game history is persisted). A single-process deployment is
  assumed; scaling horizontally would require a shared store (e.g. Redis) — see
  the deployment discussion in `CHANGELOG.log`.
- The word list in `server/game/words.ts` is an original family-friendly list.
- The **Pictures** card images in `public/pictures/cards/` (280 images) are sourced
  from the open-source project
  [codenames-pictures](https://github.com/samdemaeyer/codenames-pictures) by Sam De
  Maeyer, itself an adaptation of Czech Games Edition's *Codenames: Pictures*. They
  are included for private, non-commercial play. See
  `public/pictures/ATTRIBUTION.md`. Review the rights to these assets before hosting
  publicly, and swap them out if needed — the engine only needs image files named
  `card-<id>.jpg` (adjust `PICTURE_CARD_COUNT` in `server/game/pictures.ts`).

## License

For private, non-commercial use. Codenames is a trademark of its respective owners.
