import { SHIP_FILES } from '../../data/ships';
import { t } from '../../i18n';
import { SHIP_CLASSES } from '../../sim/ship';
import { type ShipOffer, homePort } from '../../sim/shipyards';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS, type UpgradeLevels } from '../../sim/upgrades';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { el } from '../components/dom';
import { fleetTable } from './fleet';
import { yardSide } from './shipyard';

/**
 * The Shipyard in Free Sailing (issue #464, decision 0266): no gold to spend, so the yard works like
 * the session's setup instead: every ship in the table and every upgrade level, free, at once.
 * The same ledger as the voyage's Shipyard: upgrades, the fleet under them, the preview box.
 */
export interface FreeYard {
  refit(ship: string, upgrades: UpgradeLevels): void;
}

export function freeYardPane(world: World, refit: FreeYard['refit']): HTMLElement {
  const { captain } = world.trade;
  const cls = SHIP_CLASSES[captain.activeShip]!;
  const levels = captain.ships[cls.id] ?? { sails: 1, hold: 1, hull: 1 };
  const pane = el('section', 'hb-pane hb-yard hb-free-yard');

  const main = el('div', 'hb-yard-main');
  const tracks = el('div', 'hb-levels');
  for (const track of UPGRADE_TRACKS) {
    const row = el('div', 'hb-level-row');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', t(`free.${track}`));
    row.append(el('span', '', t(`free.${track}`)));
    for (let n = 1; n <= MAX_UPGRADE_LEVEL; n++) {
      const on = levels[track] === n;
      const b = button({
        label: String(n),
        onPress: () => refit(cls.id, { ...levels, [track]: n }),
      });
      b.classList.add('hb-level');
      b.classList.toggle('is-on', on);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.dataset.free = `${track}:${n}`;
      row.append(b);
    }
    tracks.append(row);
  }
  main.append(el('h3', 'hb-list-title', t('free.upgrades')), tracks);

  // Every ship of the game, hers picked: a row sails that one, with the same upgrades.
  const yard = homePort(world.map);
  const offers: ShipOffer[] = SHIP_FILES.map((s) => ({
    cls: SHIP_CLASSES[s.id]!,
    status: 'owned',
    yard,
    ordersLeft: 0,
  }));
  const fleet = el('div', 'hb-yard-fleet');
  fleet.append(
    el('h3', 'hb-list-title', t('free.ship')),
    fleetTable(
      world,
      offers,
      cls.id,
      (id) => refit(id, levels),
      (o) => (o.cls.id === cls.id ? t('fleet.sailing') : ''),
    ),
  );

  const page = el('div', 'hb-yard-page');
  page.append(main, yardSide(world, cls, el('p', 'hb-ship-note', t('free.yardNote'))));
  pane.append(page, fleet);
  return pane;
}
