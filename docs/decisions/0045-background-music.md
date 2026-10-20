# 0045. Background music: "Fair Winds", composed in code

**Status:** Implementation for review, 2026-10-20. Guillaume picked the theme after two listening rounds.

**Context:** Guillaume asked to start on sound, background music first, and to hear three proposals before anything was committed. The game must stay light on old phones and tablets ([0006](0006-desktop-and-mobile.md)), assets are built in code for now (no paid generation services without asking first), and the game is played in long, calm sailing sessions ([0009](0009-sandbox-short-sessions.md)), so the music must not wear thin.

**Options heard (2026-10-20):**

- Round 1, three styles: *Fair Winds* (sea-folk air on a flute over soft chords, 6/8), *Open Water* (calm bells over long pads) and *Harbour Jig* (brisk squeezebox jig with oom-pah bass). Guillaume liked Fair Winds best but found it crowded: too much happening at once.
- Round 2, three lighter takes on Fair Winds: *Solo* (flute and one bass note), *Duet* (flute and picked guitar) and *Light band* (the original band, thinned). **Guillaume picked Light band.**
- The six samples are in the project files (`audio/music-proposals/`); the chosen one is in [docs/audio/fair-winds-sample.mp3](../audio/fair-winds-sample.mp3).

**Decision:**

- **Generated in code, live, with Web Audio.** No audio files ship with the game, nothing to license or download, and no paid service. `src/audio/composer.ts` writes a tune from a seed; `src/audio/synth.ts` plays it; `src/audio/music.ts` schedules it a bar at a time, 1.5 s ahead.
- **The theme, "Fair Winds" (light band):** a sea-folk air in a lilting 6/8 at 84 to 92 dotted-quarter beats a minute, in D or G major or D or A dorian. A flute (triangle wave with vibrato and a light echo) carries the tune over quiet three-note chords and one bass note per bar. The melody uses long notes and leaves an occasional gap.
- **Never the same twice:** each tune is 16 bars in AABB form (each phrase played twice, first ending open, then home on the tonic) followed by 4 bars of chords alone, about 30 seconds in all; then a new tune from the next seed, often in another key.
- **Cheap:** one oscillator per note (about a dozen at once), shared filters, vibrato and echo. Muted music suspends the audio context entirely, and so does a hidden tab.
- **Starts on the first tap or key press**, as browsers require; it plays on the title menu from then on.
- **Settings:** a *Music* volume slider (0 = off), default 60 %, saved with the other settings. Translated (Music / Musique).

**Consequences:**

- Tweaking the music means editing `THEME` in `src/audio/composer.ts` (tempo, keys, rhythms, gaps, chord level, echo) or the instrument envelopes in `src/audio/synth.ts`. The composer is pure and tested (`tests/music.test.ts`).
- The same composer and synth can render previews offline (`OfflineAudioContext`), which is how the samples were made.
- Still to come on the roadmap: port music (the jig from round 1 is a candidate), sound effects (waves, creaks, sails, crashes) and possibly music that follows the wind. The settings panel will likely move with the UI redesign; the slider then moves with it.
