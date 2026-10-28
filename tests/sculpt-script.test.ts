import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, type IslandDesign } from '../src/data/islands';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import { designHeightfield } from '../src/sim/heightfield';
import { sculptProblems } from '../src/sim/sculpt';
import {
  type SculptCommand,
  type SculptStroke,
  applySculpt,
  parseSculpt,
} from '../src/sim/sculptScript';
import { SculptSession } from '../src/sim/sculptSession';
import { sculptCall } from '../tools/fw/islandSculpt';
// @ts-expect-error plain JavaScript module without types
import { parseArgs } from '../tools/fw/lib.mjs';

const calda = GAME_MAP.islands.find((i) => i.look?.design === 'calda')!;
const plain = ISLAND_DESIGNS.calda!;
const fresh = (): IslandDesign => structuredClone(plain);

/** An open spot of Calda's frame, away from every building. */
const AT: [number, number] = [-0.55, -0.35];
const strokes: SculptStroke[] = [
  { do: 'sculpt', op: 'raise', at: [AT, [AT[0] + 0.05, AT[1]]], radius: 0.12, strength: 0.4 },
  { do: 'sculpt', op: 'flatten', at: [AT], radius: 0.08, strength: 0.9, height: 3, falloff: 0.2 },
  { do: 'sculpt', op: 'smooth', at: [AT], radius: 0.1, strength: 0.5 },
  {
    do: 'sculpt',
    op: 'slope',
    at: [
      [AT[0], AT[1] + 0.1, 1],
      [AT[0] + 0.2, AT[1] + 0.1, 2],
    ],
    radius: 0.05,
    strength: 1,
  },
];

