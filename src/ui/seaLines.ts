import { TUNING } from '../data/tuning';
import { formatNumber, t } from '../i18n';
import { seaDragAt } from '../sim/seaDrag';
import type { World } from '../sim/world';
import { compassPoint, setHidden, setText } from './hud/parts';

/** The HUD's lines about the water she sails through: the current and the waves. */
export class SeaLines {
  private readonly currentText = document.createElement('span');
  private readonly dragText = document.createElement('span');
  private shownDrag = -1;

  /**
   * `lines`: the wind compass's lines, which these join; `showSog` puts her speed over the
   * ground on the instrument (null hides it).
   */
  constructor(
    lines: HTMLElement,
    private readonly showSog: (text: string | null) => void,
  ) {
    this.currentText.id = 'current-text';
    this.currentText.className = 'hud-line';
    // A footnote to the wind (art director, #284): one step dimmer than it.
    this.dragText.className = 'hud-line is-dim';
    this.currentText.hidden = this.dragText.hidden = true;
    lines.append(this.currentText, this.dragText);
  }

  /** Both lines, about eight times a second. */
  show(world: World) {
    this.showCurrent(world);
    this.showWaves(world);
  }

  /**
   * In a current (decision 0140): her speed over the ground on the instrument and "Current 1.8 kn
   * E" (where it flows) under the wind; both away in still water.
   */
  private showCurrent(world: World) {
    const { water, sogKn } = world;
    const kn = Math.hypot(water.east, water.north);
    const shown = !!water.id && kn >= 0.2;
    setHidden(this.currentText, !shown);
    this.showSog(shown ? `${formatNumber(sogKn, 1)} ${t('unit.knots')}` : null);
    if (!shown) return;
    setText(
      this.currentText,
      t('hud.current', {
        n: formatNumber(kn, 1),
        dir: compassPoint(Math.atan2(water.east, water.north)),
      }),
    );
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
    if (pc === this.shownDrag) return;
    this.shownDrag = pc;
    setHidden(this.dragText, !shown);
    if (shown) this.dragText.textContent = t('hud.seaDrag', { n: pc });
  }
}
