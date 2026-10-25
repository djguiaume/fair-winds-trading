# Selling Fair Winds Trading on Android, iPhone and Xbox

Costed plan, researched 2026-10-25 for Guillaume (decision [0204](../decisions/0204-selling-on-android-iphone-and-xbox.md), Proposed).
**Parked (Guillaume 2026-10-25): "We are not doing it now."** Kept here for when store sales come up again.
Fees and rules were checked on the stores' own pages where possible (sources at the end); where only
second-hand reports exist, this says so.

## The short answer

| | Android (Google Play) | iPhone and iPad (App Store) | Xbox (console store) |
| --- | --- | --- | --- |
| How the game ships | The same web build inside a native shell (Capacitor) | The same, with Capacitor | Only route that runs a web game on the console: a UWP app with WebView2. Microsoft's newer GDK has no web view |
| Sign-up cost | $25 once | $99 a year | Partner Center free for individuals; ID@Xbox free (dev kits free once a concept is approved) |
| Store cut | 15% on the first $1M a year | 15% with the Small Business Program (EU rules changed 1 Oct 2026, see below) | Console sales usually 30% (from memory, confirm in the contract); PC games on the Microsoft Store 12% |
| Needs a Mac? | No | No: built on GitHub Actions macOS runners, free because the repo is public | No (a Windows runner or PC builds the package) |
| Agent work | ~1 week | ~1–2 weeks (signing on CI is the fiddly part) | 2–4 weeks **if** Microsoft still takes a UWP game; otherwise months (rewrite) |
| Waiting on others | 14-day closed test with 12 testers, then review | TestFlight + review (usually 1–3 days) | Microsoft's answer and concept review (10–15 business days), then certification |
| Risk | Low | Low to medium | **High**: the self-publishing path is unclear today |

