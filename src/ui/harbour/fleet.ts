import { TUNING } from '../../data/tuning';
import { formatNumber, shipName, shipThe, t } from '../../i18n';
import { topSpeedKn } from '../../sim/boat';
import { SLOOP, type ShipClass } from '../../sim/ship';
import { type ShipOffer, homePort, shipOffers } from '../../sim/shipyards';
import { cargoUsed } from '../../sim/trade';
import { effectiveShip, holdCapacity } from '../../sim/upgrades';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { coins, esc } from './parts';

/**
 * The fleet (decision 0048, issue #443): the ships she owns or can find as a readable table, the
 * starter first, the ones of yards still off the chart as one line; the picked one's Buy or Switch goes under the
 * Shipyard's preview. Switching and upgrades happen at the home port only.
 */
const STOCK = { sails: 1, hold: 1, hull: 1 } as const;

export function fleetOffers(world: World): ShipOffer[] {
  const { trade, map } = world;
  const sloop: ShipOffer = { cls: SLOOP, status: 'owned', yard: homePort(map), ordersLeft: 0 };
  return [sloop, ...shipOffers(trade, map).filter((o) => o.status !== 'no-yard')];
}

/** The ship's levels: hers as upgraded, else stock. */
const levelsOf = (world: World, cls: ShipClass) => world.trade.captain.ships[cls.id] ?? STOCK;

/** Top speed in the reference breeze, as words ("8.7 kn"). */
export const topKnots = (world: World, cls: ShipClass) =>
  t('harbour.knots', {
    kn: formatNumber(topSpeedKn(effectiveShip(cls, levelsOf(world, cls))), 1),
  });

/** What can be done with a ship from this harbour, or why not. */
export type ShipMove =
  | { kind: 'sailing' }
  | { kind: 'switch' | 'buy'; label: string; ok: boolean; why?: string; price?: number }
  | { kind: 'note'; text: string };

export function shipMove(world: World, offer: ShipOffer): ShipMove {
  const { trade, map } = world;
  const { captain } = trade;
  const { cls } = offer;
  const ship = shipThe(cls);
  const home = homePort(map);
  const cargo = cargoUsed(trade);
  if (captain.activeShip === cls.id) return { kind: 'sailing' };
  if (offer.status === 'owned') {
    if (trade.dockedAt !== home.id)
      return { kind: 'note', text: t('fleet.waitingAt', { port: home.name }) };
    const cap = holdCapacity(cls, captain.ships[cls.id]!);
    if (cargo <= cap) return { kind: 'switch', label: t('fleet.switchTo', { ship }), ok: true };
    const load = { used: cargo, cap };
    const why = t('fleet.cargoTooLargeCount', load);
    return { kind: 'switch', label: t('fleet.switchCargo', { ship, ...load }), ok: false, why };
  }
  if (offer.status === 'undiscovered') return { kind: 'note', text: t('fleet.undiscovered') };
  const yard = offer.yard!.name;
  if (offer.status === 'needs-standing')
    return { kind: 'note', text: t('fleet.needsOrders', { n: offer.ordersLeft, port: yard }) };
  const price = formatNumber(cls.price);
  if (trade.dockedAt !== offer.yard!.id)
    return { kind: 'note', text: t('fleet.builtAt', { port: yard, price }) };
  if (captain.gold < cls.price) {
    const n = cls.price - captain.gold;
    const label = t('fleet.buyNeed', { ship, price, n });
    return { kind: 'buy', label, ok: false, why: t('upg.needGoldTitle', { n }), price: cls.price };
  }
  if (cargo > holdCapacity(cls, STOCK)) {
    const label = t('fleet.buyCargoBig', { ship, price });
    return {
      kind: 'buy',
      label,
      ok: false,
      why: t('fleet.cargoExceeds', { ship }),
      price: cls.price,
    };
  }
  return { kind: 'buy', label: t('fleet.buy', { ship, price }), ok: true, price: cls.price };
}

/** The ship shown first: one she can buy or switch to here, else the next one not hers. */
export function firstShip(world: World, offers: readonly ShipOffer[]): string {
  const known = offers.filter((o) => o.status !== 'undiscovered');
  const moves = known.map((o) => [o, shipMove(world, o)] as const);
  const act = moves.find(([, m]) => m.kind === 'buy' || m.kind === 'switch');
  const other = moves.find(([, m]) => m.kind !== 'sailing');
  return (act ?? other ?? moves[0]!)[0].cls.id;
}

