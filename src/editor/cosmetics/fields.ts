import { PROP_RECIPES } from '../../data/props';
import { type Item, RULES, SLOTS } from '../../sim/cosmetics';
import { FLAG_SHAPES, REGATTA } from '../../sim/regatta';
import { QUESTS } from '../../sim/quests';
import { h, numberInput, row, select, textInput } from '../quest/form';
import { type CosmeticsDoc, setField } from './doc';

/** The fields of one cosmetic item on the Cosmetics page, one row each; the page binds its state. */
export interface FieldContext {
  doc(): CosmeticsDoc;
  edit(change: () => void): void;
  setIn(item: Item, path: string): (text: string) => void;
}
let ctx: FieldContext;
export const bindFields = (c: FieldContext) => (ctx = c);

const LABELS: Record<string, string> = {
  'sail-colour': 'Sail colour',
  'sail-pattern': 'Pattern',
  'sail-logo': 'Emblem',
  'hull-colour': 'Hull colour',
  figurehead: 'Figurehead',
  flag: 'Flag',
  wake: 'Wake',
};

export const text = (item: Item, label: string, path: string, value: string) =>
  row(label, textInput(value, ctx.setIn(item, path)));

function colour(item: Item, path: string, value: string | null | undefined): HTMLElement {
  const pick = h('input', { type: 'color' });
  pick.value = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  pick.addEventListener('change', () => ctx.edit(() => void setField(item, path, pick.value)));
  return h('span', { class: 'rg-colour' }, pick, textInput(value ?? '', ctx.setIn(item, path)));
}

export function unlockRows(item: Item): HTMLElement[] {
  const u = item.unlock;
  const rows = [
    row(
      'unlock',
      select(['free', 'earned'], u.kind, (v) =>
        ctx.edit(() => {
          item.unlock = v === 'free' ? { kind: 'free' } : { kind: 'earned', quest: QUESTS[0]!.id };
        }),
      ),
    ),
  ];
  if (u.kind === 'earned') {
    const kind =
      u.regatta !== undefined ? 'regatta' : u.milestone !== undefined ? 'milestone' : 'quest';
    const value = u[kind] ?? '';
    const options =
      kind === 'quest'
        ? QUESTS.map((q) => q.id)
        : kind === 'regatta'
          ? REGATTA.series.map((s) => s.id)
          : null;
    rows.push(
      row(
        'earned by',
        select(['quest', 'regatta', 'milestone'], kind, (k) =>
          ctx.edit(() => {
            item.unlock = {
              kind: 'earned',
              [k]:
                k === 'quest'
                  ? QUESTS[0]!.id
                  : k === 'regatta'
                    ? REGATTA.series[0]!.id
                    : 'milestone',
            };
          }),
        ),
        options
          ? select(options, value, (v) =>
              ctx.edit(() => void (item.unlock = { kind: 'earned', [kind]: v })),
            )
          : textInput(value, (v) =>
              ctx.edit(() => void (item.unlock = { kind: 'earned', milestone: v })),
            ),
      ),
    );
  }
  return rows;
}

export function slotRows(item: Item): HTMLElement[] {
  const num = (path: string, value: number) =>
    numberInput(
      value,
      (v) => v !== undefined && ctx.edit(() => void setField(item, path, String(v))),
    );
  switch (item.slot) {
    case 'sail-colour':
      return [row('cloth', colour(item, 'cloth', item.cloth))];
    case 'sail-pattern':
      return [
        row(
          'pattern',
          select(Object.keys(RULES.patterns), item.pattern, ctx.setIn(item, 'pattern')),
        ),
        text(item, 'colours (pattern, trim)', 'colours', item.colours.join(',')),
      ];
    case 'sail-logo':
      return [row('colour', colour(item, 'colour', item.colour)), svgRow(item.id)];
    case 'hull-colour':
      return [
        row('band', colour(item, 'band', item.band)),
        row('strake', colour(item, 'strake', item.strake)),
      ];
    case 'figurehead':
      return [
        row('mount', select(RULES.mounts, item.mount, ctx.setIn(item, 'mount'))),
        row(
          'recipe',
          select(
            Object.values(PROP_RECIPES)
              .filter((r) => r.group === 'figureheads')
              .map((r) => r.id),
            item.recipe,
            ctx.setIn(item, 'recipe'),
            '— pick —',
          ),
        ),
        row('triangles', num('tris', item.tris)),
        row('size', num('size', item.size)),
      ];
    case 'flag':
      return flagRows(item);
    case 'wake':
      return [
        row('style', select(RULES.wakeStyles, item.style, ctx.setIn(item, 'style'))),
        row('tint', colour(item, 'tint', item.tint)),
      ];
    default:
      return SLOTS.map((slot) =>
        row(
          LABELS[slot] ?? slot,
          select(
            ctx
              .doc()
              .items.filter((i) => i.slot === slot)
              .map((i) => i.id),
            item.items[slot],
            (v) => ctx.edit(() => void (v ? (item.items[slot] = v) : delete item.items[slot])),
            '— none —',
          ),
        ),
      );
  }
}

function flagRows(item: Extract<Item, { slot: 'flag' }>): HTMLElement[] {
  if (item.ref !== undefined)
    return [
      row(
        'pennant of flags.json',
        select(
          REGATTA.series.map((s) => s.pennant),
          item.ref,
          ctx.setIn(item, 'ref'),
        ),
      ),
    ];
  const own = item.own!;
  return [
    row('shape', select([...FLAG_SHAPES], own.shape, ctx.setIn(item, 'own.shape'))),
    text(
      item,
      `bands (${RULES.flagBands.min} to ${RULES.flagBands.max}, mast to fly)`,
      'own.bands',
      own.bands.join(','),
    ),
    row(
      'length',
      numberInput(
        own.length,
        (v) => v !== undefined && ctx.edit(() => void setField(item, 'own.length', String(v))),
      ),
    ),
    row(
      'height',
      numberInput(
        own.height,
        (v) => v !== undefined && ctx.edit(() => void setField(item, 'own.height', String(v))),
      ),
    ),
  ];
}

/** An emblem's SVG: flat filled shapes, edited as text. */
function svgRow(id: string): HTMLElement {
  const area = h('textarea', { rows: '5' });
  area.value = ctx.doc().logos[id] ?? '';
  area.addEventListener('change', () => ctx.edit(() => (ctx.doc().logos[id] = area.value)));
  return row(`${id}.svg`, area);
}
