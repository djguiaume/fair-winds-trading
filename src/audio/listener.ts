import { bergsAt } from '../sim/bergs';
import { trueWindAngle } from '../sim/boat';
import { reefDistance } from '../sim/hazards';
import { noGoAngle } from '../sim/ship';
import type { World, WorldEvent } from '../sim/world';
import { SEA_BEDS, SOUND_EVENTS } from './catalog';
import type { Music } from './music';
import { calmAt, seaIdAt, type PlaceDistances } from './seaBed';

/** What the listener needs of the music player: the sea's bed and named effects. */
type Player = Pick<Music, 'sea' | 'effectNamed'>;

/** How often the sea's sound is worked out, seconds: the layers glide between. */
const EVERY = 0.25;
/** Calls and bergs further off than this are not looked for. */
const LISTEN_RANGE = 300;

/**
 * The game's ear (decision 0209): turns the world into sound a few times a second (which sea's bed,
 * how hard the wind blows, her speed, luffing in irons, rain, what is near), and its events into
 * effects: a port's bell on docking, a thud on a crash, the sail's flap as she tacks, a rumble as a
 * volcano erupts nearby.
 */
export class SeaListener {
  private since = EVERY;
  /** Which side the wind was on, to hear her tack or gybe; seconds since the last flap. */
  private side = 0;
  private sinceFlap = 0;

  constructor(
    private readonly player: Player,
    /** Eruptions begun since the last call and the nearest steam vent (the view's volcanoes). */
    private readonly volcanoes: (x: number, y: number) => { eruptions: number[]; vent: number },
    /** Haze switches off in Settings: `ash` off mutes the rumble with the plume (decision 0169). */
    private readonly ashOff: () => boolean,
  ) {}

  /** Each frame at sea. */
  update(world: World, dt: number) {
    const { boat, ship, wind } = world;
    const docked = world.trade.dockedAt !== null || !!world.trade.home.docked;
    const sailsUp = boat.sailStep > 0 && boat.sail > 0.05;
    const twa = trueWindAngle(boat.heading, wind);
    // A tack or a gybe: the wind crosses the bow or the stern with sail up and way on.
    const side = Math.sign(twa);
    this.sinceFlap += dt;
    if (side !== 0 && this.side !== 0 && side !== this.side && sailsUp && !docked) {
      if (this.sinceFlap > 1.5 && boat.speedKn > 0.3) {
        this.player.effectNamed(SOUND_EVENTS.tack.effect);
        this.sinceFlap = 0;
      }
    }
    if (side !== 0) this.side = side;

    this.since += dt;
    if (this.since < EVERY) return;
    const step = this.since;
    this.since = 0;

    const sea = seaIdAt(boat.x, boat.y);
    const bed = SEA_BEDS[sea];
    const volcano = this.volcanoes(boat.x, boat.y);
    const squalls = !!world.belt?.inside && world.belt.squalls;
    const rain = Math.max(world.weather.rain, squalls ? 0.85 : 0);
    const islands = world.land.islands;
    let bergs = Infinity;
    if (world.bergsOn)
      for (const b of bergsAt(world.map, world.time, { ...boat, range: LISTEN_RANGE }))
        bergs = Math.min(bergs, Math.hypot(b.x - boat.x, b.y - boat.y));
    const where: PlaceDistances = {
      island(ids) {
        let d = Infinity;
        for (const i of islands)
          if (ids === 'any' || ids.includes(i.id))
            d = Math.min(d, Math.hypot(i.x - boat.x, i.y - boat.y) - i.radius);
        return Math.max(0, d);
      },
      bergs,
      vents: volcano.vent,
      reefs: reefDistance(this.heardReefs(world), boat),
      storm: world.weather.storm > 0.3 || squalls,
      raining: rain > 0.2,
    };
    this.player.sea(
      step,
      sea,
      {
        windKn: wind.speedKn,
        speedKn: boat.speedKn,
        luffing: sailsUp && Math.abs(twa) < noGoAngle(ship),
        rain,
        docked,
        calm: bed ? calmAt(bed, islands, boat.x, boat.y) : 1,
      },
      where,
    );
    const { effect, range } = SOUND_EVENTS.eruption;
    if (!this.ashOff())
      for (const d of volcano.eruptions)
        if (d < range) this.player.effectNamed(effect, 1 - 0.7 * (d / range));
  }

  /** The reefs, each heard a call's range past its own reach (rebuilt when the reefs change). */
  private reefs: { of: World['reefs'] | null; padded: World['reefs'] } = { of: null, padded: [] };
  private heardReefs(world: World) {
    if (this.reefs.of !== world.reefs)
      this.reefs = {
        of: world.reefs,
        padded: world.reefs.map((r) => ({ ...r, r: r.r + LISTEN_RANGE })),
      };
    return this.reefs.padded;
  }

  /** The world's and the harbour's events. */
  hear(events: readonly WorldEvent[]) {
    const { dock, crash, bump } = SOUND_EVENTS;
    for (const e of events) {
      if (e.type === 'docked' || e.type === 'home-docked') {
        const id = e.type === 'docked' ? e.portId : e.islandId;
        this.player.effectNamed(dock.effect, 1, dock.pitch?.[id] ?? 1);
      } else if (e.type === 'crash' || e.type === 'reef-strike')
        // Louder the harder she hit: a scrape at 1 hull point, full at 15 or more.
        this.player.effectNamed(crash.effect, Math.min(1, 0.45 + e.damage / 27));
      else if (e.type === 'bump' || e.type === 'too-shallow') this.player.effectNamed(bump.effect);
    }
  }
}
