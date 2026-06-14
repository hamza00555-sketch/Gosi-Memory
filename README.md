# قوسي · QAWSI

A premium, mobile-first, **online memory-card game for teams**. Match pairs to
reveal a hidden phrase; win by solving the phrase or topping the score. Built as
a clean, testable foundation — not a fragile demo.

> Arabic RTL from day one · futuristic navy/blue/green theme · camera-style HUD
> ready for WebAR.

---

## Why this stack

| Choice | Reason |
| --- | --- |
| **Vite + React + TS** (over Next.js) | The app is a client-heavy realtime game with camera/AR and (later) WebGL. There is no SEO/SSR need, and all server-authoritative logic lives in Supabase (RPC + Edge Functions), not Next API routes. Vite gives faster HMR and a lighter mobile bundle. |
| **TailwindCSS** | Fast, consistent, mobile-first styling with design tokens; trivial RTL. |
| **Zustand** | Tiny store for *session/UI* state only (profile, cosmetics, toasts). Game state is never a global — it comes from the authoritative service. |
| **Zod** | Runtime validation at trust boundaries (moves, room payloads). |
| **Supabase** | Auth + Postgres + Realtime + Edge Functions for safe multiplayer. |
| **Vitest** | Fast unit tests for the pure engine. |

## The core idea (architecture)

The **entire ruleset lives in one pure, deterministic, framework-free engine**
(`src/core/engine`). The same `reduce()` runs in three places:

1. **Solo / AI** — locally in the browser.
2. **Online clients** — optimistically, for instant feedback.
3. **The server (authority)** — inside the `game-action` Edge Function.

One source of rules ⇒ no duplication, fully testable, and the client can never
invent an outcome. IO never touches components: everything goes through the
**`GameService`** interface (`src/services`), which has a `LocalGameService`
(works fully offline today) and a `SupabaseGameService` (realtime).

```
UI (features/*, components/*)
   │  depends only on ↓
GameService interface  ──►  LocalGameService (offline, in-memory + localStorage)
   │                        SupabaseGameService (Realtime + Edge Function)
   ▼
core/engine  ← pure rules (reduce, deck, scoring, turns, solve, win)
core/ai      ← AI opponent (same engine, memory-based difficulty)
core/content ← phrase packs + cosmetics (JSON seeds)
core/validation ← Zod schemas
```

### What can break in online multiplayer — and how we defend

| Risk | Defense |
| --- | --- |
| Two players move at once → corrupted state | Single authoritative writer; game row locked `FOR UPDATE`; optimistic `version` check rejects stale writes. |
| Client lies about whose turn / which outcome | Server runs the engine; client sends **intent only** (card id / guess). Player identity is taken from the JWT, never the request body. |
| Invalid moves (wrong turn, matched card, 3rd card, duplicate, after game end) | `reduce()` returns typed `MoveError`s; illegal moves are impossible to apply. Tested. |
| Refresh / disconnect destroys the room | State persists (localStorage offline; Postgres online). `reconnectToRoom()` re-hydrates room + game. |
| Network blips | All writes return a `Result`; UI surfaces errors via toasts and refetches. |

## Folder structure

```
src/
  core/               # PURE game logic — no React, no IO
    types/            # domain types (Player, Room, Game, Card, Phrase, ...)
    engine/           # state machine: initGame, reduce, deck, scoring, selectors
    ai/               # AI opponent (easy/medium/hard via memory retention)
    content/          # loaders for phrase packs + cosmetics
    validation/       # Zod schemas
    utils/            # rng (seedable), ids, Arabic normalization
  content/            # JSON seed data (phrases, cosmetics)
  services/           # GameService interface + Local + Supabase adapters
  state/              # Zustand stores (session, toasts) — UI state only
  ar/                 # AR abstraction: ArProvider, CameraHud, adapters
  features/           # screens: lobby, room, game, results, store
  components/         # shared UI (Logo, BottomNav, ToastHost, ...)
  hooks/              # useRoomGame, useCallbackRef
  i18n/               # Arabic strings (single source)
supabase/
  migrations/         # schema + RLS + room RPCs
  functions/          # game-action Edge Function (authoritative writer)
```

---

## Install & run

```bash
npm install
npm run dev        # http://localhost:5173  (runs fully offline by default)
```

Other scripts:

```bash
npm run build      # typecheck + production build
npm run typecheck  # tsc project build only
npm test           # run the Vitest suite
npm run test:watch # watch mode
```

