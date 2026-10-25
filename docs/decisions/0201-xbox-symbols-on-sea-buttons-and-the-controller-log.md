# 0201. Xbox symbols on sea buttons and the controller log

- Status: Accepted
- Date: 2026-10-25

## Context

Decision 0199 put the pad's buttons on the sea's own buttons. On the Xbox, Guillaume found two of
them ugly: the menu button had a "MENU" pill on its corner, and the Map button an "AFFICHAGE"
(View) pill before its icon. The glyphs were the buttons' names, not what is printed on the pad.
The menu button's ☰ icon already is the Menu button's symbol.

He also found the pause menu still often has no focus on the Xbox (the port screen now works).
Every case a desktop browser can run works: the Menu button through the Gamepad API, its key
("GamepadMenu") before or after the API, a click on the menu button, then the D-pad as arrow keys.
What Edge on Xbox sends differs, and only the console shows it.

## Decision

- The menu button gets no pad glyph.
- The Map button shows the View button's printed symbol (two overlapping windows) **in place of**
  its map icon while the pad is in use (`padSymbol` in `src/ui/padGlyphs.ts`). On a PlayStation or
  Switch pad, which print other symbols, the button's name shows instead ("Create", "−").
- A, B, X, Y and the bumpers keep their glyphs (round coloured letters, grey pills).
- `?padlog` shows a small on-screen log of what the controller sends: each key, pointer event,
  Gamepad API press, window focus change, and where the focus went after it
  (`src/ui/padLog.ts`). A photo of it from the Xbox tells what Edge really sends when the pause
  menu has no focus. `npm run shots -- --query padlog` turns it on in screenshots.

## Consequences

- At sea on a pad the bottom-left buttons read ☰ and "⧉ MAP", like a console game's.
- The pause-menu focus is fixed once the log shows what differs on the Xbox.
