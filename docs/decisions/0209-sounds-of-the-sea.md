# 0209. Sounds of the sea

**Status:** Proposed (2026-10-25). Built; waiting on the art director's listen and Guillaume's.

## Context

Part 5 of the [Phase 5 brief](../phase-5/brief.md) ([0207](0207-the-roadmap-after-phase-4.md)): "one bed
per sea, a harbour bell, sail flap and luffing in irons, a crash thud, the regatta horn and gun, a
theme variation per sea and a regatta theme. Every sound a line in `src/data/audio.json`, volume in
Settings." Until now the game had the music ([0045](0045-background-music.md)), the press creak
([0078](0078-press-warning.md)), the prologue foghorn ([0139](0139-gentler-prologue-and-quest-cards.md))
and people's babble ([0132](0132-westholm-mill-and-babble-voices.md)), all synthesised, and the sea itself was silent.

Rules that shape it: everything as data with an editor and a CLI; never spend paid credits (sound
libraries, generators) without asking; it must run on the old tablet; a Settings switch for
anything that gets in the way.

The art director checked the palette per sea against the art bible (§8, §9) and asked for: the ring
the most neutral bed (the reference the others are heard against); palm rustle on a south shore
approach and Sunreach's lagoon calmer than the open sea; a glacier calving now and then near
icebergs, eiders and kittiwakes near Rimewick, ice creaks low and wooden, never horror; a lava hiss
at the steam vents and the rumble tied to the eruptions of [0178](0178-volcano-smoke-and-eruptions.md),
never a sustained drone; sheep near Fogwatch's turf, rain in the Stormbreak, Fogwatch's own foghorn
(only the far one in the fog generic); storms off mutes rain and thunder, ash off mutes the rumble;
one bell sound pitched per port (big towns lower, outposts a handbell, Skerry the smallest and
brightest); each sea's music still recognisably Fair Winds.

## Decision

**Everything synthesised in code**, like the music: no recordings to download, no paid sounds. A
recorded file stays possible for any sound (`file` instead of `synth`, as since
[0113](0113-levels-tutorial-and-music-as-data.md)).

**Effects** (`src/audio/sfx.ts`): eighteen small synthesisers (creak, foghorn, bell, flap, thud, horn,
gun, gull, quack, ice-groan, ice-ping, calving, boom, thunder, hiss, surf, rustle, baa), each a
handful of nodes for a few seconds over one shared noise buffer. Every effect line in `audio.json`
takes a `volume` and a `pitch`, so 24 effects come from 18 synthesisers: a gull pitched up is a tern
or a kittiwake, the foghorn lower is Fogwatch's own, the bell higher is a bell buoy, the thud higher
is a bump.

**A bed per sea** (`audio.json` › `seas`, one per sea id: `ring` and each sea file): waves (level,
filter tone, swell period) and wind (level, tone), the music track the sea plays, `calm` places
(Sunreach's lagoon: inside 0.7 of its radius the waves are 35 %), and **calls**: an effect every
`[min, max]` seconds, optionally only `near` a place (islands by id or any, icebergs, steam vents,
reefs, within a range, louder the closer), only `away` from one, or only `when` a storm blows. The
sea at a point is the ring inside the charted radius, else the sea whose sector of 0179 holds it.

**The boat's own sounds** (`boat`): her wash following her speed, the sails luffing in irons (a band
of noise chopped at `rate` a second, only with sail up in the no-go zone, never docked) and rain on
deck (the weather's rain at the boat, or a storm belt's squall).

**Events** (`events`): the dock bell at each port's and home island's `pitch`, the hull thud on a
crash or reef strike (louder the harder she hit), a soft bump, the flap as she tacks or gybes (the
wind crossing the bow or stern with sail up and way on, at most every 1.5 s), and the rumble when a
volcano erupts within `range` (the eruption itself, so smoke and sound agree; the Ash switch off
mutes it). Storms off already means no storm rain or thunder; the belt switch off, no squalls.

