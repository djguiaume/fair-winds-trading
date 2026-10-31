import { TUNING } from '../data/tuning';
import { formatNumber, t } from '../i18n';
import { seaDragAt } from '../sim/seaDrag';
import type { World } from '../sim/world';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
}

/** The HUD's lines about the water she sails through: the current and the waves. */
export class SeaLines {
  /** Speed over the ground and the current, shown only while in a current (decision 0140). */
  private readonly sogBox = byId('log-sog');
  private readonly sog = byId('sog');
  private readonly currentText = byId('current-text');
  private readonly dragText = document.createElement('span');

  constructor() {
    this.dragText.className = 'weather-text';
    // A footnote to the wind (art director, #284): one step dimmer than it.
    this.dragText.style.color = 'var(--ink-dim)';
    this.dragText.hidden = true;
    this.currentText.after(this.dragText);
  }

  /** Both lines for this frame; `compassPoint` names a direction as the rest of the HUD does. */
  show(world: World, showLog: boolean, compassPoint: (rad: number) => string) {
    this.showCurrent(world, showLog, compassPoint);
    this.showWaves(world);
  }

  /**
   * In a current (decision 0140): SOG under the speed and "Current 1.8 kn E" (where it flows)
   * under the wind. Both go with the log's eye toggle, and away in still water.
   */
  private showCurrent(world: World, showLog: boolean, compassPoint: (rad: number) => string) {
    const { water, sogKn } = world;
    const kn = Math.hypot(water.east, water.north);
    const shown = showLog && !!water.id && kn >= 0.2;
    this.sogBox.hidden = !shown;
    this.currentText.hidden = !shown;
    if (!shown) return;
    this.sog.textContent = `${formatNumber(sogKn, 1)} ${t('unit.knots')}`;
    this.currentText.textContent = t('hud.current', {
      n: formatNumber(kn, 1),
      dir: compassPoint(Math.atan2(water.east, water.north)),
    });
  }

  /**
   * "Waves −4%" under the wind once the sea takes that much off her speed (decision 0256), only
   * while she makes way under sail: in irons or alongside there is nothing to slow.
   */
  private showWaves(world: World) {
    const { boat } = world;
    const drag = seaDragAt(world, boat, world.ship);
    const shown = drag >= TUNING.waves.drag.hudAt && boat.sail > 0 && boat.speedKn >= 1;
    const pc = shown ? Math.round(drag * 100) : 0;
    if (this.dragText.dataset.pc === String(pc)) return;
    this.dragText.dataset.pc = String(pc);
    this.dragText.hidden = !shown;
    if (shown) this.dragText.textContent = t('hud.seaDrag', { n: pc });
  }
}
