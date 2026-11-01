import { SHIPPED_CATALOGUE } from '../../data/cosmetics';
import { FLAGS } from '../../sim/regatta';
import { resolveAppearance } from '../../sim/cosmetics';
import { daylightAt, secondsAtHour } from '../../sim/daylight';
import {
  type FreePreset,
  type FreeSetup,
  everythingUnlocked,
  setupFor,
} from '../../sim/freeSailing';
import { lookOf, setShipLook } from '../../sim/shipLooks';
import type { UpgradeTrack } from '../../sim/upgrades';
import { BoatPreview } from '../../render/boatPreview';
import { boatLookOf } from '../../render/models/boatLook';
import type { ShipUpgrades } from '../../render/models';
import type { QualityLevel } from '../../render/quality';
import { guardSoftDisabled } from '../padFocus';
import { type BoatLooksHost, BoatLooksScreen } from '../boatLooks/screen';
import { presetsHtml, shellHtml, shipsHtml, upgradesHtml } from './view';
import '../boatLooks/boatLooks.css';
import '../boatLooks/boatLooksSmall.css';
import './freeSailing.css';

/**
 * The Free Sailing setup (issue #300, decision 0266): pick where and when, the ship and her
 * upgrades, dress her on the Boat looks screen with every item open, then set sail. Everything
 * chosen stays in this page's memory; `sail` hands it to the session, which never saves.
 */
export interface FreeSetupHost {
  presets: readonly FreePreset[];
  quality(): QualityLevel;
  /** Starts the session afresh at the preset with this setup. */
  sail(setup: FreeSetup): void;
  /** Leaves Free Sailing for the voyage. */
  leave(): void;
  /** Closed without setting sail. */
  closed(): void;
}

export class FreeSetupScreen {
  readonly root: HTMLDialogElement;
  private preview: BoatPreview | null = null;
  private setup: FreeSetup;
  /** Set while Set sail closes the screen: the session starts instead of the menu coming back. */
  private sailing = false;
  private readonly looks: BoatLooksScreen;
  private readonly onResize = () => this.preview?.resize();

  constructor(private readonly host: FreeSetupHost) {
    this.setup = setupFor(host.presets[0]!);
    this.root = document.createElement('dialog');
    this.root.className = 'boat-looks free-setup';
    this.root.setAttribute('aria-labelledby', 'fs-title');
    document.body.append(this.root);
    this.root.addEventListener('click', (e) => this.click(e));
    this.root.addEventListener('keydown', (e) => this.key(e));
    this.root.addEventListener('close', () => this.cleanUp());
    this.root.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    guardSoftDisabled(this.root);
    this.looks = new BoatLooksScreen(this.looksHost());
    // Back from Boat looks: her new look on the turntable here.
    this.looks.root.addEventListener('close', () => {
      this.preview?.start();
      this.showBoat();
    });
  }

  get isOpen() {
    return this.root.open;
  }

  /** What the player chose last: the session sails it, and keeps its looks across restarts. */
  get current(): FreeSetup {
    return this.setup;
  }

  open() {
    if (this.isOpen) return;
    this.root.innerHTML = shellHtml();
    this.root.showModal();
    this.preview = new BoatPreview(this.root.querySelector('.bl-canvas')!, this.host.quality());
    this.render();
    this.preview.resize();
    this.preview.start();
    addEventListener('resize', this.onResize);
    this.root.querySelector<HTMLElement>('.fs-preset[aria-checked="true"]')?.focus();
  }

  close() {
    if (this.root.open) this.root.close();
    this.cleanUp();
  }

  private cleanUp() {
    if (!this.preview) return;
    removeEventListener('resize', this.onResize);
    this.preview.dispose();
    this.preview = null;
    this.root.innerHTML = '';
    if (!this.sailing) this.host.closed();
    this.sailing = false;
  }

  private get preset(): FreePreset {
    return this.host.presets.find((p) => p.id === this.setup.preset) ?? this.host.presets[0]!;
  }