**Music**: one variation of Fair Winds per sea (`src/data/music/fair-winds-south|north|west|east.json`:
south brighter and quicker, north slow and modal with more echo, west lower and heavier, east
dorian and aeolian, warm) and `regatta.json`, quick and bright. The sea's theme takes over at the
next tune (about half a minute), so crossing a border never cuts a tune. A quest step's new `music`
field holds a track over the sea's while it runs, for the regatta (part 6); the quest builder edits
it and the quest checks check it.

**Settings**: a **Sounds** volume (default 70 %) under Music, for every effect and the bed; the
creak and the foghorn move from the music slider to it. Music, Sounds and Voices all at 0 suspend
the audio context as before.

**Tools**: the editors' **Sounds** page (editor.html › Sounds) edits all of `audio.json` but the
voices, with a play button on every sound, the sea beds played live with sliders for wind, speed
and rain and switches for luffing, docked, near and storm, the bells per port and the themes, the
checks, and Export. `npm run sound` renders the same sounds offline in Chromium with the same code
(`src/audio/desk.ts`) to MP3s: `effect`, `bell <port>`, `sea <id>` with the boat's state, `music`,
and `tour` (every sea, effect, bell and theme, the review set, ~18 s); `--file` plays a Sounds page
export. `npm run check` has an `audio` area.

**Cost**: the bed is about twenty Web Audio nodes built once (two noise sources, six filters, three
slow oscillators, gains) whatever the sea; the sea only moves their levels and filters, gliding over
a second or two. Calls add a few nodes for a second or two, a few times a minute. Measured in the
game: about nine nodes a second created (the music's notes as before, plus calls). No render cost.

## Consequences

- The sea has sound everywhere, and each sea its own, from data. A new sea needs one `seas` line;
  a new call, bell pitch or variation is data; only a new kind of synthesiser needs code.
- The regatta thread (part 6) plays `horn` and `gun` with a step's `sound` and sets `music: "regatta"`
  on its race steps. Hull damage (part 9) can reuse `thud`; other ships (part 4) can ring bells.
- The art director's level round (EBU R128 on every render): near foghorns to about -20 LUFS, the
  far one -27, the regatta horn -19, gulls and sheep up to about -31, terns and kittiwakes -35;
  rain on deck down so a squall sits about 5 dB over the bed (-29.6 against -34). Beds sit at -33
  to -35, bells at -25, the themes within 2 dB of each other. Nobody has listened yet: the
  levels were balanced by measuring the renders (peak and mean loudness) and by the spectra,
  not by ear: the first listen by the art director and Guillaume may move them, in the Sounds page
  or `audio.json`.
- Storybook, not recordings (Guillaume, 2026-10-25: some sounds were "chill like the theme", some
  "hyper realistic"; he liked the bells). The tonal sounds (bells, horns, birds, sheep) already
  matched the music; the noise ones were moved towards them: the waves lap (quick in, slow out)
  through two low-passes, the wind is a narrow soft whistle, the wash narrower, rain a soft patter,
  the lava hiss bubbles as little rising blips, surf and palms rounder. Levels re-measured to the
  same targets.
- On phones, low sounds were raised into the low mids (the rumble, as the foghorn in 0139).
- Second listen (Guillaume, 2026-10-25, 57 sounds: 50 OK, 7 KO). The creak, volcano rumble, eider,
  ice, calving, sheep and thunder did not sound like what they were. Each was rebuilt from what
  makes the real sound, two tries each, and he picked: the creak and the ice groan are stick-slip
  friction (a train of tiny clicks whose rate glides, rung through the wood's or the ice's
  resonances); the ice also pings now and then (sharp ringing snaps, a second north call);
  the duck quacks and the sheep baas through formant filters (the vowel's resonances); the volcano
  is one deep boom, the thunder a far roll and the calving a far splitting groan, with ragged
  loudness and a soft saturator so phones hear the low end. Measured: creak -27, boom -22, quack
  and baa -32, ice groan -36 and ping -32, calving -33, thunder -30 LUFS.
