import { SAIL_STEPS, trueWindAngle } from '../sim/boat';
import { DEG, bearingTo, distance, wrapPositive } from '../sim/math';
import { type PointOfSail, pointOfSail } from '../sim/ship';
import { windTo } from '../sim/wind';
import { type World, type WorldEvent, currentWaypoint } from '../sim/world';
import type { ScreenPoint } from '../render/view';

const POINT_OF_SAIL: Record<PointOfSail, { text: string; tone: '' | 'good' | 'bad' }> = {
  'in-irons': { text: 'In irons! Turn away', tone: 'bad' },
  'close-hauled': { text: 'Close-hauled', tone: '' },
  'beam-reach': { text: 'Beam reach', tone: 'good' },
  'broad-reach': { text: 'Broad reach', tone: 'good' },
  running: { text: 'Running', tone: '' },
};

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
}

function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-DOM heads-up display (Phase 0; Preact panels arrive with trading in Phase 1). */
export class Hud {
  private readonly speed = $('speed');
  private readonly pos = $('point-of-sail');
  private readonly pips = Array.from(document.querySelectorAll<HTMLElement>('.sail-pips i'));
  private readonly objName = $('obj-name');
  private readonly objDist = $('obj-dist');
  private readonly windText = $('wind-text');
  private readonly cNoGo = $('c-nogo');
  private readonly cWind = $('c-wind');
  private readonly cBoat = $('c-boat');
  private readonly cWp = $('c-wp');
  private readonly wpArrow = $('wp-arrow');
  private readonly toast = $('toast');
  private readonly tiller = $('tiller');
  private readonly fps = $('fps');
  private toastTimer = 0;
  private sinceText = 1;
  private ironsTime = 0;
  private lastIronsTip = -Infinity;

  constructor(private readonly world: World) {}

  showToast(text: string, seconds = 2.5) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    this.toastTimer = seconds;
  }

  handleEvents(events: WorldEvent[]) {
    for (const e of events) {
      if (e.type === 'waypoint') {
        this.showToast(`${e.label} reached in ${formatTime(e.seconds)}! Next: ${e.next}`, 3.5);
      } else if (e.type === 'bump' && this.toastTimer <= 0) {
        this.showToast('Bump! Mind the shore', 1.2);
      }
    }
  }

  setTiller(drag: { x: number; y: number; steer: number } | null) {
    this.tiller.hidden = !drag;
    if (!drag) return;
    this.tiller.style.transform = `translate(${drag.x}px, ${drag.y}px)`;
    (this.tiller.firstElementChild as HTMLElement).style.transform =
      `translateX(${drag.steer * 60}px)`;
  }

  setFps(fps: number | null) {
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = `${fps.toFixed(0)} fps`;
  }

  /** `project` maps a sim position to screen pixels; `size` is the viewport. */
  update(
    dt: number,
    project: (x: number, y: number) => ScreenPoint,
    size: { w: number; h: number },
  ) {
    const { boat, wind, ship } = this.world;
    const wp = currentWaypoint(this.world);

    // Rotations every frame (cheap attribute writes), text ~8 times a second.
    const rot = (el: HTMLElement, rad: number) =>
      el.setAttribute('transform', `rotate(${(rad / DEG).toFixed(1)})`);
    rot(this.cNoGo, wind.from);
    rot(this.cWind, windTo(wind));
    rot(this.cBoat, boat.heading);
    rot(this.cWp, bearingTo(boat, wp));

    const twa = trueWindAngle(boat.heading, wind);
    const irons = Math.abs(twa) < ship.noGoAngle;
    this.ironsTime = irons ? this.ironsTime + dt : 0;
    if (this.ironsTime > 2 && this.world.time - this.lastIronsTip > 25) {
      this.lastIronsTip = this.world.time;
      this.showToast(
        'You can’t sail straight into the wind. Turn away, then zigzag (tack) upwind.',
        4.5,
      );
    }

    this.sinceText += dt;
    if (this.sinceText > 0.12) {
      this.sinceText = 0;
      this.speed.textContent = boat.speedKn.toFixed(1);
      const p = POINT_OF_SAIL[pointOfSail(ship, twa)];
      this.pos.textContent = boat.sail < 0.05 && !irons ? 'Sails down' : p.text;
      this.pos.className = `pos ${p.tone}`;
      const step = SAIL_STEPS[boat.sailStep] ?? 0;
      this.pips.forEach((pip, i) => pip.classList.toggle('on', step >= (i + 1) / this.pips.length));
      this.objName.textContent = wp.label;
      this.objDist.textContent = `${Math.round(distance(boat, wp))} m`;
      const fromDir = COMPASS[Math.round(wrapPositive(wind.from) / (Math.PI / 4)) % 8];
      this.windText.textContent = `${fromDir} · ${wind.speedKn.toFixed(0)} kn`;
    }

    // Arrow at the screen edge when the buoy is off-screen.
    const s = project(wp.x, wp.y);
    this.wpArrow.hidden = s.onScreen;
    if (!s.onScreen) {
      const cx = size.w / 2;
      const cy = size.h / 2;
      const b = project(boat.x, boat.y);
      let dx = s.x - b.x;
      let dy = s.y - b.y;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) [dx, dy] = [0, -1];
      const margin = 34;
      const k = Math.min(
        (cx - margin) / Math.abs(dx || 1e-6),
        (cy - margin - 60) / Math.abs(dy || 1e-6),
      );
      const ang = Math.atan2(dx, -dy);
      this.wpArrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px)`;
      (this.wpArrow.firstElementChild as HTMLElement).style.transform = `rotate(${ang}rad)`;
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.hidden = true;
    }
  }
}
