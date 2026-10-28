import { describe, expect, it } from 'vitest';
import { TouchCamera } from '../src/input/touchCamera';

/** A gesture recorder: the camera turns and pinches it reports. */
function rig() {
  const camera = new TouchCamera();
  const turns: [number, number][] = [];
  const pinches: number[] = [];
  camera.onTurn = (dx, dy) => turns.push([dx, dy]);
  camera.onPinch = (f) => pinches.push(f);
  return { camera, turns, pinches };
}

describe('two fingers turn the camera (decision 0223)', () => {
  it('one finger is not a camera gesture', () => {
    const { camera, turns } = rig();
    expect(camera.down(1, 100, 100)).toBe(false);
    camera.move(1, 140, 100);
    expect(turns).toEqual([]);
  });

  it('two fingers turn by their middle point and zoom by their spread', () => {
    const { camera, turns, pinches } = rig();
    camera.down(1, 100, 100);
    expect(camera.down(2, 200, 100)).toBe(true);
    // Both slide right 20 px: the middle moves 10 px for each finger's move.
    camera.move(1, 120, 100);
    camera.move(2, 220, 100);
    expect(turns).toEqual([
      [10, 0],
      [10, 0],
    ]);
    // The spread changes in between, but the gesture as a whole does not zoom.
    expect(pinches.reduce((a, b) => a * b, 1)).toBeCloseTo(1);
    // Spreading apart zooms in (a factor below 1, like the wheel rolled forward).
    pinches.length = 0;
    camera.move(2, 320, 100);
    expect(pinches[0]).toBeCloseTo(100 / 200);
  });

  it('stays the camera until every finger has lifted', () => {
    const { camera, turns } = rig();
    camera.down(1, 0, 0);
    camera.down(2, 50, 0);
    camera.up(2);
    expect(camera.active).toBe(true);
    camera.move(1, 30, 0);
    expect(turns).toEqual([]);
    camera.up(1);
    expect(camera.active).toBe(false);
    expect(camera.down(3, 0, 0)).toBe(false);
  });
});
