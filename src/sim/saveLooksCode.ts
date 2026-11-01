import type { Appearance } from './cosmetics';
import type { ShipLooks } from './shipLooks';

/** The look section of a save code (decision 0263), after the credit section. */
export const LOOKS_SECTION = 15;

/** The slots in the order a code lists them: appending is safe, reordering is not. */
const SLOT_ORDER: readonly (keyof Appearance)[] = [
  'sailColour',
  'sailPattern',
  'sailLogo',
  'hullColour',
  'figurehead',
  'flag',
  'wake',
];

interface NumberSink {
  uint(n: number): void;
}
interface NumberSource {
  uint(): number;
}

/**
 * The section number, then per ship with a look: its index, how many slots, then per slot its position and its item id as
 * text (0 for `null`, else length + 1 and the characters). Ids, not list positions, so adding
 * catalogue items never breaks an older code.
 */
export function packLooks(w: NumberSink, looks: ShipLooks, shipIds: readonly string[]): void {
  w.uint(LOOKS_SECTION);
  const ships = shipIds.filter((id) => looks[id] && Object.keys(looks[id]!).length);
  w.uint(ships.length);
  for (const ship of ships) {
    const look = looks[ship]!;
    const slots = SLOT_ORDER.filter((k) => look[k] !== undefined);
    w.uint(shipIds.indexOf(ship));
    w.uint(slots.length);
    for (const key of slots) {
      const id = look[key] as string | null;
      w.uint(SLOT_ORDER.indexOf(key));
      w.uint(id === null ? 0 : id.length + 1);
      for (const ch of id ?? '') w.uint(ch.charCodeAt(0));
    }
  }
}

/** The raw looks of a code: unknown ships and slots are skipped; validateSave checks the ids. */
export function unpackLooks(r: NumberSource, shipIds: readonly string[]): ShipLooks {
  const looks: ShipLooks = {};
  for (let n = r.uint(); n > 0; n--) {
    const ship = shipIds[r.uint()];
    const look: Record<string, string | null> = {};
    for (let m = r.uint(); m > 0; m--) {
      const key = SLOT_ORDER[r.uint()];
      const length = r.uint();
      let id = '';
      for (let i = 1; i < length; i++) id += String.fromCharCode(r.uint());
      if (key) look[key] = length === 0 ? null : id;
    }
    if (ship) looks[ship] = look;
  }
  return looks;
}
