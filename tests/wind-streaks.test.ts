import * as THREE from 'three';
import { expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { WindStreaks } from '../src/render/windStreaks';
import { NORTH_UP } from '../src/render/cameraOrbit';

/** Each streak's far-end alpha and its centre's distance from `eye`. */
function streaks(w: WindStreaks, eye: THREE.Vector3) {
  const geometry = w.mesh.geometry;
  const pos = geometry.getAttribute('position');
  const col = geometry.getAttribute('color');
  const out: { alpha: number; distance: number; y: number }[] = [];
  for (let v = 0; v < pos.count; v += 4) {
    const x = (pos.getX(v) + pos.getX(v + 3)) / 2;
    const z = (pos.getZ(v) + pos.getZ(v + 3)) / 2;
    out.push({
      alpha: col.getW(v + 2),
      distance: Math.hypot(x - eye.x, z - eye.z),
      y: pos.getY(v),
    });
  }
  return out;
}

it('keeps the streaks off the follow cam and as before from above (issue #540)', () => {
  const centre = new THREE.Vector3();
  const eye = new THREE.Vector3(0, 6, 30);
  const low = TUNING.graphics.windStreaks.chase;
  const top = new WindStreaks(90);
  top.update(1, centre, 1, 0, 10, 1);
  const chase = new WindStreaks(90);
  chase.update(1, centre, 1, 0, 10, 1, { axes: NORTH_UP, eye, low: 1 });
  const seen = streaks(top, eye);
  const followed = streaks(chase, eye);
  // From above nothing changes with the eye; some streaks near it show.
  expect(seen.some((s) => s.distance < low.fadeFrom && s.alpha > 0)).toBe(true);
  expect(seen[0]!.y).toBeCloseTo(TUNING.graphics.windStreaks.lift);
  // In the follow cam none shows within `fadeFrom`, and they lie lower, on the water.
  for (const s of followed) if (s.distance < low.fadeFrom) expect(s.alpha).toBe(0);
  expect(followed.some((s) => s.alpha > 0)).toBe(true);
  expect(followed[0]!.y).toBeCloseTo(low.lift);
  top.dispose();
  chase.dispose();
});
