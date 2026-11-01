import { shipName, t } from '../../i18n';
import { DEG } from '../../sim/math';
import type { Destination } from '../../sim/world';
import { drawHazard } from '../hazardMarker';
import { portraitSvg } from '../portraits';
import type { QuestPin, QuestTarget, StepMarker } from '../questView';
import { type Paint, pressable } from './svg';

type Point = { x: number; y: number };

/** The boat's hull on the chart, bow up, in screen pixels before its scale. */
const HULL = 'M0 -13C5 -8 6 -2 6 3V9C6 12 3 14 0 14S-6 12 -6 9V3C-6 -2 -5 -8 0 -13Z';

/** Storms (decisions 0067, 0070): the slate badge over a soft cloud, amber chevrons for the drift. */
export function drawStorms({ world, svg, px }: Paint) {
  for (const storm of world.weather.storms) {
    if (storm.intensity < 0.05) continue;
    drawHazard(
      svg,
      { kind: 'storm', ...storm, reach: storm.radius, strength: storm.intensity },
      px,
      t('chart.storm'),
    );
  }
}

/** The race under way's course (decision 0217): from the line round each mark in turn. */
export function drawRace({ shape }: Paint, race: readonly Point[] | null) {
  if (race && race.length > 1)
    shape('polyline', { points: race.map((p) => `${p.x},${-p.y}`).join(' '), class: 'chart-race' });
}

/**
 * Her course in ink (issue #444): a dashed line from the boat to where she is bound; a port's pier
 * gets a ring, the quest's place and her own mark carry their own marks.
 */
export function drawCourse({ world, shape, px }: Paint) {
  const { boat, destination } = world;
  if (!destination) return;
  shape('line', {
    x1: boat.x,
    y1: -boat.y,
    x2: destination.x,
    y2: -destination.y,
    class: 'chart-course',
  });
  if (!destination.kind)
    shape('circle', { cx: destination.x, cy: -destination.y, r: 9 * px, class: 'chart-selected' });
}

/** The boat: a screen-sized sage hull on her exact place and heading, and "Your sloop" by it. */
export function drawPlayer({ world, shape, unit, px }: Paint) {
  const { boat } = world;
  const heading = Math.round((boat.heading / DEG + 360) % 360);
  const g = shape('g', {
    transform: `translate(${boat.x} ${-boat.y}) rotate(${boat.heading / DEG}) scale(${unit * 1.2})`,
    class: 'chart-player',
    role: 'img',
    'aria-label': t('chart.boatLabel', { deg: heading }),
  });
  shape('path', { d: HULL, class: 'chart-player-hull' }, g);
  const name = shape('text', {
    x: boat.x + 14 * px,
    y: -boat.y + 26 * px,
    class: 'chart-player-name',
    'font-size': 14 * px,
  });
  name.textContent = t('chart.yourShip', { ship: shipName(world.ship).toLocaleLowerCase() });
}

/**
 * A course mark she can press (decision 0212, issue #444): the quest's place as a sage disc with
 * a paper flag, her own mark as an ink cross in a ring. Returns the group, for its click.
 */
export function courseMark(
  { shape, px }: Paint,
  at: Point,
  o: { kind: 'quest' | 'mark'; selected: boolean; label: string },
) {
  const g = shape('g', {
    class: `chart-flag chart-flag-${o.kind}${o.selected ? ' is-selected' : ''}`,
    'data-chart-target': o.kind,
  });
  pressable(g, o.label);
  const x = at.x,
    y = -at.y,
    r = 12 * px;
  shape('circle', { cx: x, cy: y, r: 22 * px, class: 'chart-hit' }, g);
  shape('circle', { cx: x, cy: y, r, class: 'chart-flag-disc' }, g);
  if (o.kind === 'quest')
    shape(
      'path',
      {
        d: `M${x - 3 * px} ${y + 7 * px}V${y - 7 * px}H${x + 7 * px}L${x + 4 * px} ${y - 3.5 * px}L${x + 7 * px} ${y}H${x - 1.5 * px}V${y + 7 * px}Z`,
        class: 'chart-flag-cloth',
      },
      g,
    );
  else {
    const c = 6 * px;
    shape(
      'path',
      {
        d: `M${x - c} ${y - c}L${x + c} ${y + c}M${x + c} ${y - c}L${x - c} ${y + c}`,
        class: 'chart-flag-cross',
      },
      g,
    );
  }
  return g;
}

