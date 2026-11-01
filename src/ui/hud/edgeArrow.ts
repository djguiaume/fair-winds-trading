import type { ScreenPoint } from '../../render/view';
import type { Vec2 } from '../../sim/math';
import { screenBearing } from '../screenBearing';
import { SHIPPED_THEME } from '../theme/model';
import { isPhoneLayout } from './bands';
import { setHidden } from './parts';

/** Room kept from the screen's sides, and under the instrument at the bottom. */
const MARGIN = 34;
const BOTTOM_ROOM = { desktop: 150, phone: 110 };

/**
 * An arrow at the edge of the screen toward her course while it is off screen (`#wp-arrow`): it
 * sits where the line from the boat would leave the screen and points along it.
 */
export class EdgeArrow {
  private readonly turn: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    this.turn = root.firstElementChild as HTMLElement;
  }

  update(
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
    boat: Vec2,
    course: Vec2 | null,
  ) {
    const s = course ? project(course.x, course.y) : null;
    setHidden(this.root, !s || s.onScreen);
    if (!course || !s || s.onScreen) return;
    const angle = screenBearing(project, boat, course);
    // Clear of the wind compass at the top and the instrument at the bottom.
    const phone = isPhoneLayout();
    const hud = SHIPPED_THEME.hud;
    const top = (phone ? hud['compass-phone']! : hud.compass!) + 24;
    const bottom = phone ? BOTTOM_ROOM.phone : BOTTOM_ROOM.desktop;
    const cx = size.w / 2;
    const cy = (top + size.h - bottom) / 2;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const k = Math.min(
      (cx - MARGIN) / Math.abs(dx || 1e-6),
      (size.h - bottom - top) / 2 / Math.abs(dy || 1e-6),
    );
    this.root.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px)`;
    this.turn.style.transform = `rotate(${angle}rad)`;
  }
}
