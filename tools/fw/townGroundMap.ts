// `npm run island -- audit <id> --ground x0,x1,z0,z1 [--step 0.02]` (issue #528): a text map of
// a town's ground as the town checks read it, to place houses from without a picture. One
// character per cell, file coordinates: `.` flat enough for a house, `+` the warn slope, `#`
// steeper, `~` water, `L` forbidden ground (lava, ash), `H` a house, `B` another building.
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { islandCheckKit } from '../../src/render/models/islandCheckKit';
import {
  type TownPlan,
  groundAt,
  lasting,
  slopeAt,
  townPlan,
  waterAt,
} from '../../src/sim/townPlan';
import { TOWN_RULES } from '../../src/sim/townRules';
import { defaultSeas, islandPlacements } from './check';

const DEFAULT_STEP = 0.02;

function cell(plan: TownPlan, x: number, z: number, step: number): string {
  const building = plan.design.props.find(
    (p) =>
      lasting(p) && plan.kit.types[p.type]?.building && Math.hypot(p.x - x, p.z - z) < step / 2,
  );
  if (building) return plan.kit.types[building.type]?.home ? 'H' : 'B';
  if (waterAt(plan, x, z).depth < 0) return '~';
  if (plan.style.avoid.includes(groundAt(plan, x, z))) return 'L';
  const [warn, fail] = plan.style.slope;
  const { deg } = slopeAt(plan, x, z, step);
  return deg > fail ? '#' : deg > warn ? '+' : '.';
}

/** The rows of the map, the x of every tenth marked on the first. */
export function townGroundMap(id: string, box: number[], step = DEFAULT_STEP): string[] {
  const design = ISLAND_DESIGNS[id];
  const place = islandPlacements(defaultSeas()).get(id);
  if (!design || !place) throw new Error(`no placed island "${id}"`);
  const plan = townPlan(design, islandCheckKit(design, place.R, place.harbour), TOWN_RULES, []);
  if (!plan) throw new Error(`${id} has no houses`);
  const [x0, x1, z0, z1] = box as [number, number, number, number];
  const xs: number[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) xs.push(x);
  const tenth = (x: number) =>
    Math.abs(Math.round(x / step) * step * 10 - Math.round(x * 10)) < 1e-6;
  const head = xs.map((x) => (tenth(x) ? String(Math.abs(Math.round(x * 10)) % 10) : ' ')).join('');
  const rows = [
    `       ${head}  (x tenths; W ${plan.W.toFixed(3)}, slope ${plan.style.slope.join('/')}°)`,
  ];
  for (let z = z0; z <= z1 + 1e-9; z += step)
    rows.push(`${z.toFixed(2).padStart(6)} ${xs.map((x) => cell(plan, x, z, step)).join('')}`);
  return rows;
}