/** What the quests put on the chart (decisions 0124, 0130, 0212). */
export interface QuestMarks {
  target: QuestTarget | null;
  markers: readonly StepMarker[];
  goal: (Point & { label: string }) | null;
  /** Where the flag's name goes, as the chart's words placed it. */
  goalName: Point | null;
  pins: readonly QuestPin[];
  pierOf: (port: string) => Point | null;
  /** Sets the course for the quest's place. */
  onGoal: () => void;
}

/**
 * The tracked step's place (a ring, or an area), its places at sea still to reach, the quest's
 * place as a mark to set a course for, and people's faces on their ports.
 */
export function drawQuests(p: Paint, q: QuestMarks, course: Destination | null) {
  const { world, shape, px } = p;
  const { boat } = world;
  const at = q.target && (q.target.point ?? (q.target.port ? q.pierOf(q.target.port) : null));
  if (q.target && at) {
    // With no course set the sea's arrow follows the quest, so its faint route shows; a course
    // of her own draws the one ink line instead (decision 0212).
    if (!course)
      shape('line', { x1: boat.x, y1: -boat.y, x2: at.x, y2: -at.y, class: 'chart-quest-route' });
    shape('circle', {
      cx: at.x,
      cy: -at.y,
      r: q.target.radius ?? 15 * px,
      class: q.target.radius ? 'chart-quest-area' : 'chart-quest-ring',
    });
  }
  for (const m of q.markers) {
    if (m.reached) continue;
    shape('circle', {
      cx: m.x,
      cy: -m.y,
      r: Math.max(m.within, 4 * px),
      class: m.next ? 'chart-quest-ring' : 'chart-quest-area',
    });
  }
  if (q.goal) {
    const selected = course?.kind === 'quest';
    const g = courseMark(p, q.goal, {
      kind: 'quest',
      selected,
      label: t('chart.setBearingTo', { name: q.goal.label }),
    });
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!selected) q.onGoal();
    });
    const at = q.goalName ?? { x: q.goal.x, y: -q.goal.y + 26 * px };
    const name = shape(
      'text',
      { x: at.x, y: at.y, class: 'chart-flag-name', 'font-size': 14 * px },
      g,
    );
    name.textContent = q.goal.label;
  }
  for (const pin of q.pins) drawPin(p, pin, q.pierOf(pin.port));
}

/** A quest giver's face over their port, ringed in sage when tracked, "!" when they ask. */
function drawPin({ shape, px }: Paint, pin: QuestPin, pier: Point | null) {
  if (!pier) return;
  const size = 34 * px;
  const g = shape('g', {
    class: `chart-quest-pin${pin.tracked ? ' is-tracked' : ''}`,
    transform: `translate(${pier.x} ${-pier.y - 14 * px - size / 2})`,
  });
  if (pin.tracked) shape('circle', { r: size * 0.62, class: 'chart-quest-glow' }, g);
  g.insertAdjacentHTML('beforeend', portraitSvg(pin.giver, { size: 34 }));
  const face = g.lastElementChild!;
  for (const [k, v] of Object.entries({ x: -size / 2, y: -size / 2, width: size, height: size }))
    face.setAttribute(k, String(v));
  if (!pin.alert) return;
  shape('circle', { cx: size * 0.4, cy: -size * 0.4, r: 8 * px, class: 'chart-quest-alert' }, g);
  const mark = shape(
    'text',
    { x: size * 0.4, y: -size * 0.4 + 4.5 * px, class: 'chart-quest-mark', 'font-size': 13 * px },
    g,
  );
  mark.textContent = '!';
}
