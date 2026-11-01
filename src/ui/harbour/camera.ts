import { TUNING } from '../../data/tuning';
import type { World } from '../../sim/world';

/** The camera's one call the harbour needs (GameView.setFocus). */
interface Focusable {
  setFocus(
    point: { x: number; y: number } | null,
    jump?: boolean,
    shift?: { x: number; y: number },
  ): void;
}

/**
 * The Shipyard keeps the live boat in sight beside its paper (issue #443, round 3 C): the camera
 * looks at her, off centre toward the free side of the screen (`ui.json` › `yardBoatShift`, in
 * screen fractions), and back to following her when the screen leaves the Shipyard.
 */
export function boatBeside(view: Focusable, world: World, beside: boolean) {
  if (!beside) return view.setFocus(null);
  const shift = TUNING.ui.yardBoatShift;
  view.setFocus({ x: world.boat.x, y: world.boat.y }, false, { x: shift, y: 0 });
}
