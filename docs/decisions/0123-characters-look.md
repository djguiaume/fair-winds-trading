# 0123. Characters' look: code-drawn portraits, dialogue card and journal on the chart

**Status:** Accepted, 2026-10-23: Guillaume picked **B, low-poly**. Portrait builder and `characters.json` implemented for review; the dialogue card and journal screens follow with the quest engine.

## Context

The community arcs ([0120](0120-communities-and-home-island.md)) need people: one per port, each with a portrait, a pleased mood for the end of an arc, short story cards (2 to 4 lines), and a journal. Guillaume asked for the general art direction with placeholder names before building. Art is built in code ([0016](0016-game-models-style-d-and-b2.md)); paid image credits need his yes first. The UI is style D ([0049](0049-ui-instrument-style.md)): navy panels, brass line, Barlow Condensed.

## Options

Static mockups for desktop, phone landscape and phone portrait: [characters review](../reviews/characters/README.md).

- **A. Storybook:** soft round faces with a warm outline and their home port behind them, round brass frame. Matches the storybook boats; moods read clearly at pin size. (Recommended in the review.)
- **B. Low-poly:** the same faces in flat-shaded facets, hexagon frame. Matches the 3D world; moods read less well small. **Chosen.**
- **C. Cameo:** one-colour profile on parchment. Cheapest; no moods, people look alike as pins.

## Decision

1. **Style B, low-poly portraits drawn in code as SVG** (`src/ui/portraits.ts`, `portraitSvg`): every part a polygon in flat-shaded facets, in a brass hexagon. Each person is a few values in `src/data/characters.json`: id, name, role, home port, and a look (skin, hair and hair style, hat and its colour, badge, beard, clothes, stripes, apron, trade item, backdrop colour). Named looks change part of it: Rook is `soaked` after the wreck in the tutorial (no cap or pipe, flat wet hair, drops). Moods (`neutral`, `pleased`, `worried`) change brows, eyes, cheeks and mouth only, drawn large so they read on a 30 px pin. No image files, no paid credits; a new person or look is data.
2. **Dialogue card:** portrait overlapping the card's edge, name and role, arc name with step pips, 2 to 4 lines, the ask in a brass box (goods icon, amount, where, what it leads to), **I'll bring it** / **Not now**. Shown on docking where someone has something for you, and from the port. Bottom card on desktop, low card with a button column on phone landscape, bottom sheet on phone portrait. The same card carries the end-of-arc choice of two buildings.
3. **Journal on the chart:** people pins (small portraits on their ports, amber ! for something new, brass glow for the tracked one), a dashed brass line from the tracked step to where its goods are, and a journal panel (tracked arc and its steps; other people one line each). Right panel on desktop, left drawer on phone landscape, bottom sheet on phone portrait.
4. Text stays in `en.json` / `fr.json`; quests and steps in the quest format of [0113](0113-levels-tutorial-and-music-as-data.md) (data shape with the quest engine work).

## Consequences

- One small SVG builder (`src/ui/portraits.ts`) shared by the card, the journal and the chart pins; cheap on the old tablet (no textures; the same person, look and mood give the same string, so it can be cached). Tested in `tests/characters.test.ts` (every person on a real port, known parts, colours, every mood draws).
- The pin size (about 30 to 40 px) is the test of the style: faces must still read there.
- Names and roles are the story draft's placeholders (PR #101); role translations come with the card. Next: the dialogue card and journal with the quest engine's data. The cast picture is in the [review](../reviews/characters/README.md).