/** The fleet table: ship, hold, points off the wind, top speed, and its state or price. */
export function fleetTable(
  world: World,
  offers: readonly ShipOffer[],
  selected: string,
  pick: (id: string) => void,
  state: (offer: ShipOffer) => string = (offer) => shipState(world, offer),
): HTMLElement {
  const table = el('div', 'hb-fleet');
  const head = el('div', 'hb-cols hb-fleet-cols');
  head.setAttribute('aria-hidden', 'true');
  for (const key of [
    'harbour.colShip',
    'trade.hold',
    'harbour.colPoints',
    'harbour.colTop',
  ] as const)
    head.append(el('span', '', t(key)));
  head.append(el('span', ''));
  table.append(head);
  // Ships of yards not on the chart yet are one line, so the table stays readable (#443).
  const known = offers.filter((o) => o.status !== 'undiscovered');
  for (const offer of known)
    table.append(fleetRow(world, offer, offer.cls.id === selected, pick, state(offer)));
  const more = offers.length - known.length;
  if (more) table.append(el('p', 'hb-muted hb-fleet-more', t('harbour.fleetMore', { n: more })));
  table.append(
    el(
      'p',
      'hb-muted hb-small',
      t('upg.speedNote', { wind: TUNING.seamanship.boat.referenceBreezeKn }),
    ),
  );
  return table;
}

function fleetRow(
  world: World,
  offer: ShipOffer,
  selected: boolean,
  pick: (id: string) => void,
  stateHtml: string,
): HTMLElement {
  const { cls } = offer;
  const line =
    cls.line === 'starter'
      ? t('fleet.line.starter')
      : t('fleet.lineTier', { line: t(`fleet.line.${cls.line}`), tier: cls.tier });
  const row = listRow({
    label: shipName(cls),
    detail: line,
    selected,
    onPress: () => pick(cls.id),
  });
  row.classList.add('hb-row', 'hb-ship');
  row.dataset.pick = `ship:${cls.id}`;
  const state = el('span', 'hb-ship-state');
  state.innerHTML = stateHtml;
  row.append(
    el('span', 'hb-num', String(holdCapacity(cls, levelsOf(world, cls)))),
    el('span', 'hb-num', `${cls.noGoDeg}°`),
    el('span', 'hb-num', topKnots(world, cls)),
    state,
  );
  return row;
}

/** A row's state: sailing, a note, its price or owned (HTML). */
function shipState(world: World, offer: ShipOffer): string {
  const move = shipMove(world, offer);
  if (move.kind === 'buy') return coins(move.price!);
  const text =
    move.kind === 'sailing'
      ? t('fleet.sailing')
      : move.kind === 'note'
        ? move.text
        : t('harbour.owned');
  return esc(text);
}

/** The picked ship's line of facts: hold, points off the wind, top speed. */
export function shipFacts(world: World, cls: ShipClass): string {
  const speed = formatNumber(topSpeedKn(effectiveShip(cls, levelsOf(world, cls))), 1);
  return [
    t('fleet.hold', { n: holdCapacity(cls, levelsOf(world, cls)) }),
    t('fleet.points', { deg: cls.noGoDeg }),
    t('fleet.speed', { kn: speed }),
  ].join(' · ');
}

/** The picked ship's main button (Buy, Switch), or its state in words. */
export function shipAction(
  world: World,
  offer: ShipOffer,
  act: (kind: 'buy' | 'switch', id: string) => void,
): HTMLElement {
  const move = shipMove(world, offer);
  if (move.kind === 'sailing') return el('p', 'hb-ship-note is-sailing', t('fleet.sailing'));
  if (move.kind === 'note') return el('p', 'hb-ship-note', move.text);
  const id = offer.cls.id;
  const b = button({
    label: move.label,
    variant: 'primary',
    disabled: !move.ok,
    onPress: () => act(move.kind as 'buy' | 'switch', id),
  });
  b.classList.add('hb-wide');
  if (move.why) b.title = move.why;
  if (move.ok) b.dataset[move.kind === 'buy' ? 'shipBuy' : 'shipSwitch'] = id;
  return b;
}
