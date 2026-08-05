# Generating card art that MindAR can actually track

Card faces are not just decoration — they are the input to a feature matcher.
Art that looks great to a person can be nearly invisible to the tracker, and the
failure only shows up on a table, mid-game, when a card refuses to register.

These prompts are written against what the matcher looks for, not what reads as
attractive. Everything below follows from three facts:

1. **The detector finds corners and edges, not colours.** A large area of flat
   colour, however beautiful, contributes nothing. Fine irregular detail across
   the whole card is what produces feature points.
2. **Repetition is worse than emptiness.** A tiled or symmetric pattern gives
   the matcher many identical descriptors in different places, so it cannot tell
   which is which. Orientation becomes ambiguous and the object jitters.
3. **Perspective is baked in.** A reference photographed at an angle carries
   that distortion permanently, and every later view has to undo it. Generated
   art is flat by construction, which is exactly why it outperforms a photo.

Target: **300+ feature points** when probed. Measure before printing:

```bash
npm i -D canvas          # once
npm run ar:probe -- public/ar/targets/qawsi-cards.mind path/to/card.png
```

---

## Prompt — card A (`card_01_a`, الدلة)

```
Flat 2D playing-card face, perfectly front-facing with zero perspective,
artwork filling the entire frame edge to edge.

Subject: an ornate Arabian dallah coffee pot, bold vector illustration in deep
navy, warm orange, emerald green and cream.

CRITICAL DESIGN CONSTRAINT — the artwork must be extremely dense with fine,
irregular, NON-REPEATING detail across EVERY part of the card: intricate
engraved arabesque filigree covering the pot body, tiny geometric mosaic tiles
of many different sizes scattered asymmetrically through the background, small
scattered coffee beans at varied angles, dotted stippling, hairline
cross-hatching.

Strong local contrast everywhere — light shapes placed directly against dark
shapes, never light-on-light or dark-on-dark.

Deliberately ASYMMETRIC composition: the pot sits off-centre to the LEFT and
slightly low. Four completely different decorative motifs, one in each corner.

Absolutely NO large flat areas of uniform colour. NO smooth gradients. NO
repeating or tiled wallpaper pattern. NO mirror symmetry. NO text, letters or
numbers. NO border or frame around the edge.

Sharp crisp edges, high detail, print-ready, evenly lit, no glare, no drop
shadow, no photographic texture.
```

## Prompt — card B (`card_01_b`, الفنجان)

```
Flat 2D playing-card face, perfectly front-facing with zero perspective,
artwork filling the entire frame edge to edge.

Subject: a small Arabian finjan coffee cup on a saucer with steam curling
upward, bold vector illustration in deep navy, warm orange, emerald green and
cream.

CRITICAL DESIGN CONSTRAINT — the artwork must be extremely dense with fine,
irregular, NON-REPEATING detail across EVERY part of the card: intricate
hand-painted patterns on the cup, tiny irregular mosaic shards of many
different sizes scattered asymmetrically through the background, scattered
cardamom pods and dates at varied angles, dotted stippling, hairline
cross-hatching.

Strong local contrast everywhere — light shapes placed directly against dark
shapes, never light-on-light or dark-on-dark.

Deliberately ASYMMETRIC composition: the cup sits low and to the RIGHT. Four
completely different decorative motifs, one in each corner — and all four must
differ from those on any other card.

This card must look CLEARLY DIFFERENT from a coffee-pot card: different colour
balance, different layout, different motifs. The two cards of a pair are
partners, not twins.

Absolutely NO large flat areas of uniform colour. NO smooth gradients. NO
repeating or tiled wallpaper pattern. NO mirror symmetry. NO text, letters or
numbers. NO border or frame around the edge.

Sharp crisp edges, high detail, print-ready, evenly lit, no glare, no drop
shadow, no photographic texture.
```

---

## Reusing this for the remaining pairs

Keep everything except the subject line and the composition offset. The pack's
pairs are element-and-its-use, so each card stays recognisable as half of a
concept while looking nothing like its partner:

| Pair | Card A | Card B |
| --- | --- | --- |
| pair_02 | صقر محلّق | ريشة صقر |
| pair_03 | نخلة | طبق تمر |
| pair_04 | موظف | بطاقة دخول |
| pair_05 | قطعة عود | مبخرة |
| pair_06 | ساعة | تقويم |
| pair_07 | مفتاح | قفل |

Vary two things per card so no two cards ever collide in feature space:

- **Where the subject sits** — left/right/high/low, never centred.
- **The corner motifs** — four distinct ones per card, unique across the pack.

## Returning the files

- **PNG**, roughly 3:4, at least 1000 px on the long edge.
- **No frame, no margin** — the artwork must reach all four edges. A white
  border is a large flat area contributing nothing, and it shifts the scale the
  tracker solves for.
- One file per card, named `card_01_a.png`, `card_01_b.png`, and so on.

## If a card probes below 300 points

In order of effect:

1. Add more fine irregular detail to whichever region is emptiest — usually the
   background.
2. Raise local contrast: darken the darks and lighten the lights rather than
   shifting hue.
3. Break any symmetry that crept in, including a subject that ended up centred.
4. Remove smooth gradients; replace them with stippling or hatching.
