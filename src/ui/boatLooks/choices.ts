import {
  type Appearance,
  type Catalogue,
  type Cosmetic,
  APPEARANCE_SLOTS,
  fitsClass,
} from '../../sim/cosmetics';
import { type UnlockProgress, earnedBy, isUnlocked } from '../../sim/cosmeticUnlocks';
import { language, t, tOptional } from '../../i18n';
import { seriesName } from '../regattaView';
import { QUESTS } from '../../sim/quests';

/**
 * What the Boat looks screen (#299) offers in one slot, pure so the tests read it: every item of
 * the slot in catalogue order (plus "None" where the slot may be empty), each with whether it is
 * tried on, in use, locked (and how to earn it) or not for this ship class.
 */
export type SlotKey = keyof Appearance;

/** The screen's rows, top to bottom: sails first, as the storyteller's tabs. */
export const SLOT_ORDER: readonly SlotKey[] = [
  'sailColour',
  'sailPattern',
  'sailLogo',
  'hullColour',
  'figurehead',
  'flag',
  'wake',
];

/** Slots that may hold nothing ("None"); the others always wear an item, stock at least. */
const MAY_BE_EMPTY: readonly SlotKey[] = ['sailLogo', 'figurehead', 'flag'];

export interface Choice {
  /** null is "None". */
  id: string | null;
  item: Cosmetic | null;
  tried: boolean;
  inUse: boolean;
  locked: boolean;
  /** Made for other ship classes only. */
  unfit: boolean;
}

export function slotChoices(
  cat: Catalogue,
  slot: SlotKey,
  shipClass: string,
  progress: UnlockProgress,
  preview: Appearance,
  applied: Appearance,
): Choice[] {
  const items = cat.items.filter((i): i is Cosmetic => i.slot === APPEARANCE_SLOTS[slot]);
  const choice = (item: Cosmetic | null): Choice => {
    const id = item?.id ?? null;
    return {
      id,
      item,
      tried: preview[slot] === id,
      inUse: applied[slot] === id,
      locked: item !== null && !isUnlocked(item, progress),
      unfit: item !== null && !fitsClass(item, shipClass),
    };
  };
  return [...(MAY_BE_EMPTY.includes(slot) ? [choice(null)] : []), ...items.map(choice)];
}

/** Whether a tried-on choice may be kept: unlocked and made for this ship. */
export const canUse = (c: Choice) => !c.locked && !c.unfit;

/** An item's name in the player's language. */
export const itemName = (item: Cosmetic | null) =>
  item ? item.name[language() === 'fr' ? 'fr' : 'en'] : t('customise.none');

/** "Earn it: The mill on the hill": the quest, series or milestone that unlocks an item. */
export function howToEarn(item: Cosmetic): string {
  const by = earnedBy(item);
  if (!by) return '';
  const how =
    by.kind === 'quest'
      ? questName(by.id)
      : by.kind === 'regatta'
        ? seriesName(by.id)
        : by.id;
  return t('customise.locked', { how });
}

/** The slots whose tried-on item differs from the one in use. */
export const changedSlots = (preview: Appearance, applied: Appearance) =>
  SLOT_ORDER.filter((s) => preview[s] !== applied[s]);

function questName(id: string): string {
  const quest = QUESTS.find((q) => q.id === id);
  return (quest && tOptional(`${quest.text}.name`)) ?? quest?.name ?? id;
}
