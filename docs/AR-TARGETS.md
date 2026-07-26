# Compiling the card target library

The game recognizes **physical printed cards** from their own artwork. There is
no QR code and no marker frame — MindAR matches natural image features, so the
quality of the printed art directly determines how well tracking works.

Everything below produces one file:

```
public/ar/targets/qawsi-cards.mind
```

---

## 1. The one rule that breaks everything

`targetIndex` in `src/content/targets-manifest.json` **must equal the position
of that image in the list you hand the compiler.** MindAR reports a positional
integer and nothing else; if the order drifts by one, every card after it is
silently mis-identified and the game will confidently score the wrong pair.

The manifest is validated at startup (`src/content/index.ts`) for a dense
`0..n-1` range and for agreement with `cards.json`, but it cannot check the
order you used in the compiler. That part is on you.

Current order — 14 images, indices 0–13:

| idx | targetId | pair | idx | targetId | pair |
| --- | --- | --- | --- | --- | --- |
| 0 | `card_01_a` | pair_01 | 7 | `card_04_b` | pair_04 |
| 1 | `card_01_b` | pair_01 | 8 | `card_05_a` | pair_05 |
| 2 | `card_02_a` | pair_02 | 9 | `card_05_b` | pair_05 |
| 3 | `card_02_b` | pair_02 | 10 | `card_06_a` | pair_06 |
| 4 | `card_03_a` | pair_03 | 11 | `card_06_b` | pair_06 |
| 5 | `card_03_b` | pair_03 | 12 | `card_07_a` | pair_07 |
| 6 | `card_04_a` | pair_04 | 13 | `card_07_b` | pair_07 |

---

## 2. Preparing the images

Put the source images in `public/ar/targets/source/` named exactly as the
manifest says (`card_01_a.jpg`, …).

Good targets:

- **High feature density.** Texture, irregular detail, asymmetric composition.
- **Strong local contrast**, not just bright colour.
- **Flat, straight-on photograph or the original print-ready artwork.** No
  perspective, no glare, no drop shadow from the photograph itself.
- **~1000 px on the long edge.** Larger just slows compilation.
- **Unique per card.** This is the important one: the two cards in a pair are
  deliberately *different pictures* (the dallah and its cup). Two near-identical
  images confuse the matcher and let the same physical card register twice.

Avoid: large flat colour fields, heavy symmetry, repeated patterns, mostly-text
cards, and glossy laminate that blows out under room lighting.

---

## 3. Compiling

### Browser (easiest)

1. Open <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Drag in all 14 images **in manifest order**. Verify the order in the preview
   list before compiling — the tool sorts by drop order, not filename.
3. Compile, download `targets.mind`.
4. Save it as `public/ar/targets/qawsi-cards.mind`.

### CLI

The MindAR compiler needs `canvas`, which needs native build tools. It is a
dev-only dependency and deliberately not installed by default:

```bash
npm i -D mind-ar canvas        # canvas needs libcairo/libjpeg/libgif headers
npx mind-ar-js-compiler \
  --input public/ar/targets/source/card_01_a.jpg \
          public/ar/targets/source/card_01_b.jpg \
          ... all 14, in order ... \
  --output public/ar/targets/qawsi-cards.mind
```

> This repo installs `mind-ar` with `--ignore-scripts`, so the browser runtime
> works while the native compiler does not. That is intentional: compiling
> targets is an authoring step, not a build step.

---

## 4. Verifying

1. `npm run dev`, open the game, reach the prepare screen. It performs a HEAD
   request for the `.mind` file and will tell you plainly if it is absent.
2. Start a match and point the camera at each printed card in turn. The scan
   slot should show the **correct Arabic card name**.
3. If a name is wrong, your compile order does not match the manifest. Recompile
   — do not "fix" it by editing `targetIndex`, or the two will disagree the next
   time someone recompiles.

Tracking quality checks:

- An object should appear within ~half a second at arm's length.
- Briefly covering a card should **not** make the object flicker — that is the
  400 ms grace window in `AR_TUNING.anchorGraceMs` doing its job.
- Both cards of a turn should be able to show objects at the same time
  (`AR_TUNING.controller.maxTrack` is 2; raise it if you want more).

---

## 5. Adding a new pair

1. Add two entries to `src/content/cards.json` and one to `pairs.json`.
2. Append two rows to `targets-manifest.json` with the **next** free
   `targetIndex` values.
3. Add both `targetId`s to the `default_set` block of `object-sets.json` — the
   default set must be complete; other sets may be partial and fall back to it.
4. Drop the two new images at the **end** of the compiler input list and
   recompile. Appending keeps every existing index stable.
5. Start the app. The content validator will refuse to boot if anything
   disagrees, which is the point.
