import { SHIPPED_CATALOGUE } from '../data/cosmetics';
import { type Appearance, APPEARANCE_SLOTS, resolveAppearance } from '../sim/cosmetics';
import { FLAGS, type FlagDef } from '../sim/regatta';
import { type BoatLook, boatLookOf } from './models/boatLook';
import type { BoatModelOptions } from './models/types';

/**
 * A boat's cosmetic look from catalogue ids (decision 0261) for one ship class: the model's colour
 * channels, the wake style and the flag. Shared by the game's boat, the model sheet and the
 * Boat looks screen's preview, so they always agree.
 */
export interface WornLook {
  look: Partial<BoatLook>;
  wake: { style: string; tint: string | null };
  /** A flag the player chose; null leaves the masthead to the pennant won (decision 0217). */
  flag: FlagDef | null;
}

export function wornLook(want: Partial<Appearance>, shipClass: string): WornLook {
  const { look } = resolveAppearance(SHIPPED_CATALOGUE, want, shipClass, FLAGS);
  return { look: boatLookOf(look), wake: look.wake, flag: look.flag };
}

/**
 * `?wear={"sailLogo":"gull","sailPattern":"chevron-navy"}`: a look by item ids for screenshots
 * and the model sheet; unknown keys are dropped, a bad value falls back to stock.
 */
export function wearFromSearch(search: string): Partial<Appearance> {
  try {
    const raw = JSON.parse(new URLSearchParams(search).get('wear') ?? '{}') as Record<
      string,
      unknown
    >;
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([k, v]) => k in APPEARANCE_SLOTS && (typeof v === 'string' || v === null),
      ),
    ) as Partial<Appearance>;
  } catch {
    return {};
  }
}

/**
 * The model sheet's look (models.html): `&wear=` item ids, `&look=` raw colour channels on top
 * (e.g. {"sailBand":"#602080"}, decision 0259), `&number=K 7` a racing number on the mainsail.
 */
export function sheetLook(search: string, shipClass: string): BoatModelOptions {
  const params = new URLSearchParams(search);
  const raw = JSON.parse(params.get('look') ?? '{}') as Partial<BoatLook>;
  const look = { ...wornLook(wearFromSearch(search), shipClass).look, ...raw };
  return { look, sailNumber: params.get('number') ?? '' };
}
