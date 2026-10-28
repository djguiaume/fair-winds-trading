import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { PALETTE } from '../../data/props';
import type { TerrainDef } from '../../sim/map';
import { insetOutline } from '../../sim/coast';
import { createRng, range } from '../../sim/rng';
import { type Spot, landmarkRadius, sampleInside } from '../../sim/landmarks';
import { paint } from './geometry';
import { landmarkParts } from './landmarks';
import { type Parts, put } from './props';
import { B2 } from './highlandPalette';
import { tree } from './islandParts';

const CORAL = ['#e08a6a', '#f0a580', '#d9707a'];

/** Detail geometry only, anchored inside the exact solid shoreline. */
export function terrainProps(feature: TerrainDef, seed: number): Parts {
  const parts: Parts = [];
  const ridge = TUNING.terrain.ridge;
  const bank = feature.kind === 'sandbank';
  const reef = feature.kind === 'reef';
  // Decoration stays inside the shore (on barriers, on the grass cap); it cannot narrow passages.
  const area =
    bank || reef
      ? feature.outline
      : insetOutline(feature.outline, ridge.insets[ridge.insets.length - 1]!);
  const rng = createRng(seed);
  const occupied: Spot[] = [];
  const sample = (radius: number) => sampleInside(rng, area, radius, occupied);
  const topY = reef ? 0 : bank ? TUNING.terrain.sandbankTop : ridge.tops[ridge.tops.length - 1]!;
  if (feature.look?.landmark) {
    const s = bank || reef ? 1.15 : 1.8;
    const at = feature.look.landmarkAt;
    const radius = landmarkRadius(feature.look.landmark);
    // A landmark set by hand (decision 0130) keeps its room clear of the seeded details.
    if (at) occupied.push({ ...at, radius });
    const p = at ?? sample(radius);
    if (!p) throw new Error(`Landmark does not fit on ${feature.id}`);
    put(parts, landmarkParts(feature.look.landmark, s), p.x, topY, -p.y, 0.3);
  }
  if (reef) {
    // Rocks and coral heads just awash; the ocean shader paints the shallows and foam around them.
    // A styled reef takes its style's rock and coral colours (an empty `coral` list: none).
    const own = feature.look?.style
      ? (PALETTE.styles[feature.look.style] as { colors?: Record<string, string | string[]> })
          ?.colors
      : undefined;
    const list = (v: string | string[] | undefined) => (v === undefined ? undefined : [v].flat());
    const rocks = list(own?.reefRock) ?? [B2.rock2, B2.rock, B2.rock];
    const coral = list(own?.coral) ?? CORAL;
    for (let i = 0; i < 26; i++) {
      const size = range(rng, 1.1, 2.2);
      const p = sample(size + 1.2);
      if (!p) break;
      parts.push(
        paint(
          new THREE.DodecahedronGeometry(size, 0)
            .scale(1, 0.6, 1)
            .rotateY(rng() * 6)
            .translate(p.x, size * 0.35, -p.y),
          rocks[i % rocks.length]!,
        ),
      );
      if (i % 2 && coral.length) {
        const cone = new THREE.ConeGeometry(0.8, 1.6, 5).translate(
          p.x + size * 0.6,
          0.7,
          -p.y + size * 0.3,
        );
        parts.push(paint(cone, coral[i % coral.length]!));
      }
    }
    return parts;
  }
  if (!bank) {
    // Small terraced outcrops give the long barriers relief like the highland islands.
    for (let i = 0; i < 4; i++) {
      const p = sample(3.4);
      if (!p) break;
      const base = new THREE.CylinderGeometry(2.4, 3.2, 1.7, 7).translate(p.x, topY + 0.85, -p.y);
      parts.push(paint(base, B2.rock));
      parts.push(
        paint(
          new THREE.CylinderGeometry(1.7, 1.8, 0.2, 6).translate(p.x, topY + 1.75, -p.y),
          B2.grass,
        ),
      );
    }
  }
  for (let i = 0; i < (feature.look?.trees ?? 0); i++) {
    const p = sample(2.4);
    if (!p) break;
    put(parts, tree(rng), p.x, topY, -p.y, rng() * 6, 2.3);
  }
  // Rock outcrops, grass tufts and driftwood break up the otherwise flat surfaces.
  for (let i = 0; i < (bank ? 7 : 9); i++) {
    const p = sample(bank ? 1.1 : 2);
    if (!p) break;
    const size = bank ? range(rng, 0.45, 0.85) : range(rng, 1.0, 1.7);
    parts.push(
      paint(
        new THREE.DodecahedronGeometry(size, 0)
          .scale(1, 0.7, 1)
          .translate(p.x, topY + size * 0.35, -p.y),
        i % 2 ? B2.rock : B2.rock2,
      ),
    );
    if (bank) {
      const driftwood = new THREE.BoxGeometry(1.8, 0.25, 0.3)
        .rotateY(rng() * 6)
        .translate(p.x, topY + 0.3, -p.y);
      parts.push(paint(driftwood, B2.logs));
    } else {
      parts.push(
        paint(new THREE.ConeGeometry(0.7, 1.4, 4).translate(p.x, topY + 0.7, -p.y), B2.leaves[1]!),
      );
    }
  }
  return parts;
}
