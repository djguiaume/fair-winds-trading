// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Input } from '../src/input/input';

const pointer = (type: string, init: PointerEventInit) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, ...init });

function rig() {
  const surface = document.createElement('div');
  surface.setPointerCapture = () => {};
  document.body.append(surface);
  const input = new Input(surface);
  const turns: [number, number, string][] = [];
  let resets = 0;
  input.onCameraTurn = (dx, dy, device) => turns.push([dx, dy, device]);
  input.onCameraReset = () => resets++;
  return { surface, input, turns, resets: () => resets };
}

describe('the camera from mouse and touch (decision 0223)', () => {
  it('a right-button drag turns the camera and leaves the rudder alone', () => {
    const { surface, input, turns, resets } = rig();
    const right = { pointerId: 1, pointerType: 'mouse', button: 2 };
    surface.dispatchEvent(pointer('pointerdown', { ...right, clientX: 100, clientY: 100 }));
    surface.dispatchEvent(pointer('pointermove', { ...right, clientX: 130, clientY: 90 }));
    expect(turns).toEqual([[30, -10, 'mouse']]);
    expect(input.steer).toBe(0);
    surface.dispatchEvent(pointer('pointerup', right));
    // A double right-click resets; the browser menu stays shut.
    surface.dispatchEvent(pointer('pointerdown', { ...right, clientX: 100, clientY: 100 }));
    expect(resets()).toBe(1);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    surface.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('a second finger takes the touch from the rudder for the camera', () => {
    const { surface, input, turns } = rig();
    const touch = (id: number, x: number) => ({ pointerId: id, pointerType: 'touch', clientX: x });
    surface.dispatchEvent(pointer('pointerdown', touch(1, 100)));
    surface.dispatchEvent(pointer('pointermove', touch(1, 160)));
    expect(input.steer).toBeGreaterThan(0);
    surface.dispatchEvent(pointer('pointerdown', touch(2, 300)));
    expect(input.steer).toBe(0);
    surface.dispatchEvent(pointer('pointermove', touch(2, 340)));
    expect(turns).toEqual([[20, 0, 'touch']]);
    // The first finger moving no longer steers.
    surface.dispatchEvent(pointer('pointermove', touch(1, 200)));
    expect(input.steer).toBe(0);
  });
});
