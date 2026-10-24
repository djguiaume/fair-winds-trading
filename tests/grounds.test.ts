import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GROUNDS, GROUND_IDS, STYLE_IDS, STYLES, groundColors } from '../src/data/grounds';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { PALETTE } from '../src/data/props';
import { applySteps } from '../src/editor/island/steps';
import { designedTownParts, islandCheckKit } from '../src/render/models/towns';
import { checkIsland } from '../src/sim/islandChecks';
import { stepFromArgs } from '../tools/fw/island';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';

const calda = ISLAND_DESIGNS.calda!;
const errors = (d: IslandDesign) =>
  checkIsland(d, islandCheckKit(d, 18))
    .filter((i) => i.severity === 'error')
    .map((i) => i.message);

/** Every vertex colour of an island's terrain, as #rrggbb. */
function terrainColors(design: IslandDesign) {
  const seen = new Set<string>();
  const c = new THREE.Color();
  for (const g of designedTownParts(design, 18, 4)) {
    if (!g.userData.islandTerrain) continue;
    const col = g.attributes.color!;
    for (let i = 0; i < col.count; i++)
      seen.add('#' + c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
  }
  return seen;
}

describe('ground materials and island styles as data (decision 0168)', () => {
  it('every ground and style resolves to colours', () => {
    for (const style of STYLE_IDS)
      for (const id of GROUND_IDS) {
        const g = groundColors(id, style);
        for (const hex of [...g.top, ...g.side, ...g.peak, ...(g.cap ?? [])])
          expect(hex, `${id} on ${style}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    for (const [style, look] of Object.entries(STYLES))
      for (const [from, to] of Object.entries(look.grounds ?? {})) {
        expect(GROUNDS[from], `${style} swaps ${from}`).toBeDefined();
        expect(GROUNDS[to], `${style} swaps to ${to}`).toBeDefined();
      }
  });

  it('keeps the shipped grounds as they were', () => {
    const c = PALETTE.colors as Record<string, string>;
    expect(groundColors('grass', 'timber')).toMatchObject({ top: [c.grass], side: [c.rock] });
    expect(groundColors('rock', 'timber')).toMatchObject({ top: [c.rock2], trees: false });
    // The quarry island's rock is cut stone, its peaks bare rock.
    expect(groundColors('rock', 'stone')).toMatchObject({ top: [c.cut], peak: [c.rock2] });
    expect(groundColors('sand', 'tropic').top).toEqual([c.sand]);
  });

  it('lets a style swap grounds: an ice island is snow, slate and shingle', () => {
    expect(groundColors('grass', 'ice').id).toBe('snow');
    expect(groundColors('rock', 'ice').id).toBe('slate');
    expect(groundColors('sand', 'ice').id).toBe('shingle');
    const ice = { ...structuredClone(calda), style: 'ice' };
    const colors = terrainColors(ice);
    for (const hex of GROUNDS.snow!.top as string[]) expect(colors).toContain(hex);
    expect(colors).not.toContain((PALETTE.colors as Record<string, string>).grass);
  });

  it('checks styles and grounds against the palette', () => {
    expect(errors(calda)).toEqual([]);
    const bad = structuredClone(calda);
    bad.style = 'lunar';
    bad.ground[0]!.material = 'cheese';
    expect(errors(bad)).toEqual(
      expect.arrayContaining(['Unknown style "lunar"', 'Ground 0: unknown material "cheese"']),
    );
    const snowy = structuredClone(calda);
    snowy.ground[0]!.material = 'snow';
    expect(errors(snowy)).toEqual([]);
  });

  it('changes a ground from the command line', () => {
    const d = structuredClone(calda);
    applySteps(d, [
      stepFromArgs('ground', parseArgs(['--material', 'ice', '--height', '0.3']), ['1']),
    ]);
    expect(d.ground[1]).toMatchObject({ material: 'ice', height: 0.3 });
    const peak = stepFromArgs('mountain', parseArgs(['--at=0,-0.3', '--material', 'slate']), []);
    expect(peak).toMatchObject({ do: 'mountain', material: 'slate' });
  });
});
