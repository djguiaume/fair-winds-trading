import type { TextVariant } from '../i18n';
import { KEY_BUTTONS } from './gamepad';

/**
 * How the player is playing right now (decision 0184): a touch screen, keyboard and mouse, or a
 * game controller. Texts that name controls ("tap", "press M", "press A") read the version for
 * this way (`t()`'s `key@touch|keys|pad`), and change as soon as the player switches.
 */
export type Way = TextVariant;

/** The way a browser event shows, or null for one that says nothing (a pad's own key). */
export function wayOfEvent(e: { type: string; pointerType?: string; key?: string }): Way | null {
  if (e.type === 'keydown') return e.key && e.key in KEY_BUTTONS ? null : 'keys';
  if (e.type === 'pointerdown') return e.pointerType === 'mouse' ? 'keys' : 'touch';
  return null;
}

/** The first guess before any input: a touch screen with no mouse is touch, else keyboard. */
export function firstWay(media: (query: string) => boolean): Way {
  return media('(pointer: coarse)') && !media('(any-pointer: fine)') ? 'touch' : 'keys';
}

/**
 * Follows the player's last input. The pad comes from the game's poller (`setPad`), which decides
 * when a key or click means the player left the pad (decision 0183); until then the pad's texts
 * stay, and the hands' way is only noted for when the pad goes.
 */
export class WayOfPlaying {
  private hands: Way;
  private pad = false;
  onChange: (way: Way) => void = () => {};

  constructor(target: Pick<Window, 'addEventListener'>, guess: Way) {
    this.hands = guess;
    const seen = (e: Event) => {
      const way = wayOfEvent(e as PointerEvent & KeyboardEvent);
      if (way && way !== this.hands) {
        this.hands = way;
        if (!this.pad) this.onChange(way);
      }
    };
    target.addEventListener('pointerdown', seen, true);
    target.addEventListener('keydown', seen, true);
  }

  get way(): Way {
    return this.pad ? 'pad' : this.hands;
  }

  /** The pad is (or is no longer) the last input. */
  setPad(using: boolean) {
    if (using === this.pad) return;
    this.pad = using;
    this.onChange(this.way);
  }
}