  private render() {
    const $ = (s: string) => this.root.querySelector<HTMLElement>(s)!;
    $('.fs-presets').innerHTML = presetsHtml(this.host.presets, this.setup.preset);
    $('.fs-ships').innerHTML = shipsHtml(this.setup.ship);
    $('.fs-upgrades').innerHTML = upgradesHtml(this.setup);
    const night = daylightAt(secondsAtHour(this.preset.hour)).night >= 0.5;
    this.root.toggleAttribute('data-night', night);
    this.preview?.setNight(night);
    const backdrop = this.preview?.backdrop;
    if (backdrop) {
      $('.bl-stage').style.setProperty('--bl-sky', backdrop.sky);
      $('.bl-stage').style.setProperty('--bl-sea', backdrop.sea);
    }
    this.showBoat();
  }

  private showBoat() {
    const { ship, upgrades, looks } = this.setup;
    const { look } = resolveAppearance(SHIPPED_CATALOGUE, lookOf(looks, ship), ship, FLAGS);
    this.preview?.show({
      shipClass: ship,
      upgrades: upgrades as ShipUpgrades,
      damage: 0,
      look: boatLookOf(look),
      wake: look.wake,
      ...(look.flag ? { flag: look.flag } : {}),
    });
  }

  private click(e: Event) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    const d = el.dataset;
    if (el.classList.contains('bl-close')) return this.close();
    if (el.classList.contains('fs-leave')) return this.host.leave();
    if (el.classList.contains('fs-sail')) return this.sail();
    if (el.classList.contains('fs-looks')) return this.openLooks();
    if (d.turn) return this.preview?.turn(Number(d.turn));
    if (d.preset) this.pickPreset(d.preset);
    else if (d.ship) this.setup = { ...this.setup, ship: d.ship };
    else if (d.track)
      this.setup = {
        ...this.setup,
        upgrades: { ...this.setup.upgrades, [d.track as UpgradeTrack]: Number(d.level) },
      };
    else return;
    this.renderKeepingFocus(el);
  }

  /** A preset brings its ship and upgrades; the looks tried so far stay. */
  private pickPreset(id: string) {
    const preset = this.host.presets.find((p) => p.id === id);
    if (preset) this.setup = setupFor(preset, this.setup.looks);
  }

  private sail() {
    this.sailing = true;
    this.close();
    this.host.sail(this.setup);
  }

  private openLooks() {
    this.preview?.stop();
    this.looks.open(this.setup.ship);
  }

  /** Boat looks for the session: the chosen ship, every item open, kept in this setup only. */
  private looksHost(): BoatLooksHost {
    const progress = everythingUnlocked(SHIPPED_CATALOGUE);
    return {
      catalogue: SHIPPED_CATALOGUE,
      ships: () => [
        { id: this.setup.ship, upgrades: this.setup.upgrades as ShipUpgrades, damage: 0 },
      ],
      look: (ship) => lookOf(this.setup.looks, ship),
      use: (ship, look) => setShipLook(this.setup, SHIPPED_CATALOGUE, ship, look, () => true),
      progress: () => progress,
      autoFlag: () => undefined,
      quality: () => this.host.quality(),
      night: () => this.root.hasAttribute('data-night'),
    };
  }

  private renderKeepingFocus(el: HTMLElement) {
    const keys = ['preset', 'ship', 'track'] as const;
    const key = keys.find((k) => el.dataset[k] !== undefined)!;
    const extra = key === 'track' ? `[data-level="${el.dataset.level}"]` : '';
    this.render();
    this.root
      .querySelector<HTMLElement>(`[data-${key}="${el.dataset[key]}"]${extra}`)
      ?.focus({ preventScroll: true });
  }

  /** Esc stays here; Q and E (or [ and ]) turn the boat, as on Boat looks. */
  private key(e: KeyboardEvent) {
    if (e.key === 'Escape') e.stopPropagation();
    else if (e.key === 'q' || e.key === '[') this.preview?.turn(-1);
    else if (e.key === 'e' || e.key === ']') this.preview?.turn(1);
  }
}