**Minimum spend in the first year: about $124** (Google $25 + Apple $99). Everything else in this plan
has a free option. Optional costs (a cheap test phone, a business address) are listed under
[Costs](#costs). No money is spent until Guillaume says yes to a figure.

**Recommendation:** do Android first, then iPhone (same shell, same work), and in parallel ask
ID@Xbox in writing whether a UWP + WebView2 game can still ship on the console. Decide Xbox on their
answer. Meanwhile the game already plays in the Xbox browser for free (decision 0183).

## What is already done

The web game already covers most of what a store app needs:

- **Installable app (0039):** manifest, round and maskable icons, a 180 px Apple icon, offline start
  (service worker). The store shells reuse these icons.
- **Small, offline build:** `vite build` is about 3.2 MB, with no outside servers (fonts and sounds are
  in the build or synthesised). An app needs no network at all.
- **Touch and desktop from day one (0006)**, landscape first and good in portrait; notch insets
  through `--safe-*`.
- **Game controller everywhere (0162, 0163, 0183, 0192, 0199, 0201, 0203):** sailing, chart, menus,
  cards and port screen. That is the hardest part of a console port, and it is done.
- **TV mode (0183):** 5% TV safe margin, Back stays in the game, Edge's pad mode.
- **Saves through one door:** `src/sim/save.ts` takes a `SaveStorage` (getItem/setItem/removeItem),
  so the app can swap browser storage for native storage in one place. Autosave already runs on
  `pagehide` and `visibilitychange`.
- **Moving a voyage between devices (0066, 0118):** the FW2 code and QR link, under 1,000 characters.
  On phones this is a manual "cloud save" already.
- **Performance tools (0115–0117, 0148, 0154):** quality levels, `?perf`, the automatic `?bench`.
  Charlotte's 2 GB Android tablet ran about 35 fps on Low.
- **English and French texts** (`src/i18n`), which the store listings can reuse.
- **No data collected:** no analytics, no accounts, no ads. The privacy forms are the simplest kind.

## Shared work, before any store (about 1 week)

1. **An app build target.** `npm run build:app` (a Vite mode) with relative paths, no service worker
   (the shell serves files locally; a worker only gets in the way of updates), and no dev-only
   switches (`?map=`, `?tune`, editor links). The Pages build stays as it is.
2. **Native saves.** A `SaveStorage` backed by Capacitor Preferences (Android SharedPreferences, iOS
   UserDefaults), used for the voyage and for settings (`src/ui/settings.ts` also writes
   localStorage). Reason: iOS may clear a web view's storage when the phone is short of space,
   and native storage is backed up by the phone's own backup (Android Auto Backup, iCloud backup).
   On first launch, copy an existing browser save across.
3. **App lifecycle.** Save when the app goes to the background (Capacitor `App` pause event, as
   `pagehide` does not always fire in a shell), resume audio on return, and keep the screen awake
   while sailing (Keep Awake plugin).
4. **Android Back button** maps to the game's own Back: close a card or panel, open pause, and only
   leave from the title menu.
5. **Fullscreen**: hide the status and navigation bars (immersive mode), keep both orientations.
6. **Store pages content**: a privacy policy and support page on Pages (en + fr), store texts in
   English and French, and screenshots from `npm run shots` at the store sizes (phone, 7" and 10"
   tablet, 6.9" iPhone, 13" iPad). Feature graphic 1024 × 500 for Google.
7. **Payment choice** (Guillaume's call, see [Payments](#payments-and-pricing)).
8. **A `LICENSE`.** The repo is public with no licence. Before selling, add "all rights reserved"
   for code and art (or decide to make the repo private, which makes iOS builds cost money, see
   below). A public repo means anyone can build the game, which is fine for a free web version but
   worth knowing.

## Android (Google Play)

**Path:** Capacitor wraps `dist/` in an Android project. Android's web view is Chrome, so WebGL,
three.js, the Gamepad API and audio behave like Chrome on the same phone.

Work items:

1. Add Capacitor and the `android/` project; app id like `com.fairwinds.trading` (cannot change later).
2. Icons and splash from the existing art (`@capacitor/assets`).
3. A GitHub Actions job on a Linux runner (free) that builds a signed release bundle (`.aab`);
   the upload key lives in GitHub secrets; Google keeps the app signing key (Play App Signing).
4. Target a recent Android API level (Google raises the minimum every August; check the current
   one when the project is created).
5. Test on the old tablet and one cheap phone with `?bench` built in (see Performance).
6. Play Console forms: content rating (IARC questionnaire, likely PEGI 3 / Everyone), Data safety
   ("no data collected"), target audience (not aimed at children, to avoid the Families policy),
   ads: none.
7. **Closed test:** a new personal developer account must run a closed test with **at least 12
   testers opted in for 14 days in a row** before it can publish. Friends and family on Android
   count; plan the 14 days into the timeline.
8. Production release, then updates through the same CI job.

Costs: **$25 once.** Google verifies identity (government ID) when the account is opened.

Store cut: **15% on the first $1M of earnings each year**, 30% above. In the US, UK and EEA Google
moved to a new split on 30 June 2026 (10% service fee + 5% billing fee on the first $1M), which
still adds up to 15%.

## iPhone and iPad (App Store), without a Mac

**Path:** the same Capacitor project gets an `ios/` folder. iOS's web view (WKWebView) is Safari's
engine, so WebGL 2 and three.js run as in Safari on that device.

**Building without a Mac:** Xcode only runs on macOS, but nobody needs to own one:

| Option | Cost | Notes |
| --- | --- | --- |
| **GitHub Actions macOS runner (recommended)** | **Free** for a public repo | Builds, signs with an App Store Connect API key, uploads to TestFlight. A build takes roughly 10–15 minutes |
| GitHub Actions, if the repo goes private | About $0.06 per macOS minute, so around $1 per build | Same workflow |
| Codemagic | Free tier: 500 macOS minutes a month, then about $0.10 a minute | Made for mobile; handles signing for you. A good fallback |
| Rented cloud Mac (MacinCloud and similar) | Roughly $25–50 a month (from memory, check before buying) | Only needed for hands-on debugging in Xcode; not planned |

Signing certificates and provisioning profiles can be created from App Store Connect's web site or
API, so they also need no Mac (fastlane `match` or Codemagic's automatic signing).

Work items:

1. Add the `ios/` project (Capacitor uses Swift Package Manager, so no CocoaPods step).
2. A GitHub Actions workflow on `macos-latest`: build, archive, sign, upload to TestFlight.
3. Apple Developer Program sign-up ($99/year) and an App Store Connect API key in GitHub secrets.
4. Test through **TestFlight on a real iPhone or iPad.** Open question: does Guillaume (or someone
   close) have one? Without a Mac, Safari's remote debugger is not available, so the in-game
   `?perf` readout and `?padlog` are the debugging tools; testing the Pages site in iOS Safari
   first catches most problems, since it is the same engine.
5. Audio unlock on first touch and the silent switch (already needed for Safari).
6. App Store Connect: age rating questionnaire, App Privacy ("Data not collected"), export compliance
   (only standard encryption: set `ITSAppUsesNonExemptEncryption` to false), screenshots for the
   6.9" iPhone and, if the iPad is supported, the 13" iPad.
7. App Review: a full offline game passes guideline 4.2 ("not just a website") without trouble.
   Review usually takes 1–3 days.

Costs: **$99 a year** (Apple Developer Program, individual). CI free.

Store cut: **15%** with the App Store Small Business Program (under $1M a year; you apply once).
In the EU Apple's terms changed on **1 October 2026** after the European Commission case (for
example 26% standard for App Store payments, 10% for small businesses using other payment options);
check the small-business rate on the App Store payment path when signing up. Outside the EU the 15%
stands.

**EU trader status:** Apple (under the EU Digital Services Act) requires anyone selling to say they
are a trader, and then shows an **address, phone number and email on the store page** in the EU.
Google shows a contact address for paid apps too. If Guillaume does not want his home address on
the page, a business domiciliation address costs roughly €15–30 a month in France (estimate).

## Xbox

This is where the real uncertainty is.

**The technical fact:** a web game runs on the console only inside a **UWP app with WebView2**. That
is how Construct, the main web-game engine, exports to Xbox. Microsoft's current console toolkit, the
**GDK, has no web view**, and a Microsoft engineer said in November 2023 there were no plans to add
one; nothing newer contradicts that.

**The publishing fact:** small developers used to publish UWP games through the **Xbox Creators
Program** (no concept approval). In 2025 reports from developers say new UWP game submissions are
blocked, at least for accounts that also joined ID@Xbox, and a Microsoft staff member wrote of "the
Creators Program was" while a new self-service path is being looked at. Microsoft has not published
a clear rule. **ID@Xbox** (free; NDA, then a concept review of 10–15 business days; approved concepts
get dev kits free and sign a title licence) is built around the GDK.

So the paths are:

| Path | Work | Verdict |
| --- | --- | --- |
| **A. UWP + WebView2 app, published through ID@Xbox or what replaces the Creators Program** | 2–4 weeks: a small UWP host app around `dist/`, Xbox sign-in and saves if certification asks for them, suspend and resume, certification fixes. The controller, TV margin and pad mode are already done | **Best, if Microsoft says yes.** Ask first, it costs nothing |
| B. Native GDK build | Rewrite the game in an engine with a GDK export (Godot, Unity, Unreal), or embed our own JavaScript engine with WebGL on DirectX: months of work, and a second codebase | Not recommended |
| C. Keep playing in the Xbox browser, sell elsewhere | Nothing new: it works today (0183). Sell on phones, and on Windows PC via the Microsoft Store (12%, the same UWP or a desktop package) or Steam | The fallback |

**If Microsoft says no to UWP** (Guillaume asked, 2026-10-25), in order of preference:

1. **Xbox on PC first:** a Windows desktop package (MSIX) hosting WebView2 on the Microsoft Store
   is allowed, takes 12%, and shows in the Xbox app on Windows PCs and on Xbox-branded handhelds
   (ROG Xbox Ally). About 1–2 weeks, and the console stays on the browser version.
2. **Sell the unlock on the web, play in the Xbox browser:** sell through itch.io (or similar) and
   let the web game open the full voyage with a key. The browser game already plays on the console
   (0183). Weak points: typing a key with a pad (no camera for the QR), and a key check without a
   server can be shared. Fits the free web demo above.
3. **Wait for Microsoft's new self-service path:** a Microsoft staff member said in August 2025 a
   team is working on what replaces the Creators Program. Costs nothing; no date.
4. **A real console port with the GDK:** either a porting studio that runs web games on consoles
   with its own runtime (typically paid per platform, quote needed, likely thousands of euros), or
   rewriting the game in an engine with console export (Godot through W4 Games, Unity), which means
   a second codebase and months of work. The data files (seas, islands, quests, goods) could be
   reused; the renderer, the sim code and the UI could not. Only worth it if the phone sales show
   the demand.

Work items for path A:

1. Open a Partner Center developer account (free for individuals since September 2025; confirm that
   games are covered) and activate **Developer Mode on Guillaume's own Xbox** (free with that
   account). This lets us sideload and test a UWP build on his console before any approval.
2. Apply to ID@Xbox with a concept (screenshots and the art bible are ready) and ask in writing:
   "Can a UWP title hosting WebView2 still ship on Xbox Series X|S, and through which program?"
3. If yes: a UWP host (C# or C++, based on Microsoft's WebView2 sample), built on a GitHub
   Windows runner; saves in the app's local folder (or Xbox connected storage if required); save on
   suspend; the Xbox requirements checklist (sign-in, achievements if required for ID titles,
   1080p/4K output, no-controller and controller-lost screens, TV safe area).
4. Certification, then release.

Costs: **$0 in fees** as far as the research shows. Console store cut: expect 30% (from memory; the
ID@Xbox contract gives the real figure).

## Saves and cloud saves

- **Version 1: local only, on every platform**, in native storage (see shared work 2). The phone's own
  backup keeps it when the phone is replaced. The FW2 code / QR (0066, 0118) already moves a voyage
  between any two devices with a camera.
- **Later, per platform, if wanted:** iCloud key-value storage on iPhone (1 MB per app, plenty for
  an FW2 code), Google Play Games saved games on Android (needs Play Games sign-in), connected storage
  on Xbox. Each is a plugin and one more privacy line.
- **Across platforms** (phone to Xbox) needs our own server and sign-in, the backend question the
  roadmap already parks for leaderboards (Phase 7). Not part of this plan.

## Performance on weak phones

- The app runs the same renderer as the browser, so today's numbers hold: Charlotte's 2 GB tablet
  about 35 fps on Low, GPU-pixel bound (0116, 0154).
- Add before release: run the quick `?bench` on first launch and pick the quality level from it;
  a 30 fps cap option (saves battery and heat on phones); render scale below 1 on Low for small
  GPUs.
- Test devices: the old tablet, one cheap current Android phone (about €100–150, optional purchase),
  and one iPhone or iPad through TestFlight.
- Google Play's pre-launch report (free) runs the app on real devices and flags crashes.

## Payments and pricing

All three stores take the payment, so no payment system of our own. Options:

| Model | Work | Notes |
| --- | --- | --- |
| **Paid up front** (for example €4.99) | None in the game | Simplest; stores handle VAT and refunds. Recommended to start |
| Free download + one in-app "unlock the full voyage" | A billing plugin per store, a restore-purchases button (Apple requires it), a demo cut-off point in the story | More downloads, more work and testing |
| Ads or subscriptions | Ad SDKs mean data collection and consent forms | Not recommended for this game |

**The web version:** today the full game is free on GitHub Pages. If it stays fully free, few
players will pay for the app.

**Recommendation (2026-10-25, Guillaume's question "what price, should the web stay free?"):**

- **Price: €4.99 / $4.99 once on the phones**, no ads, no in-app purchases; €3.99 for launch week.
  Premium indie games on phones mostly sit between $2.99 and $6.99, and the story is about 3–4 hours
  for a real player plus open-ended trading. On Xbox, $7.99–9.99 is usual.
- **Web: a free demo, not the whole game.** The story already has a clean cut: the four Phase 4
  seas open after `watchman-passage` (decision 0194). The free web build would be the ring, Skerry
  and the ring arcs; the four seas come with the app. The Xbox browser version becomes the free
  trial there too. The storyteller checks the closing card at the cut before it is built.
- **The repo goes private before charging**, since anyone can build the full game from public
  code. iOS builds then move to Codemagic's free tier (500 macOS minutes a month is enough) or
  GitHub's paid macOS minutes (about $1 a build).

## Legal and admin (France)

- **Selling as a person:** in France that means registering as a micro-entrepreneur (free, on the
  URSSAF / guichet unique site) and declaring the revenue. The stores sell to players on Guillaume's
  behalf and handle sales VAT in most countries. Ask an accountant if revenue grows.
- **Privacy:** a privacy policy URL is required by all three stores even when no data is collected.
  With no analytics, no account and no ads, the forms say "no data collected" and GDPR asks for
  nothing more. Adding cloud saves, crash reporting or ads changes that.
- **Age ratings:** IARC questionnaire (Google, Microsoft), Apple's own; expect PEGI 3 / Everyone / 4+.
- **Trader contact details** shown publicly in the EU (see the iPhone section).
- **Fonts and sounds:** Barlow is under the SIL Open Font License, fine for a paid game; sounds and
  music are synthesised in code.

## Timeline

Agent work, with Guillaume's waits shown separately. Weeks from the go-ahead:

| Week | Work |
| --- | --- |
| 1 | Shared work: app build, native saves, lifecycle, Back button, privacy page, store texts. Google and Apple sign-ups (Guillaume, ID checks). ID@Xbox application and question sent |
| 2 | Android build on CI, closed test starts (12 testers, 14 days). iOS CI and first TestFlight build |
| 3 | Fixes from testers on both phones; performance pass; store screenshots |
| 4 | Android closed test ends → production review. iPhone review → release |
| 4–6 | Xbox: Microsoft's answer and concept review. If path A: 2–4 weeks of work and certification after that |

So **Android and iPhone could be live about a month after the go-ahead**, mostly waiting on the
14-day test. Xbox depends entirely on Microsoft's answer.

## Costs

| Item | Cost | Needed? |
| --- | --- | --- |
| Google Play developer account | $25 once | Yes |
| Apple Developer Program | $99 a year | Yes |
| Microsoft Partner Center (individual) | Free | For Xbox or Windows |
| ID@Xbox and dev kits | Free | For Xbox |
| Builds (GitHub Actions, public repo) | Free | Yes |
| Codemagic | Free tier | Only as fallback |
| Cheap Android test phone | about €100–150 | Optional |
| iPhone or iPad for testing (if none at hand) | about €150–300 used | Probably, unless someone lends one |
| Business domiciliation address | about €15–30 a month | Optional, to keep the home address off the store page |
| Micro-entreprise registration | Free | Yes, to sell in France |

Store cuts, on each sale: Google 15%, Apple 15% (Small Business Program; EU rates differ since
1 Oct 2026), Xbox console probably 30%, Microsoft Store PC games 12%.

## Open questions for Guillaume

1. Go ahead with Android + iPhone first, and send the ID@Xbox question now?
2. Price and web demo: recommendation above (€4.99 once; free web demo up to the four seas; repo private).
3. Is there an iPhone or iPad to test on?
4. Home address on the store pages, or a domiciliation address?
5. Add an "all rights reserved" licence to the repo before selling (recommended), or make it private?

## Sources

- Google Play service fees: <https://support.google.com/googleplay/android-developer/answer/112622>
- Google Play testing requirement for new personal accounts: <https://support.google.com/googleplay/android-developer/answer/14151465>
- Apple EU changes, 1 Oct 2026: <https://gameworldobserver.com/2026/08/19/apple-will-reduce-the-app-store-commission-in-the-eu-to-resolve-disagreements-with-the-european-commission>
- Apple EU DSA trader information: <https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-compliance-information/>
- iOS CI options and prices (June 2026, vendor article): <https://capawesome.io/docs/blog/comparing-ci-cd-platforms-for-ios-apps/>
- Microsoft Store free registration for individuals (Sept 2025): <https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/>
- WebView2 not in the GDK: <https://github.com/MicrosoftEdge/WebView2Feedback/discussions/4149>
- Construct's UWP + WebView2 Xbox export: <https://www.construct.net/en/blogs/ashleys-blog-2/construct-xbox-support-update-1875>
- Creators Program status reports (2025): <https://discussions.unity.com/t/has-microsoft-ended-the-xbox-creators-program/933969?page=3>
- ID@Xbox registration steps and timings: <https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/tutorials/pc-e2e-guide/e2e-register-id-at-xbox>
- Xbox Developer Mode on a retail console: <https://learn.microsoft.com/windows/uwp/xbox-apps/devkit-activation>
- Xbox dev kit prices, free for ID@Xbox: <https://www.tweaktown.com/news/108399/microsoft-raises-prices-of-xbox-devkits-by-dollars500-id-at-xbox-members-still-get-free-xdks/index.html>
- Microsoft Store 12% on PC games (2021): <https://www.hothardware.com/news/microsoft-reduces-its-cut-from-pc-game-sales-in-microsoft-store-to-only-12-percent>
