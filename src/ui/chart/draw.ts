import { t } from '../../i18n';
import type { SeaMarkDef } from '../../sim/map';
import { discoveredPorts } from '../../sim/shipyards';
import type { JournalEntry, QuestPin, QuestTarget, StepMarker } from '../questView';
import { drawCurrents, drawZones } from './flows';
import { drawFog } from './fog';
import { Labels } from './labels';
import { drawLand, drawSeaMarks, drawWater } from './land';
import { courseMark, drawCourse, drawPlayer, drawQuests, drawRace, drawStorms } from './marks';
import { type PriceKey, priceLine } from './prices';
import { box, type Paint } from './svg';

type Point = { x: number; y: number };

/** What the chart shows of the quests (decision 0124); see `questView.ts`. */
export interface ChartQuests {
  pins(): QuestPin[];
  target(): QuestTarget | null;
  /** The tracked step's places at sea (decision 0130); left out, none. */
  markers?(): StepMarker[];
  journal(): JournalEntry[];
  track(quest: string): void;
  /** Offer an ignored quest again (decision 0141). */
  takeUp?(quest: string): void;
  /** Where the tracked step leads and its name, as the sea's arrow shows it (decision 0139). */
  goal?(): { x: number; y: number; label: string; portId?: string; place?: string } | null;
}

/** What the sea is drawn from, besides the world, and what its marks do when pressed. */
export interface SeaDrawing {
  fogBlur: boolean;
  race: readonly Point[] | null;
  questMarks: readonly SeaMarkDef[];
  prices: PriceKey;
  quests: ChartQuests | null;
  pierOf: (port: string) => Point | null;
  selectPort: (port: string) => void;
  setQuestCourse: () => void;
  removeMark: () => void;
}

/**
 * The whole sea, bottom to top (issue #444): the paper water, the zones and currents, the land,
 * the race and the sea marks, the fog, the storms, her course, the words, the quests and her own
 * mark, and her boat over everything.
 */
export function drawSea(p: Paint, o: SeaDrawing) {
  const { world, unit } = p;
  const { map, boat, destination } = world;
  drawWater(p);
  const zoneLabels = drawZones(p);
  drawCurrents(p);
  const charted = discoveredPorts(map, world.trade);
  const land = drawLand(p, charted);
  drawRace(p, o.race);
  drawSeaMarks(p, o.questMarks, land.places);
  zoneLabels.push(...drawFog(p, o.fogBlur));
  drawStorms(p);
  drawCourse(p);
  const market = o.prices.market();
  const priced = o.prices.good !== null;
  const piers = charted.map((port) => o.pierOf(port.id)!);
  const pins = o.quests?.pins() ?? [];
  const labels = new Labels(p, box(boat.x, -boat.y, 34 * unit, 34 * unit), land.landBoxes, [
    ...piers.map((pier) => box(pier.x, -pier.y, 20 * p.px, 20 * p.px)),
    ...pins.flatMap((pin) => faceBox(p, o.pierOf(pin.port))),
  ]);
  charted.forEach((port, i) => {
    const quote = market.quotes.find((q) => q.portId === port.id);
    labels.port({
      port,
      island: map.islands.find((island) => island.id === port.islandId)!,
      pier: piers[i]!,
      price: priced ? priceLine(quote, market) : { text: '', best: false },
      selected: destination?.portId === port.id,
      onSelect: () => o.selectPort(port.id),
    });
  });
  for (const island of land.homes) labels.home(island);
  // The quest's flag names the island it lies by: that island's own name gives way (0212).
  const target = o.quests?.target() ?? null;
  const goal = target?.point ? (o.quests?.goal?.() ?? null) : null;
  const goalName = goal ? labels.flag(goal) : null;
  labels.places(land.places, goal?.place);
  labels.zones(zoneLabels);
  if (o.quests) {
    const q = o.quests;
    drawQuests(
      p,
      {
        target,
        goal,
        goalName,
        markers: q.markers?.() ?? [],
        pins,
        pierOf: o.pierOf,
        onGoal: o.setQuestCourse,
      },
      destination,
    );
  }
  if (destination?.kind === 'mark') {
    const label = t('chart.removeMark');
    const mark = courseMark(p, destination, { kind: 'mark', selected: true, label });
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      o.removeMark();
    });
  }
  drawPlayer(p);
}

/** The room a person's face takes over their pier (see `drawPin`). */
function faceBox(p: Paint, pier: Point | null) {
  return pier ? [box(pier.x, -pier.y - 31 * p.px, 44 * p.px, 44 * p.px)] : [];
}
