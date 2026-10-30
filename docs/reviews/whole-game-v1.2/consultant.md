# An outside view: identity, length, engine, platform, audience, money (2026-10-30)

Part of the [whole-game review](README.md). Guillaume asked (2026-10-30) for "a real review by an
external consultant": does the game have a strong enough identity, is it too long or too short, is
it on the right engine, does it target the right platform, who is it for, are extensions needed,
can it make money. This page answers those as someone who has not built it would. Figures marked
*estimate* are judgement, not measurement.

## The verdict in five lines

1. **The identity is real but not yet visible.** "Cozy trading where the wind is real" is a rare
   promise; the store page, the first minute and the name do not say it yet.
2. **The length is right for a phone and short for a PC.** Fix it with depth in the seas you have,
   not with a new map.
3. **The engine is right.** Stay on three.js. Only a Nintendo Switch port would ever argue for a
   rewrite.
4. **The platform order should change:** Steam on PC first (with a free web demo), phones second,
   Xbox last.
5. **It can earn a modest income, not a living**, and only after a licence decision: today the full
   game is public and free on GitHub Pages.

## 1. Identity: is it strong enough?

**What is distinctive.** Very few cozy games make sailing a skill. Here the no-go zone, tacking,
the lee of an island, currents and shallows are the game, and the numbers a sailor wants (knots,
point of sail) are always on screen. Add trade that grows towns, a warm cast of 15, no villains, no
fail state. That combination is the hook, and it is defensible: action sailing games (*Sea of
Thieves*, *Skull and Bones*) are about fighting, sailing sims (*Sailwind*) are hard and lonely, and
cozy sea games (*Sail Forth*, *Dredge*'s calm side, *A Short Hike*'s boat) treat the wind as
scenery.

**What is weak.**

- **The look is a common one.** Bright low-poly islands are what many indie sea games use; the
  closest comparable, *Sail Forth*, looks similar. v2 (smooth ground, depth-blue water, forests)
  moves it toward its own look, which is one more reason to land it.
