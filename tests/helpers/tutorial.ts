import { PHASE1_MAP } from '../../src/data/maps';
import type { MapDef } from '../../src/sim/map';
import { type Screen, pointOf } from '../../src/sim/questLibrary';
import { QUESTS, QuestBook, type QuestDef } from '../../src/sim/quests';
import { SLOOP } from '../../src/sim/ship';
import { createWorld, type World } from '../../src/sim/world';
import { lessonFor } from '../../src/ui/questView';

/** The tutorial's quest (decision 0151). */
export const TUTORIAL = 'first-voyage';

/** A pier off each port's island, like the game's harbours. */
export function harboursOf(map: MapDef = PHASE1_MAP) {
  return Object.fromEntries(
    map.ports.map((p) => {
      const i = map.islands.find((i) => i.id === p.islandId)!;
      return [p.id, { x: i.x + i.radius + 5, y: i.y }];
    }),
  );
}

/**
 * A voyage with the quest book the game runs, and the player's moves the tutorial watches: the
 * chart, a course, docking, the helm (decision 0151: the tutorial is an ordinary quest).
 */
export function tutorialVoyage(
  map: MapDef = PHASE1_MAP,
  quests: readonly QuestDef[] = QUESTS,
  world: World = createWorld(map, SLOOP),
) {
  const harbours = harboursOf(map);
  let screen: Screen = 'sea';
  const book = new QuestBook(world, quests, { nightOk: () => true, screen: () => screen });
  const v = {
    world,
    harbours,
    quests: book,
    get step() {
      return book.progress(TUTORIAL)?.step;
    },
    get vars() {
      return book.progress(TUTORIAL)?.vars ?? {};
    },
    get running() {
      return book.isRunning(TUTORIAL);
    },
    get wreck() {
      return pointOf(map, 'wreck');
    },
    get lesson() {
      return lessonFor(book, harbours);
    },
    start: () => book.ask(TUTORIAL),
    skip: () => book.drop(TUTORIAL),
    cont: (option = 'continue') => book.choose(TUTORIAL, option),
    check: (dt = 0) => book.check(dt),
    screen(next: Screen) {
      screen = next;
      book.check();
    },
    /** A course to a port set on the chart, or cleared. */
    course(id: string | null) {
      const port = map.ports.find((p) => p.id === id);
      world.destination = port
        ? { portId: port.id, label: port.name, ...harbours[port.id]! }
        : null;
      book.check();
    },
    /** Alongside a port (or not), the way docking leaves her. */
    dock(id: string | null) {
      world.trade.dockedAt = id;
      if (id) Object.assign(world.boat, { ...harbours[id]!, speedKn: 0, sailStep: 0 });
      book.check();
    },
    /** Seconds at the helm, as the game passes it every simulation step. */
    helm(controls: { sailStep: number; steer: number }, seconds: number, step = 1 / 60) {
      for (let t = 0; t < seconds - 1e-9; t += step) book.update(step, controls);
    },
    /** Through sails and wind to the foghorn. */
    toFoghorn() {
      v.start();
      v.cont();
      v.cont();
    },
    /** From the foghorn to Rook aboard: alongside the wreck, slowly, for the hold. */
    rescue() {
      if (!v.running) v.start();
      while (v.step === 'sails' || v.step === 'wind') v.cont();
      const wreck = v.wreck!;
      Object.assign(world.boat, { x: wreck.x + 12, y: wreck.y, speedKn: 0.5, sinceBump: Infinity });
      for (let n = 0; n < 8; n++) book.check(0.5);
      // Rook's card at the rescue (decision 0185): "Welcome aboard".
      if (v.step === 'aboard') v.cont('welcome');
    },
    /** Rook home to Saltmere, the island, and alongside for the first trade. */
    reachMarket() {
      v.rescue();
      v.course('saltmere');
      v.dock('saltmere');
      // Rook's thanks on the quay (decision 0190), then the island.
      if (v.step === 'thanks') v.cont();
      v.cont();
    },
  };
  return v;
}
