# 0118. A compact save code (FW2) for the QR link

**Status:** Implemented for review (2026-10-23). Requested by Guillaume ("is there a way for the qr/link to have less data?"), who then added that links start breaking at about 1,000 characters and that the game has no decimals anywhere ("ok do that"). Changes the code format of [0066](0066-move-voyage-between-devices.md); the `.json` file stays as it is.

## Context

The save code of 0066 (`FW1`) is the save's JSON, with every port, good and field spelled out by name, numbers rounded to 2 decimals and zero amounts dropped, squeezed with zlib level 9 and written in URL-safe base64. The QR code carries the game's link with the code after `#voyage=`, at error correction L.

Measured on the Windward Ring (6 ports, 10 goods):

| Voyage | FW1 link | FW1 QR (L) |
|---|---|---|
| 5 minutes (the test voyage) | 950 chars | version 22 |
| 33 minutes | 1,021 chars | version 23 (109×109) |
| 5x sea, 30 ports | about 2,870 chars | version 40, the largest QR code there is |

So a real voyage is already past the 1,000 characters where links start to break, and the 5x map (bigger map readiness, 0115) would not fit at all. Most of the bytes are market stocks (ports × goods, each with 2 decimals the player never sees). Dropping redundant JSON fields (the order's repeated port id, zero town fields, a "discovered all" flag) saves only 3%: zlib already squeezes the names well.

Options measured: (1) a binary layout of whole numbers; (2) the same with medium error correction; (3) the QR numeric mode on top (about 2 versions smaller again, but our QR library has no mixed segments and the pasted code becomes a long run of digits); (4) leaving market stocks out (the other device would lose the market state).

## Decision

Options 1 and 2.

1. **FW2 code** (`src/sim/saveCode.ts`): the save as a run of varints (7 bits a byte, so small numbers take one byte), then zlib level 9 (its checksum still catches a cut or mistyped code) and base64url after `FW2`.
   - **Order instead of names.** Ports in the map's order, goods, ships, upgrade tracks and difficulty levels in the data files' order. Present/absent lists (owned ships, markets, discovered ports, towns) are bit flags. An order's good and help flag share one number.
   - **Whole numbers.** The game shows no decimals, so stocks, gold, growth, rare goods, hull damage, rewards and every timer are rounded. The position is in decimetres and the heading in tenths of a degree, so the boat does not jump.
   - **Fingerprint.** The code starts with the save version and a 16-bit fingerprint of the map name and every id list above. A code from a game whose lists differ (ports added or moved, a good added) is refused with "made by a different version of the game: reload both devices and make a new code" (`transfer.otherVersion`), never misread. Both devices normally run the same deployed build.
   - The unpacked save goes through `validateSave` like every other save, and a code with too few or too many numbers reads as unreadable.
2. **Medium error correction** for the save QR (`qrSvg(link, 'M')`), now that the code is short, so a phone reads it off a glossy tablet screen. The tuning panel's QR keeps L.
3. **Old codes keep working.** `FW1` codes (links already sent, codes pasted from notes) are still read exactly as before; the game only writes `FW2`. `tests/fixtures/fw1-voyage-code.txt` is a code made by the game before this change.

Results, same voyages:

| Voyage | FW2 link | FW2 QR (M) |
|---|---|---|
| 5 minutes | 218 chars | version 11 (61×61) |
| 33 minutes | 249 chars | version 11 |
| 5x sea, 30 ports | 672 chars | version 21 (101×101) |

## Consequences

- The link stays under 1,000 characters on the 5x map with room to spare. `tests/save-transfer.test.ts` builds a 30-port sea from a played voyage (each copied port with its own stocks, orders and towns) and fails if the link goes over 1,000 characters or the QR over version 25, and scans the QR with a real decoder. When the stress map of the bigger map work lands, the test can use it instead.
- A sea of about 60 ports would pass 1,000 characters again (about 1,340 measured); the `.json` file is the way for such a voyage, or option 3 then.
- A code made before a game update that changes the ports, goods or ships lists is refused; the player reloads both devices and makes a new code. A code is a copy made a moment before it is scanned, so this is rare.
- The hidden fractions (a market at 13.31 fish, half a gold piece) round on the way across. Nothing the player can see changes.
- Every new save field needs a line in `packSave` and `unpackSave`, and the save version must go up when the layout changes.
