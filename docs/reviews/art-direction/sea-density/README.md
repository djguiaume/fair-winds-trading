# Filling the empty seas: art notes (2026-10-25)

These answer the "Balance density across the four seas" thread's three questions. They are based on `plan/sea-density/1-density-today.png` and `proposal.md`, and follow the art bible (§8 seas, "Where seas meet", rules 8 and 10).

## 1. Filler kit per sea (use only the sea's own pieces)

**West (Iceland)**
- Basalt sea stacks in pairs or threes (Reynisdrangar). This is the best filler: tall, readable and cheap.
- A cinder skerry: black rock with a black-sand rim and a little moss (#7fa852) on top.
- A hot-spring islet with one small steam vent (the smoke and steam rule, small-vent size).
- A pumice bank: a sandbank in pale ash grey.
- A lava reef: a basalt reef, never coral.
- A charred wreck with a mark.
- No palms, coral, turf houses or ice.

**North (Greenland, Svalbard)**
- Grounded floes and bergs (ice style), and drifting icebergs.
- A seal skerry: slate with a snow cap and seals.
- A cairn on a bare skerry.
- A small snow islet with two or three snow pines.
- Ice stays inside the north quarter, with no floes past 315°/45°. "Ice meets fire" would break the border rule, so leave it out.

**East (Faroe, Scotland)**
- A skerry group with a bird cliff: dark layered cliff with white flecks for the birds.
- Sea-stack pairs.
- A turf-topped holm with sheep.
- A broch ruin on an islet.
- A wreck on a basalt shoal with its cardinal mark.

**South**
- A palm islet, a coral patch, a sandbank, or a wreck with a mark.
- The south is already full enough. One small piece at most.

## Seams
- **225° (west/south):** a basalt lava reef from Forge Reef toward the Coral Line is fine, but it must leave a gap of open water of at least about 40 units, with a marked passage (buoys). Where coral ends and basalt starts there must be water between them, never a mixed reef.
  - Watch the west cardinal past the Coral Line's end: a west cardinal means "safe water to the west". If the new reef sits west of it, change or move the mark so it stays true.
  - Pieces within about 80 units of the 225° line stay neutral (bare rock, a buoy, a wreck), not strongly styled.
- **135° (east/south):** the same idea. East pieces keep to dark basalt and turf up to about 130°, then open water or a mark, then coral.
- **315° and 45° corners:** fill each side with its own sea's piece (a basalt stack on the west side and a seal skerry on the north side; a grounded berg on the north side and a strand islet on the east side), at least 60 units apart. Nothing straddles the line. The border landmark rule (one named landmark per seam gap) can count here.

## 2. Budget per open-water piece
- Sea stack, skerry or rock group: at most about 300 triangles (up to about 550 for a banded, moss-capped landmark stack; west round 2).
- Wreck: at most about 400.
- Islet made with the island builder: at most about 1,200 (a full island is about 6,000).
- Marks are existing props.
- Each piece goes into an existing batch where one exists (reef, rock or prop instancing). An islet is the usual island mesh plus its lit-window mesh (2 draws).
- Per quarter: at most about 15 new pieces and about 8,000 new triangles in total.
- At most about 3 islets inside the camera's far distance at once.
- Lit windows only on a piece with a house. Glow (lava, vents) only on the west's own pieces.

## 3. The target
"No empty disc over r150" is a good target. Two caveats:
- **Not every gap is a flaw.** Guillaume's players love sailing, and long open reaches are part of the joy. Keep at least one deliberate open reach per sea (about r120–150, with a current or a wind zone so it feels alive). Allow the 10% empty to be about 8–12%, not a hard 10.
- **Do not count zones as landmarks.** A fog bank or wind zone is invisible in good weather, so only things the boat sees count: land, reef, bank, ice, marks, wrecks. Cap marks at about a third of a sea's fill, so it reads as land and rock, not a buoy field.

Review loop: chart plus one `npm run shots` per new piece at the sailing camera (day, and night for anything that glows). Send them to the art director before Guillaume.
