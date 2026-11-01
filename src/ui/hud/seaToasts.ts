import { type MessageKey, goodName, t, tOptional, zoneKindName } from '../../i18n';
import { hullCondition } from '../../sim/hazards';
import type { World, WorldEvent } from '../../sim/world';
import { type HazardKind, hazardBadge } from '../hazardMarker';
import { compassWords } from './parts';
import { zoneName } from './windLines';

function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const CRASH_TEXT: Record<string, MessageKey> = {
  pier: 'toast.crashPier',
  boat: 'toast.crashBoat',
  ice: 'toast.crashIce',
};

/**
 * The one line of news at sea (`#toast`): what just happened, said once, then gone. Hazard
 * warnings carry the chart's badge (decision 0070); first meetings with a current or a storm belt
 * give their one-time hint (decisions 0140 and 0167).
 */
export class SeaToasts {
  private left = 0;
  /** The first current's hint was shown; main.ts keeps it in the settings. */
  seenCurrentHint = false;
  onCurrentHintSeen: () => void = () => {};
  /** The storm belt's one-time hint has shown. */
  seenBeltHint = false;
  onBeltHintSeen: () => void = () => {};

  constructor(
    private readonly el: HTMLElement,
    private readonly world: World,
  ) {}

  show(text: string, seconds = 2.5, hazard?: HazardKind) {
    this.el.textContent = text;
    if (hazard) this.el.prepend(hazardBadge(hazard));
    this.el.hidden = false;
    this.left = seconds;
  }

  /** Clears the line now: a card opening over it says what comes next (decision 0217). */
  hide() {
    this.el.hidden = true;
    this.left = 0;
  }

  get showing(): boolean {
    return this.left > 0;
  }

  /** Every frame, even while the HUD is hidden, so a line never outstays its time. */
  tick(dt: number) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) this.el.hidden = true;
  }

  /** A step's sound plays (decision 0139): said in words too, for a muted phone, if it has words. */
  stepSound(effect: string, bearing: number) {
    const line = tOptional(`toast.${effect}`, { dir: compassWords(bearing) });
    if (line) this.show(line, 3);
  }

  handle(events: readonly WorldEvent[]) {
    for (const e of events) this.handleOne(e);
  }

  private handleOne(e: WorldEvent) {
    const pct = () => Math.round(hullCondition(this.world.trade) * 100);
    switch (e.type) {
      case 'mark-reached':
        return this.show(t('toast.markReached'), 2.5);
      case 'waypoint':
        return this.show(
          t('toast.waypoint', { label: e.label, time: formatTime(e.seconds), next: e.next }),
          3.5,
        );
      case 'reef-strike':
        return this.show(t('toast.reef', { pct: pct() }), 2.5);
      case 'crash':
        return this.show(t(CRASH_TEXT[e.surface] ?? 'toast.crash', { pct: pct() }), 2.5);
      case 'storm-near':
        return this.show(t('toast.stormNear', { dir: compassWords(e.bearing) }), 4, 'storm');
      case 'belt-near':
        if (this.seenBeltHint) return;
        this.seenBeltHint = true;
        this.onBeltHintSeen();
        return this.show(t('toast.beltHint', { name: zoneName(this.world, e.zone) }), 7, 'storm');
      case 'overboard':
        return this.show(
          t('toast.overboard', { n: e.qty, good: goodName(e.good).toLowerCase() }),
          3,
        );
      case 'current-charted':
        return this.currentCharted(e.id);
      case 'zone-charted': {
        const zone = this.world.map.windZones?.find((z) => z.id === e.id);
        if (zone?.name)
          this.show(t('toast.zoneCharted', { name: zone.name, kind: zoneKindName(zone.kind) }), 3);
        return;
      }
      case 'area-charted':
        return this.show(t('toast.areaCharted', { name: e.name }), 3);
      case 'too-shallow':
        if (!this.showing) this.show(t('toast.tooShallow'), 3);
        return;
      case 'bump':
        if (!this.showing) this.show(t('toast.bump'), 1.2);
        return;
    }
  }

  private currentCharted(id: string) {
    if (!this.seenCurrentHint) {
      this.seenCurrentHint = true;
      this.onCurrentHintSeen();
      this.show(t('toast.currentHint'), 6);
      return;
    }
    const name = this.world.map.currents?.find((c) => c.id === id)?.name ?? '';
    this.show(t('toast.currentCharted', { name }), 3);
  }
}