- **The name says trade, not sailing.** "Fair Winds Trading Co." reads as a spreadsheet game. Keep
  it, but every subtitle, trailer line and store capsule should lead with the sailing ("Read the
  wind" already sits under the title; make that the tagline everywhere).
- **There is no signature moment** a stranger remembers or films. Candidates the game already has:
  the first clean tack through the reef gap, the Teeth light coming on at dusk, crossing the
  Stormbreak in a lull. Pick one, make it the trailer's first five seconds and the tutorial's
  payoff.
- **The UI changed direction three times** (instrument D, style E, the #345 study). A brand needs
  one stable face; see the main review, section 3.

**Advice:** write one sentence of positioning and test every feature against it. Suggested: *"A
cozy sailing game where the wind is real: tack between islands, carry what people need, and watch
the towns grow."*

## 2. Length: too long or too short?

| Measure | Value |
|---|---|
| Story, real player | about 3 to 4 hours (bots: 1 h 15 to 2 h 30) |
| Races, standing orders, the Cup | a few more hours for those who like them |
| Tutorial | 16 steps; the first 15 minutes have not been tested on a stranger |

- **For a €4.99 phone game, this is right.** For a PC game at €10 to 15, players expect about 6 to
  10 hours (*estimate*, from reviews of comparable cozy titles), and the late game has no shape after
  four-winds.
- **The danger is the first two hours, not the last.** Steam refunds anything played under two
  hours. The game must have its signature moment, its first plot on Skerry and a sea in view inside
  that window.
- **Lengthen by depth, not distance:** a hazard step per sea, cross-sea asks for the far goods, a
  chapter after four-winds ([quests.md](quests.md)). That adds 2 to 3 hours (*estimate*) of the play
  people already like, with data only.

## 3. Engine: is three.js right?

**Yes.** The game is three.js, TypeScript and Vite. The game's main script is about 270 KB
gzipped and the whole build, editors included, is 4 MB. It runs in any browser, installs as an app,
plays on the Xbox browser today, and the agent tools and CI depend on it being plain web code.

| Target | Path from this engine | Risk |
|---|---|---|
| Web demo | as today (GitHub Pages or itch.io) | none |
| Steam, Steam Deck | a desktop wrapper (Electron or Tauri) | low; Deck needs a controller check, already done |
| Android, iPhone | Capacitor (plan 0204) | low to medium; iOS built on CI, no Mac |
| Xbox store | UWP with WebView2 | high; Microsoft's path is unclear (0204) |
| Switch, PlayStation | no web view: a native port | very high; would mean another engine |

A move to Godot or Unity would cost months of rewrite and the data and tool chain built since
Phase 1, to gain only consoles this game does not need first. Re-open the question only if a
console publisher asks.

## 4. Platform: the right target?

The parked store plan ([0204](../../decisions/0204-selling-on-android-iphone-and-xbox.md)) goes phones
first at €4.99. An outside view would change the order:

1. **Steam first, with a free web demo.** Paid premium games without ads sell best on Steam;
   on the phone stores they are hard to find, and most phone revenue is free-to-play (*estimate*,
   the common view of the market). Steam gives wishlists, a demo festival (Next Fest), Steam Deck
   and the cozy-game audience in one place. The web demo up to the four seas (0204's idea) becomes
   the Steam demo too.
2. **Phones second**, the same game at €4.99, once the Steam page shows there is an audience.
   Landscape-first and touch already work.
3. **Xbox last**, only when Microsoft's path is clear.

## 5. Who is it for?

Two groups that overlap:

- **Cozy-game players** who like the sea: the larger group. They want calm, collection, decoration,
  characters and a home that grows. Skerry, the towns and v1.4's boat cosmetics serve them.
- **Sailors**: a smaller group, but they spread the word (sailing clubs, forums, sailing YouTube
  channels). They want the wind to be honest and the numbers on screen. They will notice if the
  ocean waves of v1.3 lie about the wind.

The marketing should talk to cozy players and earn the sailors' respect. Kids and families are a
third group the voice already fits; Kids mode stays shelved, which is fine.

## 6. Are extensions needed?

**Not before launch.** The base game is finished; the next money is better spent on depth in the
four seas, the first two hours, and the store build. An extension only makes sense after sales
show people want more. When it comes, the shape on file is the right one: one new sea past the
Stormbreak, with its own story, sold once. Pirates in that sea would pull against the identity
above; keep them as the storyteller's rovers or leave them out.

## 7. Can it make money?

**Yes, modestly, and only if three things happen first.**

1. **Decide the licence.** The repository is public, has no `LICENSE` file, and GitHub Pages
   serves the whole game for free. Before charging: make the repository private (or publish the
   code under a licence that keeps the art and content yours), and cut the Pages build down to the
   demo.
2. **Pick the model.** Paid once, no ads, no in-app purchases (0204's advice, which holds). A
   small "supporter pack" (a sail colour and a flag) can come later on Steam. Avoid free-to-play: no
   server, a kid-safe voice and no fail state do not suit it.
3. **Build an audience before the release.** A Steam page with a trailer, at least a few thousand
   wishlists before launch (*estimate*; the commonly quoted range for visibility is 5,000 to
   10,000), a demo in a Next Fest, short clips of the signature moment.

**Realistic range (*estimate*).** Most small Steam games earn under a few thousand euros; a polished
cozy game with a clear hook and a demo can reach low tens of thousands in its first year. At €12 on
Steam, 2,000 sales is about €17,000 before Valve's 30% and taxes. It is a good side income and a
portfolio piece, not a salary. Costs are small: Steam's $100 fee, Google's $25, Apple's $99 a year,
a test phone (0204 lists them). No spending happens without Guillaume's yes.

## 8. What an outside consultant would add

- **Playtest with strangers now.** Nobody but Guillaume and the bots has played it. Five people who
  have never seen it, recorded, playing the first 30 minutes, will find more than any review.
- **Localise more.** All text is data (EN and FR today). German, Spanish, Brazilian Portuguese and
  Simplified Chinese reach most of Steam's buyers; it is translation work, not code.
- **Check the name** for trademarks and store clashes before a Steam page goes up.
- **Keep the build count low before launch.** With no players yet, version numbers do not matter;
  what matters is what the first store build contains.
