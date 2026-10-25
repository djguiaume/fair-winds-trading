import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SEAS } from '../src/data/grownMap';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { designedTownParts, islandCheckKit, type TownLevel } from '../src/render/models/towns';
import { checkIsland, type IslandIssue } from '../src/sim/islandChecks';

/** The shipped island files with the radius their island has on the map (the Phase 4 seas too). */
const shipped = [...PHASE1_MAP.islands, ...SEAS.flatMap((sea) => sea.islands)]
  .filter((i) => i.look?.design)
  .map((i) => ({
    design: ISLAND_DESIGNS[i.look!.design!]!,
    R: i.radius / 2.2,
    harbour: !!i.look!.dock,
  }));
const calda = shipped.find((s) => s.design.id === 'calda')!;

const errors = (issues: IslandIssue[]) => issues.filter((i) => i.severity === 'error');
/** Issues of a broken copy of Calda. */
function broken(change: (d: IslandDesign) => void, triangles?: number) {
  const design = structuredClone(calda.design);
  change(design);
  const kit = islandCheckKit(design, calda.R);
  if (triangles !== undefined) kit.triangles = () => triangles;
  else delete kit.triangles;
  return checkIsland(design, kit);
}
const checksOf = (issues: IslandIssue[]) => [...new Set(errors(issues).map((i) => i.check))];
const prop = (d: IslandDesign, type: string) => d.props.find((p) => p.type === type)!;

describe('island files (decision 0101)', () => {
  it('every map port with a file uses one of the shipped files', () => {
    expect(shipped.map((s) => s.design.id).sort()).toEqual(Object.keys(ISLAND_DESIGNS).sort());
    for (const { design } of shipped) expect(design.coasts.length).toBeGreaterThan(0);
  });

  it('passes every island check, with only warnings left', () => {
    for (const { design, R, harbour } of shipped) {
      const issues = checkIsland(design, islandCheckKit(design, R, harbour));
      expect(errors(issues), design.id).toEqual([]);
      // Known warnings: lane pieces the old lanes never drew, Calda above 5,000 triangles, and
      // the hidden yards' houses touching as the old shipyard town placed them (0107).
      for (const w of issues) expect(['lanes', 'budget', 'overlap'], w.message).toContain(w.check);
    }
  });

  it('flags broken copies', () => {
    expect(checksOf(broken((d) => (prop(d, 'warehouse').type = 'castle')))).toEqual(['known']);
    expect(checksOf(broken((d) => (prop(d, 'warehouse').from = 5)))).toEqual(['levels']);
    expect(
      checksOf(broken((d) => Object.assign(prop(d, 'warehouse'), { from: 3, to: 2 }))),
    ).toEqual(['levels']);
    expect(checksOf(broken((d) => (d.ground[0]!.material = 'lava' as 'rock')))).toEqual(['known']);
    expect(checksOf(broken((d) => (d.lanes[0]!.kind = 'road' as 'lane')))).toEqual(['known']);
    // A shed out at sea, in the lake, over the plateau's edge and on the arrival lane.
    expect(
      checksOf(broken((d) => Object.assign(prop(d, 'lumber-store'), { x: 0, z: 1.6 }))),
    ).toContain('land');
    expect(
      checksOf(broken((d) => Object.assign(prop(d, 'lumber-store'), { x: -0.65, z: -0.45 }))),
    ).toEqual(['land']);
    expect(
      checksOf(broken((d) => Object.assign(prop(d, 'lumber-store'), { x: -0.35, z: -0.78 }))),
    ).toEqual(['cliff']);
    expect(
      checksOf(broken((d) => Object.assign(prop(d, 'lamp-post'), { x: 0.1, z: 0.6 }))),
    ).toEqual(['approach']);
    // A side pier's crate stack, and a moored boat dragged ashore.
    expect(
      checksOf(
        broken((d) =>
          d.props.push({ type: 'crates', x: -1.05, z: 0.95, from: 4, variant: 2, size: 1 }),
        ),
      ),
    ).toContain('pier');
    expect(
      checksOf(broken((d) => d.props.push({ type: 'moored-boat', x: 0, z: 0, from: 1 }))),
    ).toEqual(['water']);
    // Ground past the coast, a lake on the shore, a home taken away.
    expect(checksOf(broken((d) => d.ground[1]!.outline!.push([0, 3])))).toContain('ground');
    expect(checksOf(broken((d) => d.lake!.push([0, 1.5])))).toContain('ground');
    expect(checksOf(broken((d) => (prop(d, 'cabin').to = 2)))).toEqual(['growth']);
    // Old phones.
    expect(checksOf(broken(() => {}, 6400))).toEqual(['budget']);
    expect(broken(() => {}, 5400).map((i) => i.check)).toContain('budget');
  });

  it('warns about overlapping buildings and props that go with nothing in their place', () => {
    const issues = broken((d) => {
      d.props.push({ type: 'barn', x: -0.05, z: -0.2, from: 3 });
      prop(d, 'lumber-store').to = 3;
    });
    expect(errors(issues)).toEqual([]);
    expect(issues.map((i) => i.check)).toEqual(expect.arrayContaining(['overlap', 'growth']));
  });

  /**
   * Golden hashes of each island's geometry (positions and colours, three decimals) per level.
   * They change only when an island file, a model or the builder changes: when that is
   * deliberate, look at the island, then paste the new values here.
   */
  it('builds the shipped islands exactly as recorded', () => {
    const hashes: Record<string, string[]> = {};
    for (const { design, R, harbour } of shipped)
      hashes[design.id] = ([1, 2, 3, 4] as TownLevel[]).map((level) => {
        const parts = designedTownParts(design, R, level, harbour);
        let h = 0x811c9dc5;
        const mix = (text: string) => {
          for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
        };
        for (const g of parts) {
          for (const name of ['position', 'color']) {
            const a = g.getAttribute(name);
            if (a) mix(Array.from(a.array, (v) => v.toFixed(3)).join(','));
          }
          g.dispose();
        }
        return `${parts.length}:${(h >>> 0).toString(16)}`;
      });
    expect(hashes).toEqual(GOLDEN);
  });
});

