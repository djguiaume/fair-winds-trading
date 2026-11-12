import audio from '../../data/audio.json';
import { SEA_MARK_TYPES, type SeaMarkType } from '../../sim/map';
import { MAP_PLACES } from '../../sim/questLibrary';
import { type QuestDef, type QuestStep, STEP_MARKER_STYLES } from '../../sim/quests';
import { pickOnChart } from './chartView';
import { removeQuestMark, setWind } from './doc';
import { h, numberInput, row, segmented, select, textInput } from './form';
import { type Tool, edit, qb } from './state';

/* The quest builder panel's Sea tab for the open step, and the quest's own sea rows. */

/** A breeze editor: knots (blank: none) and the bearing it blows from (blank: the sea's). */
function windPair(
  wind: { speedKn: number; fromDeg?: number } | undefined,
  set: (w: { speedKn: number; fromDeg?: number } | undefined) => void,
): HTMLElement {
  const pair = h('span', { class: 'ed-pair' });
  pair.append(
    numberInput(
      wind?.speedKn,
      (n) => edit(() => set(n === undefined ? undefined : { ...wind, speedKn: n })),
      'the sea’s',
    ),
    numberInput(
      wind?.fromDeg,
      (n) =>
        wind &&
        edit(() => {
          const next = { ...wind };
          if (n === undefined) delete next.fromDeg;
          else next.fromDeg = n;
          set(next);
        }),
      'from °',
    ),
  );
  return pair;
}

/** A button that goes back to the chart to place a field with `tool`. */
function pickButton(tool: Tool, label: string, title: string): HTMLElement {
  const pick = h('button', { type: 'button', title }, label);
  pick.addEventListener('click', () => pickOnChart(tool));
  return pick;
}

/**
 * The quest's own sea (decision 0164): a breeze held over its steps that have none, and its sea
 * marks, shown at sea and on the chart only while it runs.
 */
export function questSeaRows(q: QuestDef): HTMLElement[] {
  const out: HTMLElement[] = [
    row(
      'Wind (kn)',
      windPair(q.wind, (w) => setWind(q, w?.speedKn, w?.fromDeg)),
    ),
  ];
  const list = h('div', { class: 'ed-list' });
  (q.marks ?? []).forEach((m, i) => {
    const line = h('span', { class: 'ed-pair' });
    const drop = h('button', { type: 'button', title: 'Remove this mark' }, '✕');
    drop.addEventListener('click', () => edit(() => removeQuestMark(q, i)));
    line.append(
      select([...SEA_MARK_TYPES], m.type, (v) => v && edit(() => (m.type = v as SeaMarkType))),
      numberInput(m.x, (n) => n !== undefined && edit(() => (m.x = n)), 'x'),
      numberInput(m.y, (n) => n !== undefined && edit(() => (m.y = n)), 'y'),
      textInput(m.name ?? '', (v) => edit(() => (v ? (m.name = v) : delete m.name))),
      drop,
    );
    list.append(line);
  });
  list.append(pickButton('buoy', '+ buoy ⌖', 'Click the chart to add a buoy'));
  out.push(row('Sea marks', list));
  return out;
}

export function seaPanel(s: QuestStep): HTMLElement[] {
  const out: HTMLElement[] = [h('h2', {}, 'At sea ', h('small', {}, 'while the step is tracked'))];
  out.push(
    row(
      'Marker',
      segmented(
        STEP_MARKER_STYLES.map((m): [string, string] => [m, m]),
        s.marker ?? 'ring',
        (v) => edit(() => (v === 'ring' ? delete s.marker : (s.marker = v as QuestStep['marker']))),
      ),
    ),
  );
  out.push(row('Compass', compassField(s)));
  const chart = h('span', { class: 'ed-pair' });
  chart.append(
    select(
      qb.host.prepared().ports.map((p): [string, string] => [p.id, p.name]),
      s.chart?.port,
      (v) =>
        edit(() => (v ? (s.chart = { port: v, radius: s.chart?.radius ?? 60 }) : delete s.chart)),
      '—',
    ),
    numberInput(
      s.chart?.radius,
      (n) => s.chart && n !== undefined && edit(() => (s.chart!.radius = n)),
      'radius',
    ),
  );
  out.push(row('Chart circle', chart));
  out.push(
    row(
      'Wind (kn)',
      windPair(s.wind, (w) => setWind(s, w?.speedKn, w?.fromDeg)),
    ),
  );
  out.push(row('Move boat to', moveField(s)));
  out.push(row('Sound', soundField(s)));
  out.push(
    row(
      'Music',
      select(
        Object.keys(audio.music),
        s.music,
        (v) => edit(() => (v ? (s.music = v) : delete s.music)),
        '— the sea’s',
      ),
    ),
  );
  return out;
}

/** The step's compass: a map place by its word (the prologue's wreck, decision 0151), or a point. */
function compassField(s: QuestStep): HTMLElement {
  const compass = h('span', { class: 'ed-pair' });
  const place = typeof s.compass === 'string' ? s.compass : undefined;
  const point = typeof s.compass === 'object' ? s.compass : undefined;
  compass.append(
    select(
      Object.keys(MAP_PLACES),
      place,
      (v) => edit(() => (v ? (s.compass = v) : delete s.compass)),
      'a point',
    ),
  );
  if (!place)
    for (const key of ['x', 'y'] as const)
      compass.append(
        numberInput(
          point?.[key],
          (n) =>
            edit(() => {
              if (n === undefined) delete s.compass;
              else s.compass = { x: point?.x ?? n, y: point?.y ?? n, [key]: n };
            }),
          key,
        ),
      );
  compass.append(pickButton('compass', '⌖', 'Click the chart to place it'));
  return compass;
}

/** Where the boat is taken when the step begins (decision 0164). */
function moveField(s: QuestStep): HTMLElement {
  const move = h('span', { class: 'ed-pair' });
  for (const key of ['x', 'y', 'headingDeg'] as const)
    move.append(
      numberInput(
        s.moveTo?.[key],
        (n) =>
          edit(() => {
            if (key !== 'headingDeg' && n === undefined) delete s.moveTo;
            else if (key === 'headingDeg' && s.moveTo) {
              if (n === undefined) delete s.moveTo.headingDeg;
              else s.moveTo.headingDeg = n;
            } else if (n !== undefined)
              s.moveTo = { x: s.moveTo?.x ?? n, y: s.moveTo?.y ?? n, [key]: n };
          }),
        key === 'headingDeg' ? 'heading °' : key,
      ),
    );
  move.append(pickButton('move', '⌖', 'Click the chart to place the boat'));
  return move;
}

function soundField(s: QuestStep): HTMLElement {
  const sound = h('span', { class: 'ed-pair' });
  sound.append(
    select(
      Object.keys(audio.effects),
      s.sound?.effect,
      (v) =>
        edit(() =>
          v ? (s.sound = { effect: v, everySec: s.sound?.everySec ?? 9 }) : delete s.sound,
        ),
      '—',
    ),
    numberInput(
      s.sound?.everySec,
      (n) => s.sound && n !== undefined && edit(() => (s.sound!.everySec = n)),
      'every s',
    ),
  );
  return sound;
}
