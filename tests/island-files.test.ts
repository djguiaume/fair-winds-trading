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
  saltmere: ['333:5c55ea16', '488:cc18251a', '692:a24ad0f5', '875:2af95e35'],
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
  sunreach: ['622:e0cb2358', '727:1564c7ec', '826:5128fa68', '880:9e309d0f'],
  'sunreach-south': ['509:e7632bb9', '525:52bc07f5', '534:5ee7e11', '534:5ee7e11'],
  'palm-key': ['344:2c2584d7', '338:a73f7c2', '367:d97bb82e', '367:d97bb82e'],
  'lone-palm': ['19:56b2c2', '19:56b2c2', '19:56b2c2', '19:56b2c2'],
  'two-palms': ['23:a6ed5ed', '23:a6ed5ed', '23:a6ed5ed', '23:a6ed5ed'],
  emberhold: ['467:f3e836fc', '578:7a97bda3', '658:a085c7d4', '699:b048ed77'],
  'the-smoulder': ['161:afbe8b23', '161:afbe8b23', '161:afbe8b23', '161:afbe8b23'],
  'organ-pipes': ['89:ef4e83bf', '89:ef4e83bf', '89:ef4e83bf', '89:ef4e83bf'],
  'cinder-isle': ['139:6c5fc1bf', '178:ae415ed7', '201:3db72fc8', '201:3db72fc8'],
  'steam-holm': ['35:f930960c', '35:f930960c', '35:f930960c', '35:f930960c'],
  'spark-rock': ['18:b3591ec5', '18:b3591ec5', '18:b3591ec5', '18:b3591ec5'],
  'the-chimneys': ['13:6d3cc715', '13:6d3cc715', '13:6d3cc715', '13:6d3cc715'],
  'the-chimneys-2': ['7:b1a0088d', '7:b1a0088d', '7:b1a0088d', '7:b1a0088d'],
  'the-tongs': ['7:78575b7d', '7:78575b7d', '7:78575b7d', '7:78575b7d'],
  'the-tongs-2': ['7:cbe478f3', '7:cbe478f3', '7:cbe478f3', '7:cbe478f3'],
  fogwatch: ['504:15ef9570', '576:d46a5f0f', '655:155a5995', '699:ad4a0096'],
  'the-giant': ['6:c84f56e6', '6:c84f56e6', '6:c84f56e6', '6:c84f56e6'],
  'his-wife': ['6:676eecc4', '6:676eecc4', '6:676eecc4', '6:676eecc4'],
  'amber-strand': ['309:8dad7d39', '369:136979e0', '423:fa4c438c', '423:fa4c438c'],
  'puffin-holm': ['8:3ff49b4c', '8:3ff49b4c', '8:3ff49b4c', '8:3ff49b4c'],
  'lamb-holm': ['17:85293a40', '17:85293a40', '17:85293a40', '17:85293a40'],
  'broch-isle': ['16:4157b50d', '16:4157b50d', '16:4157b50d', '16:4157b50d'],
  'the-kittiwakes': ['56:f643c38e', '56:f643c38e', '56:f643c38e', '56:f643c38e'],
  'sandwick-holm': ['27:bf85bc6f', '27:bf85bc6f', '27:bf85bc6f', '27:bf85bc6f'],
  rimewick: ['470:1b73d32d', '582:bb1be7fe', '626:a98ebfb4', '639:182d47b0'],
  'snowberry-isle': ['255:70ef111', '356:ae91cf0e', '451:5dafc2b5', '451:5dafc2b5'],
  whitefell: ['17:90d719e7', '17:90d719e7', '17:90d719e7', '17:90d719e7'],
  'lead-rock': ['22:566ea91e', '22:566ea91e', '22:566ea91e', '22:566ea91e'],
  'cairn-holm': ['9:86e5a65a', '9:86e5a65a', '9:86e5a65a', '9:86e5a65a'],
  'seal-rocks': ['22:8d9a9e5c', '22:8d9a9e5c', '22:8d9a9e5c', '22:8d9a9e5c'],
  'selkie-rock': ['26:c7676022', '26:c7676022', '26:c7676022', '26:c7676022'],
  'old-blue': ['8:57804bba', '8:57804bba', '8:57804bba', '8:57804bba'],
};
