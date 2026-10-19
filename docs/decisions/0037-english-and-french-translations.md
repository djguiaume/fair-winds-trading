# 0037. English and French, with a light translation layer

**Status:** Implementation for review · 2026-10-19

## Context

Guillaume asked for the whole game in French, built so that more languages can follow, with a way
to change language from the main menu ("flags? text?"). Until now every string was written inline
in `index.html` and the UI code (menu, HUD, chart, harbour, Kids mode, tutorial). A UI redesign is
planned later, so the strings should be easy to find and move.

## Decision

1. **A small in-repo layer, no library** (`src/i18n/`): one dictionary per language, `en.ts` is
   the source of truth and `fr.ts` must define exactly the same keys (TypeScript fails the build
   otherwise, and a test checks that every `{placeholder}` matches). `t('key', { name })` looks a
   string up; `goodName` and `shipName` name goods and ship classes; `formatNumber` uses the
   language's number format (`1,5 nd` in French). Static markup in `index.html` carries
   `data-i18n` / `data-i18n-html` / `data-i18n-attr` attributes that `translateDom()` fills at
   start-up. The whole layer is under 4 KB of code; i18next and similar would add weight and
   features (plural engines, lazy loading) the game does not need yet.
2. **Everything the player reads is translated**: main menu, how to play, settings, HUD and
   toasts, wind tips, port signs, sea chart and price board (decision 0036), the harbour in Captain
   and Kids modes (Kids mode uses "tu", Captain mode "vous"), and the first-voyage tutorial.
   **Port and island names stay as they are** (Saltmere, Westholm…): they are place names. The
   sloop stays "Sloop", the cutter becomes "Cotre"; goods are Poisson, Céréales, Bois, Pierre.
3. **Which language**: the player's saved choice (`language` in the settings, `null` = automatic),
   else the first supported language of the browser (`fr-CA` → French), else English.
4. **Switcher in the main menu**: a row of buttons naming each language in its own words
   ("English", "Français") under a 🌐 icon, the current one highlighted. **No flags**: a flag is a
   country, not a language (French is spoken in Canada, Belgium, Switzerland…; English in many
   places), and Windows does not draw flag emoji at all. Choosing a language saves the voyage and
   reloads the page, so every panel is rebuilt in the new language with no stale text.

## Consequences

- Adding a language is one file (copy `fr.ts`, translate) and one line in `LANGUAGES`; the
  switcher shows it automatically. Languages with longer words (German) may need wider buttons.
- Every new UI string must go through `t()` with an English entry, plus the French one, or the
  build fails. Tests keep running in English by default.
- Plurals are avoided by wording ("Encore 7 requis") rather than handled by an engine; if a
  language needs real plural forms later, add a `count`-aware helper then.
- Chart marker ids stay English in storage ("Marker 2") so saved markers keep working; only the
  displayed name is translated.
- The page `<title>` and link-preview description stay in English for now (they are read before
  the game picks a language).
