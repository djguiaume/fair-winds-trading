import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SEAS } from '../src/data/grownMap';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { designedTownParts, type TownLevel } from '../src/render/models/towns';
import { islandCheckKit } from '../src/render/models/islandCheckKit';
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
      // The town rules (issue #513): the hard rules are clean and fail as errors. The village
      // checks (#528, 0306) find v1.9's grids as warnings until the v1.10 town parts redo them.
      const known = ['lanes', 'budget', 'overlap', 'town-grid', 'town-centre', 'town-lanes'];
      for (const w of issues) expect(known, w.message).toContain(w.check);
    }
    // Every file builds its ground at each settlement level for the coast and footing checks.
  }, 30000);

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
    expect(checksOf(broken(() => {}, 8900))).toEqual(['budget']);
    expect(broken(() => {}, 7400).map((i) => i.check)).toContain('budget');
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
        // The plain homes only: the rich ones have their own tests (issue #500).
        const parts = designedTownParts(design, R, level, harbour).filter(
          (g) => g.userData.house !== 'rich',
        );
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
  }, 30_000);
});

const GOLDEN: Record<string, string[]> = {
  calda: ['531:fdb015f0', '709:584e6a1', '858:2a8890ba', '969:8b1b74c'],
  saltmere: ['300:1528dbef', '452:3862386b', '650:b4dc9fcb', '827:e2e9ce5d'],
  westholm: ['247:bf2e80a4', '451:ee6df58a', '639:331e99d', '760:deeb6af1'],
  'south-cay': ['234:8161a42a', '353:209396ea', '478:33cc9f05', '654:cb802c39'],
  skerry: ['246:cc0b40d7', '250:4172fa2e', '253:7967dea8', '253:7967dea8'],
  'bell-rock': ['13:149f2ca0', '13:149f2ca0', '13:149f2ca0', '13:149f2ca0'],
  'abbey-head': ['53:5030ad49', '103:7ab06af0', '148:4382b111', '190:606886e0'],
  'watchman-key': ['75:c046ccbc', '105:eb852209', '153:14f0d465', '160:cb545d09'],
  'lantern-rock': ['23:33c034ce', '23:33c034ce', '23:33c034ce', '23:33c034ce'],
  'greyback-ridge': ['121:d8b1afe4', '121:d8b1afe4', '121:d8b1afe4', '121:d8b1afe4'],
  'gull-hook': ['130:ca8ed3fd', '130:ca8ed3fd', '130:ca8ed3fd', '130:ca8ed3fd'],
  'teeth-rock': ['25:d7a4208f', '25:d7a4208f', '25:d7a4208f', '25:d7a4208f'],
  sunreach: ['618:3de89490', '710:f161ca55', '815:e663054d', '857:f19ab217'],
  'sunreach-south': ['497:12f8e4bb', '510:968b72a3', '519:ed6d802b', '519:ed6d802b'],
  'palm-key': ['326:813f618b', '315:e338c3ce', '344:424727a8', '344:424727a8'],
  'lone-palm': ['19:56b2c2', '19:56b2c2', '19:56b2c2', '19:56b2c2'],
  'two-palms': ['23:a6ed5ed', '23:a6ed5ed', '23:a6ed5ed', '23:a6ed5ed'],
  emberhold: ['453:40196d00', '560:cb0b5dd4', '641:19e3738a', '682:6c1943a7'],
  'the-smoulder': ['161:afbe8b23', '161:afbe8b23', '161:afbe8b23', '161:afbe8b23'],
  'organ-pipes': ['89:ef4e83bf', '89:ef4e83bf', '89:ef4e83bf', '89:ef4e83bf'],
  'cinder-isle': ['121:6f15c313', '158:deb7ad5c', '183:7fa9a6a4', '183:7fa9a6a4'],
  'steam-holm': ['35:f930960c', '35:f930960c', '35:f930960c', '35:f930960c'],
  'spark-rock': ['18:b3591ec5', '18:b3591ec5', '18:b3591ec5', '18:b3591ec5'],
  'the-chimneys': ['13:6d3cc715', '13:6d3cc715', '13:6d3cc715', '13:6d3cc715'],
  'the-chimneys-2': ['7:b1a0088d', '7:b1a0088d', '7:b1a0088d', '7:b1a0088d'],
  'the-tongs': ['7:78575b7d', '7:78575b7d', '7:78575b7d', '7:78575b7d'],
  'the-tongs-2': ['7:cbe478f3', '7:cbe478f3', '7:cbe478f3', '7:cbe478f3'],
  fogwatch: ['482:54da98bc', '567:2465cb95', '654:17e8f694', '701:7794e3ea'],
  'the-giant': ['6:c84f56e6', '6:c84f56e6', '6:c84f56e6', '6:c84f56e6'],
  'his-wife': ['6:676eecc4', '6:676eecc4', '6:676eecc4', '6:676eecc4'],
  'amber-strand': ['303:6d394689', '363:c4f45c49', '417:336c430e', '417:336c430e'],
  'puffin-holm': ['8:3ff49b4c', '8:3ff49b4c', '8:3ff49b4c', '8:3ff49b4c'],
  'lamb-holm': ['17:85293a40', '17:85293a40', '17:85293a40', '17:85293a40'],
  'broch-isle': ['16:4157b50d', '16:4157b50d', '16:4157b50d', '16:4157b50d'],
  'the-kittiwakes': ['56:f643c38e', '56:f643c38e', '56:f643c38e', '56:f643c38e'],
  'sandwick-holm': ['27:bf85bc6f', '27:bf85bc6f', '27:bf85bc6f', '27:bf85bc6f'],
  rimewick: ['471:a7b2e06f', '586:b01e95b7', '634:601cd5fe', '642:d48b659f'],
  'snowberry-isle': ['255:4d12a2bc', '353:84c38d07', '448:8e02a87c', '448:8e02a87c'],
  whitefell: ['17:90d719e7', '17:90d719e7', '17:90d719e7', '17:90d719e7'],
  'lead-rock': ['22:566ea91e', '22:566ea91e', '22:566ea91e', '22:566ea91e'],
  'cairn-holm': ['9:86e5a65a', '9:86e5a65a', '9:86e5a65a', '9:86e5a65a'],
  'seal-rocks': ['22:8d9a9e5c', '22:8d9a9e5c', '22:8d9a9e5c', '22:8d9a9e5c'],
  'selkie-rock': ['26:c7676022', '26:c7676022', '26:c7676022', '26:c7676022'],
  'old-blue': ['8:57804bba', '8:57804bba', '8:57804bba', '8:57804bba'],
};
