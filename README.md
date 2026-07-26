# قوسي ميموري · QAWSI Memory

A **camera-first memory game played with real printed cards**, for two teams of
1–3 players sitting around one table with one phone each.

There is no card grid on screen. You flip a physical card, point the camera at
it, an AR object appears over it, and the two devices stay in sync through
Firebase. Every match opens a quick head-to-head challenge and uncovers a piece
of each team's picture puzzle.

> Arabic RTL · mobile-first · two devices, one table

---

## How a match runs

1. One device creates a room and shows a 4-character code; the other joins.
2. Each team sets its name, colour, 1–3 players, and its own AR object set.
3. The host picks the target score (500 / **600** / 800).
4. Both devices load the target library and object set, then confirm ready.
5. A synchronized countdown starts the match.
6. On your turn you flip **two** cards. Match → +100, a challenge for both
   teams, one puzzle piece, and your team keeps the turn — with the *next*
   teammate playing. Mismatch → the turn passes.
7. Solving your picture puzzle is +200; a wrong guess is −50 and locks the
   button until your turn comes round again.
8. First team to the target score wins. If the pairs run out first, both teams
   reshuffle the physical cards and a new round begins with scores carried over.

---

## Architecture

The whole ruleset is **one pure function** in `src/game/engine/reduce.ts`. It
takes canonical room state, a command, and a timestamp, and returns new state
or a typed rejection. No IO, no clock, no randomness outside the match seed.

```
        device A                    device B
           │                            │
      intent only                  intent only
           └──────────┬─────────────────┘
                      ▼
            rooms/{id}/commands           (Realtime Database)
                      │
                      ▼
        host device runs reduce() in a transaction
                      │
                      ▼
              rooms/{id}/game             ← canonical, host-only writes
                      │
           ┌──────────┴─────────────┐
           ▼                        ▼
       device A                 device B      (subscriptions)
```

A device can only *propose*. It never writes score, turn or phase — the security
rules forbid it and the engine would refuse anyway. That is what makes an
illegal move unrepresentable rather than merely discouraged.

### Three separate concepts, deliberately

| Concept | Lives in | Knows about |
| --- | --- | --- |
| **Recognition** — "this image is visible" | `src/ar/recognition` | MindAR, matrices |
| **Rendering** — "draw this over it" | `src/ar/rendering` | three.js, object sets |
| **Rules** — "is this a legal move" | `src/game/engine` | nothing else |

An object appearing over a card does **not** mean the card was selected. A card
left face-up keeps its object the whole time but must register exactly once —
that gap is `src/ar/recognition/scanGate.ts`, which requires confidence, four
consecutive stable frames, a per-card debounce and a global cooldown before a
sighting is even offered to the rules.

Because object sets are keyed by `targetId` and never consulted by the engine,
the two devices can show completely different objects for the same physical card
and still agree exactly on the outcome.

### Folder map

```
src/
  domain/        pure types: cards, teams, game, challenge, puzzle, commands
  content/       JSON packs + Zod-validated loader with integrity checks
  game/
    engine/      reduce, turns, scoring, challenge + puzzle factories, selectors
    rules/       every tunable number, in one file
    state/       React hooks over the backend
  backend/       RoomBackend interface + offline dev backend
  firebase/      auth, rooms, presence, commands, host authority, server time
  ar/
    recognition/ MindAR controller, simulator, scan gate
    rendering/   ArScene, ObjectAnchor
    loaders/     object sets, GLTF cache, target library
  features/      splash, onboarding, lobby, setup, camera-game, challenge,
                 puzzle, results, dev
  components/    shared UI kit
  audio/         sound manager
  i18n/          all Arabic copy, one file
```

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 43 engine tests
npm run typecheck
npm run build
```

With no configuration the app boots into the **offline dev backend**: a full
match is playable on one device, which is how the rules were developed and
tested. That is not two-device play — see below.

### Firebase (required for real two-device play)

1. Create a Firebase project, enable **Anonymous** auth and **Realtime
   Database**.
2. Copy `.env.example` → `.env.local` and fill in the six `VITE_FIREBASE_*`
   values from *Project settings → Your apps → SDK setup*.
3. Deploy the rules:
   ```bash
   firebase deploy --only database
   ```
4. Restart the dev server. The lobby stops showing the "Firebase not configured"
   notice once it picks up a complete config.

Local emulators:

```bash
firebase emulators:start          # auth :9099, database :9000, UI :4000
# then set VITE_FIREBASE_EMULATOR=true
```

`database.rules.json` denies everything by default. Only room members can read a
room; only the host can write `game`, `challenge`, `puzzles` and `status`; a
device may append a command only if `deviceUid === auth.uid`, so it cannot act
as the other team.

### Printed cards and AR

The `.mind` target library is **not** in the repo — it has to be compiled from
your printed artwork. `docs/AR-TARGETS.md` is the full procedure, including the
one rule that breaks everything: image order must match `targetIndex`.

Until it exists, the prepare screen says so plainly instead of hanging.

---

## Content is data

| File | What it drives |
| --- | --- |
| `src/content/cards.json` | 14 physical cards |
| `src/content/pairs.json` | which two cards form a pair |
| `src/content/targets-manifest.json` | `targetIndex` → card, for MindAR |
| `src/content/object-sets.json` | swappable AR looks, per device |
| `src/content/challenges.json` | the mini-games |
| `src/content/puzzles.json` | the picture puzzles |
| `src/content/sounds.json` | sound registry |

The loader validates all of it at startup and refuses to boot on a contradiction
— a pair pointing at a missing card, a duplicate or non-dense `targetIndex`, an
incomplete default object set. Authoring mistakes fail immediately instead of
becoming a wrong score mid-match.

The two cards of a pair are deliberately **different images** sharing one
`pairId`. That is what makes scanning the same card twice impossible to mistake
for a match.

---

## Development mode

`VITE_ENABLE_AR_SIMULATOR=true` unlocks `/dev/ar-simulator`, the only place a
card grid is allowed to exist. The route resolves to nothing in a production
build — the shipped game is camera-only, and a tappable grid would quietly
become the real interface.

## Tested

`npm test` covers roster limits, every scan rejection (wrong turn, same card,
matched card, unknown card, low confidence, expired turn, stale command),
match/mismatch, player rotation within a team, turn retention after a match,
challenge payout exactly once, puzzle scoring and locking, winning by score and
by puzzle, round reset on pair exhaustion, determinism from a seed, and JSON
round-tripping of the whole state.
