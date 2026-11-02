import { SHIP_FILES } from '../../data/ships';
import { type Appearance, type Catalogue, flagOf, resolveAppearance } from '../../sim/cosmetics';
import { FLAGS } from '../../sim/regatta';
import type { ShipUpgrades } from '../../render/models';
import { type MessageKey, shipName, shipThe, t } from '../../i18n';
import { panelClasses } from '../components/panel';
import { icon } from '../icons';
import { flagSvg, hullSwatchSvg, sailSwatchSvg, wakeSwatchSvg } from '../lookPictures';
import { type Choice, type SlotKey, canUse, howToEarn, itemName } from './choices';

/**
 * The Boat looks screen's markup (#299, layout B "Wardrobe" after Pokémon Z-A): the slot rows
 * with what each wears, the boat on her turntable, the slot's items and the one action. Strings
 * only; `screen.ts` puts them in place and wires them. On the harbour's paper since v1.5 (#443).
 */

export type Compare = 'stock' | 'yours' | 'all';
export const COMPARES: readonly Compare[] = ['stock', 'yours', 'all'];

const SLOT_TEXT: Record<SlotKey, MessageKey> = {
  sailColour: 'customise.tab.colours',
  sailPattern: 'customise.tab.patterns',
  sailLogo: 'customise.tab.logos',
  hullColour: 'customise.tab.hull',
  figurehead: 'customise.tab.figurehead',
  flag: 'customise.tab.flag',
  wake: 'customise.tab.wake',
};
export const slotName = (slot: SlotKey) => t(SLOT_TEXT[slot]);

const LOCK = `<svg class="bl-lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke-width="2"/></svg>`;
const NONE = `<svg class="bl-none" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke-width="2.5"/><path d="M8 24 L24 8" stroke-width="2.5"/></svg>`;
const SEA = '#3f8fa8';
/** The two side panes are the v1.5 paper (decision 0269), torn, following the scene's night. */
const PAPER = panelClasses('torn');
/** A logo's tile shows it larger than on the sail (a share of the sail's foot), so it reads. */
const LOGO_TILE_EMBLEM = 0.8;

/** The frame of the screen; the parts in it are filled by the functions below. */
export function shellHtml(): string {
  return `
    <aside class="bl-slots ${PAPER}">
      <h2 class="bl-title" id="bl-title">${t('customise.title')}</h2>
      <div class="bl-ships" role="group" aria-label="${t('customise.ships')}"></div>
      <div class="bl-slot-list" role="tablist" aria-orientation="vertical"></div>
      <button type="button" class="ui-btn ui-btn--plain ui-pressable bl-stock" title="${t('customise.stockTitle')}">${t('customise.stock')}</button>
    </aside>
    <section class="bl-stage">
      <div class="bl-ship-line"></div>
      <canvas class="bl-canvas"></canvas>
      <div class="bl-compare" role="group" aria-label="${t('customise.compare')}" data-pad="steps">
        ${COMPARES.map((c) => `<button type="button" data-compare="${c}">${t(`customise.compare.${c}`)}</button>`).join('')}
      </div>
      <div class="bl-view">
        <button type="button" class="bl-round" data-turn="-1" title="${t('customise.turnLeft')}" aria-label="${t('customise.turnLeft')}">⟲</button>
        <button type="button" class="bl-round bl-night" aria-pressed="false"></button>
        <button type="button" class="bl-round" data-turn="1" title="${t('customise.turnRight')}" aria-label="${t('customise.turnRight')}">⟳</button>
      </div>
    </section>
    <aside class="bl-items ${PAPER}" role="tabpanel" aria-labelledby="bl-items-title">
      <div class="bl-items-head">
        <h3 class="bl-items-title" id="bl-items-title"></h3>
        <button type="button" class="ui-header-exit ui-pressable bl-close" data-pad-close title="${t('customise.close')}" aria-label="${t('customise.close')}">${icon('close')}</button>
      </div>
      <div class="bl-grid"></div>
      <div class="bl-detail"></div>
    </aside>`;
}

export function shipsHtml(ships: readonly string[], current: string): string {
  return ships
    .map((id) => {
      const name = shipName(SHIP_FILES.find((s) => s.id === id) ?? { id, name: id });
      return `<button type="button" data-ship="${id}" aria-pressed="${id === current}">${name}</button>`;
    })
    .join('');
}

export function shipLineHtml(shipClass: string, levels: ShipUpgrades): string {
  const name = shipName(
    SHIP_FILES.find((s) => s.id === shipClass) ?? { id: shipClass, name: shipClass },
  );
  return `<b>${name}</b><span>${t('customise.levels', { ...levels })}</span>`;
}

