import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { screenBearing } from '../src/ui/screenBearing';

// Same perspective, pitch, coordinate conversion and elevation as GameView.project.
function projection() {
  const camera = new PerspectiveCamera(40, 1280 / 720, 1, 600);
  const pitch = (58 * Math.PI) / 180;
  camera.position.set(0, Math.sin(pitch) * 110, Math.cos(pitch) * 110);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return (x: number, y: number) => {
    const p = new Vector3(x, 2, -y).project(camera);
    return {
      x: ((p.x + 1) / 2) * 1280,
      y: ((1 - p.y) / 2) * 720,
      onScreen: p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
    };
  };
}

describe('destination screen bearing', () => {
  it('points south immediately for a far target behind the camera, rather than north', () => {
    const project = projection();
    const boat = { x: 0, y: 0 };
    const target = { x: 0, y: -350 };
    // Reproduce the bug: direct perspective projection puts the southern target above us.
    expect(project(target.x, target.y).y).toBeLessThan(project(0, 0).y);
    expect(Math.cos(screenBearing(project, boat, target))).toBeCloseTo(-1);
  });

  it('keeps bearings in the same quadrant across the camera plane and at all distances', () => {
    const project = projection();
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 1]) {
        for (const scale of [20, 150, 210, 250, 500, 1000]) {
          const angle = screenBearing(project, { x: 0, y: 0 }, { x: x * scale, y: y * scale });
          expect(Math.sign(Math.cos(angle))).toBe(y);
          if (x) expect(Math.sign(Math.sin(angle))).toBe(x);
        }
      }
    }
  });

  it('handles an arrived target and invalid projection without NaN', () => {
    const point = { x: 4, y: 5 };
    expect(screenBearing(projection(), point, point)).toBe(0);
    expect(screenBearing(() => ({ x: NaN, y: NaN, onScreen: false }), point, { x: 8, y: 9 })).toBe(
      0,
    );
  });
});
