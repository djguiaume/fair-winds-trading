# Editing the game's text

All player text lives in one JSON file per language ([0107](../decisions/0107-text-in-json-files.md)):

- [`src/i18n/en.json`](../../src/i18n/en.json): English, the source of truth.
- [`src/i18n/fr.json`](../../src/i18n/fr.json): French.

Each line is `"key": "text"`. To change wording, edit the text on the right and leave the key
alone. You can do it straight on GitHub (open the file, pencil icon, commit to a new branch, open
a pull request); CI checks the result.

## Rules the checks enforce

- **Same keys in every file.** A key added to `en.json` must be added to `fr.json` too, and the
  other way round. The build fails otherwise.
- **Same placeholders.** `{name}`, `{price}` and the like are filled in by the game. Keep every
  placeholder of the English line, spelled the same, in the translation. You can move it.
- **No empty text.**
- **French spacing.** Put a non-breaking space (U+00A0) before `! ? : ; %`, as in decision
  [0091](../decisions/0091-translation-quality-pass.md).

## Good to know

- Keys are grouped by their prefix: `menu.`, `settings.`, `hud.`, `chart.`, `tutorial.`,
  `port.`, `kids.` and so on. Shared names come first: `good.` (a good's name), `goodThe.` /
  `goodSome.` (with its article inside a sentence), `ship.` and `shipThe.`.
- A few lines contain simple markup such as `<b>…</b>`; keep the tags balanced.
- Place names (Saltmere, Port Calda…) are not translated and live in the map data.
- Adding a language: copy `fr.json`, translate it, then ask for the one line of code that adds it
  to the language menu (`LANGUAGES` in `src/i18n/index.ts`).