/** One row per slot: its name, what it wears now (tried on), a mark when that is not in use. */
export function slotRowsHtml(
  rows: readonly { slot: SlotKey; tried: Choice }[],
  current: SlotKey,
  pictureOf: (slot: SlotKey, c: Choice) => string,
): string {
  return rows
    .map(
      ({ slot, tried }) => `
        <button type="button" role="tab" class="bl-slot" data-slot="${slot}" aria-selected="${slot === current}">
          <span class="bl-slot-pic">${pictureOf(slot, tried)}</span>
          <span class="bl-slot-text"><small>${slotName(slot)}</small><b>${itemName(tried)}</b></span>
          ${tried.inUse ? '' : '<span class="bl-changed" aria-hidden="true"></span>'}
        </button>`,
    )
    .join('');
}

export function gridHtml(
  slot: SlotKey,
  choices: readonly Choice[],
  pictureOf: (slot: SlotKey, c: Choice) => string,
): string {
  return choices
    .map((c) => {
      const state = [c.tried && 'tried', c.locked && 'locked', c.unfit && 'unfit']
        .filter(Boolean)
        .join(' ');
      const label = `${itemName(c)}${c.inUse ? ` (${t('customise.inUse')})` : ''}`;
      return `
        <button type="button" class="bl-tile ${state}" data-item="${c.id ?? ''}" aria-pressed="${c.tried}" aria-label="${label}">
          <span class="bl-pic">${pictureOf(slot, c)}</span>
          ${c.locked ? LOCK : ''}${c.inUse ? '<span class="bl-in-use" aria-hidden="true"></span>' : ''}
          <span class="bl-tile-name">${itemName(c)}</span>
        </button>`;
    })
    .join('');
}

/** The tried-on item: its name, why it can or cannot be kept, and Use (X on a pad). */
export function detailHtml(tried: Choice, inUse: Choice, shipClass: string): string {
  const ship = SHIP_FILES.find((s) => s.id === shipClass) ?? { id: shipClass, name: shipClass };
  const note = tried.locked
    ? `<span class="bl-earn">${LOCK}${howToEarn(tried.item!)}</span>`
    : tried.unfit
      ? `<span class="bl-earn">${t('customise.notForShip', { ship: shipThe(ship) })}</span>`
      : tried.inUse
        ? ''
        : `<span class="bl-note">${tried.item?.unlock.kind === 'earned' ? t('customise.earned') : t('customise.free')} · ${t('customise.was', { item: itemName(inUse) })}</span>`;
  const action = tried.inUse
    ? `<span class="bl-badge">${t('customise.inUse')}</span>`
    : `<button type="button" class="ui-btn ui-btn--primary ui-pressable bl-use" data-pad="secondary" ${canUse(tried) ? '' : 'aria-disabled="true"'}>${t('customise.use')}</button>`;
  return `<div class="bl-detail-text"><b>${itemName(tried)}</b>${note}</div>${action}`;
}

/**
 * The flat picture of one choice: a swatch, a sail with the pattern or emblem on it, a hull, the
 * flag, the wake; figureheads come from the 3D model (`figurehead`).
 */
export function choicePicture(
  cat: Catalogue,
  shipClass: string,
  preview: Appearance,
  slot: SlotKey,
  c: Choice,
  figurehead: (recipe: string) => string,
): string {
  if (!c.item) return NONE;
  const item = c.item;
  const { look } = resolveAppearance(cat, { ...preview, [slot]: c.id }, shipClass, FLAGS);
  switch (item.slot) {
    case 'sail-colour':
      return `<span class="bl-swatch" style="background:${item.cloth}"></span>`;
    case 'sail-pattern':
      return sailSwatchSvg({ ...look.sail, logo: null });
    case 'sail-logo':
      return sailSwatchSvg(look.sail, LOGO_TILE_EMBLEM);
    case 'hull-colour': {
      const model = SHIP_FILES.find((s) => s.id === shipClass)?.model;
      return hullSwatchSvg(
        model?.hullColor ?? '#9a5a2a',
        look.hull.band ?? model?.bandColor ?? '#2f6f9f',
        look.hull.strake,
      );
    }
    case 'figurehead':
      return `<img alt="" src="${figurehead(item.recipe)}">`;
    case 'flag': {
      const flag = flagOf(item, FLAGS);
      return flag ? flagSvg(flag, 40) : NONE;
    }
    case 'wake':
      return wakeSwatchSvg(look.wake, SEA);
  }
}
