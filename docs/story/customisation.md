# Customisation words and paid-item voice (v1.4 ruling)

Cosmetics are pride, never power. System design: [v1.4/customisation.md](../v1.4/customisation.md). The item names (EN and FR) live in `src/data/cosmetics/` and `src/i18n`; the screen is "Boat looks" / « Apparence du bateau ».

## Availability (Guillaume OK'd "free is ok at the moment")
- Free: sail colours, patterns, hull colours, four plain signal flags, plain wake, the first four logos (Anchor, Gull, Wave, Knot).
- Earned: logos tied to arcs and outposts, figureheads (one per ring arc and sea outpost), regatta pennants, one extra wake per series won (quiet white foam, no sparks or smoke).
- No coin prices. The Tern stays a single gift, not a pick-one (the pick-one reward is for choices of equal power).

## Word rules
- Item names are plain and sea-worn. No "Swift", no "Skerry", no leading word already taken (Cinder, Teeth, Gull, Lantern, Palm, Gannet, Strand) for boat-like names.
- Figureheads are carved things, not characters: no speech, no lore claims, nothing about pirates or guns.
- Locked line: "Earn it: {how}" / « À gagner : {how} », NBSP before ":". Pennant names match `regatta.pennant.*` ("Fanion de Saltmere", "du Grand Large", "des Quatre Vents", "du Club de voile"; never "anneau").

## Voice for a future paid item
- Price once, plainly, in the real currency. No strikethrough prices, no bundles.
- No countdowns, "limited", "last chance", "only today", "don't miss", no red dots, no nag pop-ups.
- No character ever sells or hints (Wren, Rook and the others never advertise).
- A paid item is never also earned, never power, and no story step needs one. Earned items are never put on sale.
- One tap always leaves; paid items live only on this screen. Word it "Available" / « Disponible », never "Get yours".
