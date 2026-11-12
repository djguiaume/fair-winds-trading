import type { Ocean } from './ocean';
import type { QualityProfile } from './quality';
import { Rain } from './rain';
import type { SeabedTexture } from './seabedTexture';
import type { ShoreTexture } from './shoreTexture';
import { WindStreaks } from './windStreaks';

/** The water, wind streaks and rain drawn at one quality level. */
export interface QualityEffects {
  ocean: Ocean;
  streaks: WindStreaks;
  rain: Rain;
}

/**
 * Each level's effects, created only when selected, by level and waves on or off; they keep their
 * GPU programs and buffers for the next switch.
 */
export class QualityEffectsCache {
  private readonly byKey = new Map<string, QualityEffects>();

  /**
   * Every level's water on the land's bakes: the shore cache releases its previous bake on a live
   * map edit, so returning to a level never revives a disposed texture.
   */
  bind(shore: ShoreTexture, seabed: SeabedTexture | undefined) {
    for (const { ocean } of this.byKey.values()) {
      ocean.setShore(shore);
      if (seabed) ocean.setSeabed(seabed);
    }
  }

  /** The effects under `key`, made the first time (`ocean` gets the oceans made so far). */
  get(key: string, profile: QualityProfile, ocean: (others: Ocean[]) => Ocean): QualityEffects {
    let effects = this.byKey.get(key);
    if (!effects) {
      effects = {
        ocean: ocean([...this.byKey.values()].map((made) => made.ocean)),
        streaks: new WindStreaks(profile.windStreaks),
        rain: new Rain(profile.rainDrops),
      };
      this.byKey.set(key, effects);
    }
    return effects;
  }

  dispose() {
    for (const effects of this.byKey.values()) {
      effects.ocean.dispose();
      effects.streaks.dispose();
      effects.rain.dispose();
    }
    this.byKey.clear();
  }
}