describe('sculpting as commands (decision 0153)', () => {
  it('saves the same edits and ground as the builder’s brushes, undo and redo included', () => {
    // The builder: a dragged brush per stroke, a cancelled drag, an undone one redone.
    const s = new SculptSession(calda, plain);
    for (const { at, op, radius, strength, falloff, height } of strokes) {
      s.begin({
        op,
        radius,
        strength,
        falloff: falloff ?? TUNING.terrain.sculpt.falloff,
        ...(height !== undefined && { height }),
      });
      for (const [x, z, h] of at) s.dab(x!, z!, h);
      s.commit();
    }
    s.begin({ op: 'lower', radius: 0.1, strength: 1, falloff: 0.5 });
    s.dab(...AT);
    s.cancel();
    s.undo();
    s.redo();

    const design = fresh();
    const made = applySculpt(calda, design, strokes);
    expect(made).toEqual(['raise 1', 'flatten 2', 'smooth 3', 'slope 4']);
    expect(design.sculpt).toEqual(s.sculpt);
    expect(designHeightfield(calda, design).heights).toEqual(s.field.heights);
  });

  it('is the same terrain in one call or in several saved in between', () => {
    const once = fresh();
    applySculpt(calda, once, strokes);
    const twice = fresh();
    applySculpt(calda, twice, strokes.slice(0, 2));
    applySculpt(calda, twice, strokes.slice(2));
    expect(twice.sculpt).toEqual(once.sculpt);
  });

  it('exports and imports to the same file, and lists, removes and resets edits', () => {
    const design = fresh();
    applySculpt(calda, design, strokes);
    const exported = JSON.parse(JSON.stringify(design.sculpt));
    expect(parseSculpt(exported)).toEqual(design.sculpt);

    const other = fresh();
    applySculpt(calda, other, [{ do: 'sculpt-import', sculpt: exported }]);
    expect(other.sculpt).toEqual(design.sculpt);

    applySculpt(calda, other, [{ do: 'sculpt-import', sculpt: exported, append: true }]);
    expect(other.sculpt!.edits).toHaveLength(8);
    applySculpt(calda, other, [
      { do: 'unsculpt', index: 8 },
      { do: 'unsculpt', index: 7 },
    ]);
    expect(other.sculpt!.edits).toHaveLength(6);
    applySculpt(calda, other, [{ do: 'unsculpt' }]);
    expect(other.sculpt).toBeUndefined();
  });

  it('leaves the file as it was when a command fails', () => {
    const design = fresh();
    const bad: SculptCommand[] = [strokes[0]!, { ...strokes[1]!, at: [[Number.NaN, 0]] }];
    expect(() => applySculpt(calda, design, bad)).toThrow(/numbers/);
    expect(design.sculpt).toBeUndefined();
    expect(() => applySculpt(calda, design, [{ do: 'unsculpt', index: 1 }])).toThrow(
      /no sculpt edit 1/,
    );
  });

  it('refuses malformed, non-finite, oversized and future edits with the reason', () => {
    const edit = { op: 'raise', points: [[0, 0]], radius: 0.1, strength: 1, falloff: 0.5 };
    const file = (e: unknown[], version = 1) => ({ version, edits: e });
    const { limits } = TUNING.terrain.sculpt;
    expect(parseSculpt(file([edit]))).toEqual(file([edit]));
    expect(() => parseSculpt(null)).toThrow(/object/);
    expect(() => parseSculpt({ version: 1 })).toThrow(/edits list/);
    expect(() => parseSculpt(file([], 2))).toThrow(/version 2 is not this game's \(1\)/);
    expect(() => parseSculpt(file([{ ...edit, op: 'melt' }]))).toThrow(/edit 1: unknown operation/);
    expect(() => parseSculpt(file([{ ...edit, strength: null }] as never))).toThrow(/strength/);
    expect(() => parseSculpt(file([{ ...edit, points: [[0, null]] }]))).toThrow(/numbers/);
    expect(() => parseSculpt(file([{ ...edit, points: [] }]))).toThrow(/no points/);
    expect(() => parseSculpt(file([{ ...edit, radius: limits.radius + 1 }]))).toThrow(/radius/);
    expect(() => parseSculpt(file([{ ...edit, points: [[limits.reach + 1, 0]] }]))).toThrow(
      /further/,
    );
    const many = Array.from({ length: limits.points + 1 }, () => [0, 0]);
    expect(() => parseSculpt(file([{ ...edit, points: many }]))).toThrow(/over the limit/);
    expect(
      sculptProblems(file(Array.from({ length: limits.edits + 1 }, () => edit)) as never)[0],
    ).toMatch(/over the limit/);
  });

  it('reads the command line', () => {
    const call = (line: string) => {
      const args = parseArgs(line.split(' '));
      return sculptCall(args, args._.slice(2));
    };
    expect(
      call('hill sculpt raise --at -0.4,-0.3;-0.3,-0.2 --brush 0.25 --strength 1.5 --override'),
    ).toEqual({
      command: {
        do: 'sculpt',
        op: 'raise',
        at: [
          [-0.4, -0.3],
          [-0.3, -0.2],
        ],
        radius: 0.25,
        strength: 1.5,
        override: true,
      },
    });
    expect(
      call('hill sculpt slope --from 0,0,1 --to 0.2,0,2 --brush 0.1 --strength 1'),
    ).toMatchObject({
      command: {
        op: 'slope',
        at: [
          [0, 0, 1],
          [0.2, 0, 2],
        ],
      },
    });
    expect(call('hill sculpt remove 2')).toEqual({ command: { do: 'unsculpt', index: 2 } });
    expect(call('hill sculpt list')).toEqual({ report: 'list' });
    expect(() => call('hill sculpt flatten --at 0,0 --brush 0.1 --strength 1')).toThrow(/--height/);
    expect(() => call('hill sculpt raise --at 0,0 --strength 1')).toThrow(/--brush/);
    expect(() => call('hill sculpt slope --from 0,0 --to 1,1 --brush 1 --strength 1')).toThrow(
      /height/,
    );
    expect(() => call('hill sculpt melt')).toThrow(/needs raise/);
  });

  it('imports a file written by export, or a whole island file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sculpt-'));
    const design = fresh();
    applySculpt(calda, design, strokes);
    writeFileSync(join(dir, 'a.json'), JSON.stringify(design.sculpt));
    writeFileSync(join(dir, 'b.json'), JSON.stringify(design));
    for (const name of ['a.json', 'b.json']) {
      const call = sculptCall({ _: [] } as never, ['import', join(dir, name)]);
      expect(call).toMatchObject({ command: { do: 'sculpt-import', sculpt: design.sculpt } });
    }
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).toContain('"version":1');
  });
});
