import { formatNumber, shipName, shipThe, t, townLevelName } from '../../i18n';
import { topSpeedKn } from '../../sim/boat';
import { SHIP_CLASSES } from '../../sim/ship';
import { homePort } from '../../sim/shipyards';
import { upgradeAllowed } from '../../sim/trade';
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_TRACKS,
  type UpgradeTrack,
  effectiveShip,
  holdCapacity,
  hullDurability,
  upgradePrice,
} from '../../sim/upgrades';
import { upgradeNeedsLevel } from '../../sim/settlement';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { card } from '../components/card';
import { el } from '../components/dom';
import { icon } from '../icons';
import { padGlyph } from '../padGlyphs';
import { fleetOffers, fleetTable, firstShip, shipAction, shipFacts } from './fleet';
import { pips } from './parts';
import './yard.css';

/**
 * The Shipyard (issue #443, round 3 C): the upgrades for the ship she sails as three cards, the
 * fleet as a table, and on the right the 3D preview area, the biggest thing on the paper, kept
 * empty for the coming model viewer (no fake render), with the picked ship's Buy under it and
 * the Boat looks button. The live boat stays in sight beside the paper. On a phone the upgrades
 * and the fleet are two pages side by side that swipe.
 */
export interface YardActions {
  upgrade: (track: UpgradeTrack) => void;
  ship: (kind: 'buy' | 'switch', id: string) => void;
  pick: (id: string) => void;
}

const TRACK_ICON: Record<UpgradeTrack, string> = { sails: 'sail', hold: 'crate', hull: 'hull' };

export function shipyardPane(world: World, picked: string | null, a: YardActions): HTMLElement {
  const offers = fleetOffers(world);
  const selected =
    offers.find((o) => o.cls.id === picked) ??
    offers.find((o) => o.cls.id === firstShip(world, offers))!;
  const pane = el('section', 'hb-pane hb-yard');
  const main = el('div', 'hb-yard-main');
  const active = SHIP_CLASSES[world.trade.captain.activeShip]!;
  main.append(el('h3', 'hb-list-title', t('upg.forActive', { ship: shipName(active) })));
  const home = homePort(world.map);
  if (world.trade.dockedAt === home.id) {
    const cards = el('div', 'hb-upgrades');
    for (const track of UPGRADE_TRACKS) cards.append(upgradeCard(world, track, a.upgrade));
    main.append(cards);
  } else main.append(el('p', 'hb-muted', t('upg.homeOnly', { port: home.name })));

  const fleet = el('div', 'hb-yard-fleet');
  fleet.append(
    el('h3', 'hb-list-title', t('fleet.title')),
    fleetTable(world, offers, selected.cls.id, a.pick),
  );

  const side = el('div', 'hb-yard-side');
  const preview = el('div', 'hb-preview');
  preview.setAttribute('aria-hidden', 'true');
  preview.append(
    el('b', '', t('harbour.preview', { ship: shipThe(selected.cls) })),
    el('span', '', t('harbour.previewNote')),
  );
  preview.insertAdjacentHTML(
    'beforeend',
    `<i class="hb-preview-turn">${padGlyph('rs', 'bumper')}</i>`,
  );
  const looks = button({ label: t('customise.open') });
  looks.id = 'tp-boat-looks';
  looks.title = t('customise.openTitle');
  looks.classList.add('hb-wide');
  side.append(
    preview,
    el('h2', 'hb-detail-name', shipName(selected.cls)),
    facts(shipFacts(world, selected.cls)),
    shipAction(world, selected, a.ship),
    looks,
  );
  const page = el('div', 'hb-yard-page');
  page.append(main, side);
  pane.append(page, fleet);
  return pane;
}

function facts(html: string): HTMLElement {
  const p = el('p', 'hb-detail-note');
  p.innerHTML = html;
  return p;
}

/** One track: its level, what it does now and next, and its price or why it waits. */
function upgradeCard(
  world: World,
  track: UpgradeTrack,
  upgrade: (track: UpgradeTrack) => void,
): HTMLElement {
  const { trade, map } = world;
  const ship = SHIP_CLASSES[trade.captain.activeShip]!;
  const levels = trade.captain.ships[ship.id] ?? { sails: 1, hold: 1, hull: 1 };
  const now = levels[track];
  const level = Math.min(Math.max(now, 1), 3) as 1 | 2 | 3;
  // Each level's numbers: hold capacity, hull durability, top speed with the others as they are.
  const params = (lv: 1 | 2 | 3) => {
    const at = { ...levels, [track]: lv };
    const n =
      track === 'hold'
        ? holdCapacity(ship, { sails: 1, hold: lv, hull: 1 })
        : track === 'hull'
          ? hullDurability({ sails: 1, hold: 1, hull: lv })
          : 0;
    return { n, kn: formatNumber(topSpeedKn(effectiveShip(ship, at)), 1) };
  };
  const max = now >= MAX_UPGRADE_LEVEL;
  const nowText = t(`upg.${track}.${level}`, params(level));
  const c = card({ title: t(`upg.${track}`), text: nowText });
  c.classList.add('hb-upgrade');
  c.insertAdjacentHTML('afterbegin', icon(TRACK_ICON[track], 'hb-upgrade-icon'));
  c.querySelector('.ui-card-title')!.append(pips(now, MAX_UPGRADE_LEVEL));
  const next =
    level < 3 ? t(`upg.${track}.next${(level + 1) as 2 | 3}`, params((level + 1) as 2 | 3)) : '';
  const nextLine = el('span', 'hb-upgrade-next', max ? t('upg.fullyUpgraded') : next);
  // One line each on the card; the whole words show on hover.
  c.querySelector<HTMLElement>('.ui-card-text')!.title = nowText;
  nextLine.title = nextLine.textContent ?? '';
  c.append(nextLine);

  const price = upgradePrice(ship, levels, track);
  let label = t('upg.maxLevel');
  let ok = false;
  if (!max && !upgradeAllowed(trade, map, now + 1))
    label = t('upg.needsLevel', {
      port: homePort(map).name,
      level: townLevelName(upgradeNeedsLevel(now + 1)),
    });
  else if (!max && price !== null) {
    ok = trade.captain.gold >= price;
    label = ok
      ? t('upg.upgradeTo', { price: formatNumber(price) })
      : t('upg.upgradeShort', { price: formatNumber(price), n: price - trade.captain.gold });
  }
  const b = button({ label, disabled: !ok, onPress: () => upgrade(track) });
  b.classList.add('upgrade-btn');
  if (ok) b.dataset.track = track;
  c.append(b);
  return c;
}
