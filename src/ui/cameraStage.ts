import { TUNING } from '../data/tuning';
import type { CameraRig } from '../render/cameraRig';
import { DEG, approach } from '../sim/math';
import { startAtPrologue } from '../sim/prologue';
import type { World } from '../sim/world';

/** The follow-cam framing the title's live scene is shot in (`camera.json` › `chase.framings`). */
const TITLE_VIEW = 'title';

/**
 * The two moments the camera is placed for the player instead of following their saved view
 * (art bible §13): the live title, with the boat off to the right of the menu column and a slow
 * drift (issue #531), and the first voyage's opening, behind the boat in the morning light until
 * the sails are up (issue #533). The player's own view comes back after both.
 */
export class CameraStage {
  /** The view id placed for the player, or null while their own is in use. */
  private staged: string | null = null;
  private seconds = 0;

  constructor(
    private readonly rig: CameraRig,
    /** The player's saved sailing view. */
    private readonly own: () => string,
    /** Comfort setting: the drift holds still. */
    private readonly still: () => boolean,
  ) {}

  /** The staged view, if any; the saved sailing view must not be overwritten while it shows. */
  get view(): string | null {
    return this.staged;
  }

  /** The live title behind a menu column `share` of the screen wide, or the player's view again. */
  title(on: boolean, share = 0) {
    if (!on) {
      if (this.staged === TITLE_VIEW) this.release();
      return;
    }
    if (this.staged !== TITLE_VIEW) this.stageView(TITLE_VIEW);
    this.rig.stageShift = share / 2;
  }

  /** The first voyage opens in this view; the player's own returns once the sails are up. */
  open(view: string) {
    this.stageView(view);
  }

  /** Every frame; `sailsUp` is true once the sails are raised. */
  update(dt: number, sailsUp: boolean) {
    const chase = this.rig.chase;
    if (this.staged === TITLE_VIEW) chase.drift = this.drift(dt);
    else chase.drift = approach(chase.drift, 0, TUNING.camera.resetRate, dt);
    if (this.staged === null || this.staged === TITLE_VIEW) return;
    // The player took the camera, or the sails went up: the opening is over.
    if (chase.view !== this.staged) this.staged = null;
    else if (sailsUp) this.release();
  }

  /** The player's own view again, the scene sliding back to the middle of the screen. */
  private release() {
    this.staged = null;
    this.rig.stageShift = 0;
    this.rig.chase.view = this.own();
  }

  private stageView(id: string) {
    this.staged = id;
    this.seconds = 0;
    this.rig.stageShift = 0;
    this.rig.chase.view = id;
  }

  /** The title's look round the boat: its pose, swinging slowly either side. */
  private drift(dt: number): number {
    const c = TUNING.camera.title;
    this.seconds += this.still() ? 0 : dt;
    const swing = Math.sin((this.seconds / c.driftPeriodSec) * 2 * Math.PI);
    return (c.yawDeg + (this.still() ? 0 : c.driftDeg * swing)) * DEG;
  }
}

/** A fresh voyage begins at the prologue's place and morning hour, the camera behind her (#533). */
export function beginPrologue(world: World, stage: CameraStage): boolean {
  if (!startAtPrologue(world)) return false;
  const view = world.map.prologue?.opening?.view;
  if (view) stage.open(view);
  return true;
}
