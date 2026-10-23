// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { designOf } from '../src/data/islands';
import { BeaconLights, beaconFlash } from '../src/render/beaconLights';

const beacons = () =>
  PHASE1_MAP.islands.flatMap((island) =>
    (designOf(island)?.props ?? []).filter((p) => p.type === 'beacon'),
  );

it('flashes in groups of one to three, so neighbouring beacons differ', () => {
  for (const index of [0, 1, 2]) {
    const flashes = index + 1,
      period = 2 + flashes * 2;
    let count = 0;
    let was = false;
    for (let t = 0; t < period; t += 0.05) {
      const lit = beaconFlash(index, t);
      if (lit && !was) count++;
      was = lit;
    }
    // A flash split by the start of the window counts twice at most.
    expect(count).toBeGreaterThanOrEqual(flashes);
    expect(count).toBeLessThanOrEqual(flashes + 1);
  }
});

it('lights the beacons of the island files white at night, dark by day, by variant', () => {
  expect(beacons().length).toBeGreaterThanOrEqual(3);
  const lights = new BeaconLights(PHASE1_MAP.islands);
  const colors = lights.points.geometry.attributes.color!;
  // Unlit day marks (variant 1, Teeth Rock's before its light) have no light.
  const lit = (list: { variant?: number }[]) => list.filter((p) => p.variant !== 1).length;
  expect(colors.count).toBe(lit(beacons()));
  lights.update(0, 0);
  expect(lights.points.visible).toBe(false);
  // Find a moment the first beacon flashes: white light.
  let t = 0;
  while (!beaconFlash(0, t)) t += 0.05;
  lights.update(t, 1);
  expect(lights.points.visible).toBe(true);
  expect(colors.getX(0)).toBeGreaterThan(0.9);
  expect(colors.getZ(0)).toBeGreaterThan(0.7);
  lights.dispose();

  // Variant 1 is an unlit day mark; 2 red and 3 green lateral marks.
  const props = beacons();
  const saved = props.map((p) => p.variant);
  try {
    props[0]!.variant = 1;
    props[1]!.variant = 2;
    props[2]!.variant = 3;
    const marks = new BeaconLights(PHASE1_MAP.islands);
    const c = marks.points.geometry.attributes.color!;
    expect(c.count).toBe(lit(props));
    let red = 0;
    while (!beaconFlash(0, red)) red += 0.05;
    marks.update(red, 1);
    expect(c.getX(0)).toBeGreaterThan(c.getY(0) * 3);
    let green = 0;
    while (!beaconFlash(1, green)) green += 0.05;
    marks.update(green, 1);
    expect(c.getY(1)).toBeGreaterThan(c.getX(1) * 3);
    marks.dispose();
  } finally {
    props.forEach((p, i) => (p.variant = saved[i]));
  }
});

it('keeps a beacon dark until its town level builds it', () => {
  const island = PHASE1_MAP.islands.find((i) =>
    designOf(i)?.props.some((p) => p.type === 'beacon'),
  )!;
  const prop = designOf(island)!.props.find((p) => p.type === 'beacon')!;
  const from = prop.from;
  prop.from = 3;
  try {
    const lights = new BeaconLights(PHASE1_MAP.islands, { [island.id]: 2 });
    const colors = lights.points.geometry.attributes.color!;
    let t = 0;
    while (!beaconFlash(0, t)) t += 0.05;
    lights.update(t, 1);
    expect(colors.getX(0)).toBe(0);
    lights.setLevels({ [island.id]: 3 });
    lights.update(t, 1);
    expect(colors.getX(0)).toBeGreaterThan(0.9);
    lights.dispose();
  } finally {
    prop.from = from;
  }
});