const GOLDEN: Record<string, string[]> = {
  calda: ['556:6dc4b4e3', '664:95208427', '731:b682ff4a', '965:5ffb41cc'],
  saltmere: ['246:190f7a6', '421:aa8af177', '641:e4577624', '806:691e8290'],
  // The mason's crane on the quay, after the Stonehaven arc (decision 0133).
  'south-cay': ['205:724e9d0c', '290:e7d2a293', '481:8e548660', '572:db3bbb4e'],
  westholm: ['190:a208a500', '353:c7bb1c18', '628:5c8b49c1', '776:7f7d15db'],
  // Rebuilt from the old generated islands (decision 0107).
  'abbey-head': ['57:d285f975', '85:4cfcecff', '104:adf1a12d', '135:7dd54be1'],
  'bell-rock': Array(4).fill('13:b0dc1251'),
  'greyback-ridge': Array(4).fill('138:a55581aa'),
  'gull-hook': Array(4).fill('134:97942c43'),
  'lantern-rock': Array(4).fill('23:588e8fcb'),
  // The home island (decision 0126): bigger, every building of its spots drawn at once.
  // Teeth Rock (decision 0133): the Stonehaven arc's lighthouse rock.
  'teeth-rock': Array(4).fill('25:593e9317'),
  skerry: ['176:5e30be68', '180:f1a016d7', '183:c8300615', '183:c8300615'],
  'watchman-key': ['43:fbfd2fb9', '73:4bfeb4dd', '92:3e8fc1dd', '99:ac0414a9'],
  // The south sea (decision 0152).
  sunreach: ['606:780ca76b', '739:2be703f5', '842:84de71a', '877:b4741162'],
  'sunreach-south': ['457:f03cd670', '482:cee9291', '491:b2dd7f07', '491:b2dd7f07'],
  'palm-key': ['296:5af31071', '270:7e77b63a', '266:18f30d17', '266:18f30d17'],
  'lone-palm': Array(4).fill('13:2bd589f4'),
  // The east sea (decision 0173).
  fogwatch: ['627:8aecde02', '748:5c1fb58b', '820:1802c667', '861:600bb021'],
  'the-giant': Array(4).fill('6:bb1431f9'),
  'his-wife': Array(4).fill('6:ccc0f0d7'),
  'amber-strand': ['129:e66b7b39', '133:56673594', '136:e68e96ec', '136:e68e96ec'],
  'puffin-holm': Array(4).fill('8:9eada24b'),
  'lamb-holm': Array(4).fill('17:2a66e241'),
  'broch-isle': Array(4).fill('14:c3697752'),
};