The app runs **with zero configuration** using the offline `LocalGameService`
(solo vs AI works immediately; you can also create/join rooms locally in one
browser for development).

## Environment variables

Copy `.env.example` → `.env`:

```
VITE_SUPABASE_URL=        # https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=   # public anon key (safe in browser; RLS protects data)
VITE_BACKEND_MODE=local   # "local" (offline) or "supabase" (realtime)
```

If Supabase vars are missing, the app **always** falls back to local mode.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations (SQL editor or CLI):
   ```bash
   supabase db push        # or paste supabase/migrations/*.sql into the SQL editor
   ```
   This creates `profiles`, `rooms`, `room_members`, `games`, enables **RLS**,
   and adds the room RPCs (`create_room`, `join_room`, `set_ready`, ...).
3. Deploy the authoritative game writer (reuses the shared engine):
   ```bash
   ln -s ../../../src/core supabase/functions/_shared/core   # share the engine
   supabase functions deploy game-action
   ```
4. Enable **Realtime** on the `rooms`, `room_members`, and `games` tables.
5. Set `VITE_BACKEND_MODE=supabase` and fill the URL + anon key.
6. Wire auth: on sign-in, set the session player `id` to the authenticated
   `auth.uid()` so client intent matches the server identity. (The server
   already ignores client-supplied ids and uses the JWT.)

**Why this is the safe option:** every game mutation is a single locked,
transactional write running the same engine as the client — concurrent moves
serialize, stale writes are rejected, and the client is never authoritative.

---

## How to add content

### Add phrases
1. Edit a pack in `src/content/phrases/` (or add a new JSON file), e.g.:
   ```json
   {
     "id": "proverb_010",
     "category": "أمثال",
     "fullText": "الصبر مفتاح الفرج",
     "words": ["الصبر", "مفتاح", "الفرج"],
     "difficulty": "medium",
     "sourceType": "proverb"
   }
   ```
2. If it's a brand-new file, register it in `src/core/content/phrases.ts`.
   Phrase-solve matching is diacritic/spacing-insensitive (see
   `utils/arabic.ts`).

### Add a card skin / cosmetic
1. Add an entry to `src/content/cosmetics.json`:
   ```json
   { "id": "skin_gold", "name": "ذهبي", "type": "card_skin",
     "items": ["back_gold"], "price": 800, "isDefault": false,
     "description": "ظهر ذهبي فاخر." }
   ```
2. Map any new visual asset id in `src/features/game/faceAssets.ts` (card faces)
   or your skin renderer. No component code duplicates these — they're data.

### Add an AR set (later)
Add a cosmetic with `"type": "ar_set"` and the object ids in `items`. The set is
consumed by the AR layer when the real recognizer is plugged in.

## Replacing the mock AR with real WebAR (MindAR)

The AR layer (`src/ar`) is an abstraction so the game never talks to a camera or
CV library directly:

- **`CameraHud`** renders the live camera feed (or a styled fallback) with the
  game overlay on top.
- **`CardRecognitionAdapter`** is the seam. Today **`MockCardRecognitionAdapter`**
  turns a tap into a `ScanResult`. To go real:
  1. Implement `FutureMindARAdapter` (skeleton provided) using MindAR image
     tracking; emit a `ScanResult { cardId, confidence }` on `targetFound`.
  2. Pass it to `<ArProvider adapter={new FutureMindARAdapter()}>`.
  No game logic changes — the engine consumes the same `ScanResult`.

---

## Tested behavior

`npm test` covers the load-bearing logic:

- deck generation (size, pairing, determinism, word mapping)
- matching, scoring, phrase reveal
- turn switching (continue/pass configurable)
- phrase solving (correct win + each wrong-guess penalty)
- invalid move rejection (wrong turn, duplicate, 3rd card, matched card, after end)
- end-of-game by score
- AI move selection (known-pair completion, legality, difficulty retention)
- room/game state transitions (LocalGameService)
- Arabic normalization

## Status & next steps

- ✅ Offline solo-vs-AI fully playable; 1v1 / 2v2 architecture in place.
- ✅ All screens (Lobby, Room, Game HUD, Results, Store).
- 🔜 Wire Supabase auth → session id; deploy `game-action`; stepwise AI
  animation; real MindAR adapter; richer 2v2 team UI; daily missions backend.
