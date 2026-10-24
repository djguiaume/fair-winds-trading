import { it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { legSeconds } from '../src/sim/balance';
import { SHIP_CLASSES } from '../src/sim/ship';
import { effectiveShip } from '../src/sim/upgrades';
import { TUNING } from '../src/data/tuning';
import type { MapDef } from '../src/sim/map';

/*
 * Far goods estimate (docs/reviews/far-goods). Not a balance test: it prices a full hold of a
 * rare good bought where it is made and sold where it is wanted, and times the leg with the
 * balance simulation's own leg model, on the ring plus the placeholder Phase 4 sites from
 * docs/reviews/phase-4-map (bearing clockwise from north, distance from the centre).
 * Run: cp docs/reviews/far-goods/src/estimate.test.ts tests/zz-estimate.test.ts &&
 *   npx vitest run tests/zz-estimate.test.ts --silent=false; rm tests/zz-estimate.test.ts
 */
const SITES: Record<string, [number, number]> = {
  'ice-port': [8, 690],
  'outpost-ice': [30, 860],
  'tropic-port': [176, 680],
  'outpost-tropic': [141, 900],
  'fire-port': [300, 650],
  'outpost-fire': [245, 880],
  'fog-port': [94, 680],
  'outpost-fog': [66, 870],
};
const map = structuredClone(PHASE1_MAP) as MapDef;
for (const [id, [deg, r]] of Object.entries(SITES)) {
  const a = (deg * Math.PI) / 180;
  map.islands.push({ id, name: id, x: Math.round(r * Math.sin(a)), y: Math.round(r * Math.cos(a)), radius: 20 } as never);
  map.ports.push({ id, name: id, islandId: id } as never);
}

const m = TUNING.economy.market;
const t = TUNING.economy.towns;
const spread = 0.06; // Captain's cut
const mid = (base: number, stock: number) =>
  base * Math.min(Math.max(Math.pow(m.referenceStock / Math.max(stock, 1), m.elasticity), m.floor), m.ceiling);
function run(base: number, makerLevel: number, buyerLevel: number, qty: number) {
  let cost = 0;
  let paid = 0;
  const s0 = t.producesEquilibrium[makerLevel - 1]! * t.rareShare;
  const w0 = t.wantsEquilibrium[buyerLevel - 1]!;
  for (let i = 0; i < qty; i++) {
    cost += Math.ceil(mid(base, s0 - i - 1) * (1 + spread));
    paid += Math.floor(mid(base, w0 + i + 1) * (1 - spread));
  }
  return { cost, paid, gain: paid - cost };
}
const maxed = { sails: 3, hull: 3, hold: 3 } as const;

it('prints the estimate', () => {
  const ships = ['cutter', 'schooner', 'hoy', 'fluyt', 'indiaman'];
  const rows: string[] = [];
  const cases: { label: string; from: string; to: string; base: number; ml: number; bl: number }[] = [
    { label: 'honey today', from: 'abbey-head', to: 'saltmere', base: 55, ml: 2, bl: 3 },
    { label: 'lamp oil today', from: 'watchman-key', to: 'calda', base: 50, ml: 2, bl: 3 },
    { label: 'spice', from: 'outpost-tropic', to: 'calda', base: 90, ml: 2, bl: 4 },
    { label: 'spice', from: 'outpost-tropic', to: 'westholm', base: 90, ml: 2, bl: 4 },
    { label: 'cloudberry jam', from: 'outpost-ice', to: 'saltmere', base: 110, ml: 2, bl: 4 },
    { label: 'cloudberry jam', from: 'outpost-ice', to: 'stonehaven', base: 110, ml: 2, bl: 4 },
    { label: 'obsidian', from: 'outpost-fire', to: 'calda', base: 100, ml: 2, bl: 4 },
    { label: 'obsidian', from: 'outpost-fire', to: 'saltmere', base: 100, ml: 2, bl: 4 },
    { label: 'amber', from: 'outpost-fog', to: 'westholm', base: 110, ml: 2, bl: 4 },
    { label: 'amber', from: 'outpost-fog', to: 'stonehaven', base: 110, ml: 2, bl: 4 },
    { label: 'honey out', from: 'abbey-head', to: 'tropic-port', base: 55, ml: 2, bl: 2 },
    { label: 'lamp oil out', from: 'watchman-key', to: 'ice-port', base: 50, ml: 2, bl: 2 },
  ];
  for (const c of cases) {
    const parts = [`${c.label} ${c.from} -> ${c.to}`];
    for (const id of ships) {
      const ship = effectiveShip(SHIP_CLASSES[id]!, maxed);
      const sec = legSeconds(map, ship, c.from, c.to);
      const qty = Math.min(ship.hold, 30);
      const r = run(c.base, c.ml, c.bl, qty);
      parts.push(`${id}: ${qty}u ${Math.round(sec)}s +${r.gain} (${(r.gain / sec).toFixed(1)}/s)`);
    }
    rows.push(parts.join(' | '));
  }
  console.log(rows.join('\n'));
});
