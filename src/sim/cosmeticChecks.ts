import { FLAG_SHAPES, type FlagDef } from './regatta';
import { type Catalogue, type Item, type Slot, RULES, SLOTS, type Unlock } from './cosmetics';

/** What the checks compare with: the rest of the game's data, passed in so the checks stay pure. */
export interface CosmeticContext {
  shipClasses: string[];
  quests: string[];
  /** The regatta series and the pennant each flies, and every flag of `flags.json`. */
  series: { id: string; pennant: string }[];
  flags: FlagDef[];
  /** Prop recipes by id (figureheads are drawn by one). */
  props: string[];
}

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ELEMENTS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'title']);

/** Hue (degrees), saturation and lightness (0 to 1) of a `#rrggbb` colour. */
export function hsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Why a sail colour is refused (too dark, or a hue kept for storms and damage), or null. */
export function sailColourProblem(hex: string): string | null {
  const [h, s, l] = hsl(hex);
  if (l < RULES.sail.minLightness)
    return `${hex} is too dark for a sail (lightness ${l.toFixed(2)})`;
  for (const r of RULES.sail.reservedHues) {
    const inside = r.from <= r.to ? h >= r.from && h <= r.to : h >= r.from || h <= r.to;
    if (inside && s >= r.minSaturation) return `${hex} is a red kept for storms and damage`;
  }
  return null;
}

/** Vertices a path's commands lay down, a curve counting as its flattened pieces. */
function pathVertices(d: string): number[] {
  const perSub: number[] = [];
  const perArg: Record<string, [number, number]> = {
    m: [2, 1],
    l: [2, 1],
    t: [2, 1],
    h: [1, 1],
    v: [1, 1],
    c: [6, 4],
    s: [4, 3],
    q: [4, 3],
    a: [7, 6],
  };
  for (const [, cmd, args] of d.matchAll(/([a-z])([^a-z]*)/gi)) {
    const c = cmd!.toLowerCase();
    if (c === 'z') continue;
    const [size, verts] = perArg[c] ?? [1, 0];
    const n = (args!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).length;
    if (c === 'm' || perSub.length === 0) perSub.push(0);
    perSub[perSub.length - 1]! += Math.floor(n / size) * verts;
  }
  return perSub;
}

/** Triangles a logo's shapes fill to, estimated: a fan per path, 6 for a circle, 2 for a rect. */
export function logoTriangles(svg: string): number {
  let tris = 0;
  for (const [, tag, attrs] of svg.matchAll(/<(path|rect|circle|ellipse|polygon)\b([^>]*)>/g)) {
    if (tag === 'path') {
      const d = /\bd="([^"]*)"/.exec(attrs!)?.[1] ?? '';
      for (const n of pathVertices(d)) tris += Math.max(0, n - 2);
    } else if (tag === 'rect') tris += 2;
    else if (tag === 'polygon') {
      const pts = /\bpoints="([^"]*)"/.exec(attrs!)?.[1] ?? '';
      tris += Math.max(0, (pts.match(/-?\d*\.?\d+/g) ?? []).length / 2 - 2);
    } else tris += 6;
  }
  return Math.ceil(tris);
}

/** What is wrong with a logo's SVG: only flat filled shapes, no text, images, styles or scripts. */
export function logoProblems(svg: string): string[] {
  const out: string[] = [];
  if (!/<svg\b[^>]*\bviewBox="/.test(svg)) out.push('the <svg> needs a viewBox');
  for (const [, tag] of svg.matchAll(/<([a-zA-Z][\w:-]*)/g))
    if (!ELEMENTS.has(tag!)) out.push(`<${tag}> is not allowed (flat filled shapes only)`);
  if (/\son\w+=|href=|style=|<!\[CDATA|stroke-width/i.test(svg))
    out.push('no scripts, links, styles or strokes: fill the shapes');
  return [...new Set(out)];
}

const unlockProblems = (u: Unlock, cx: CosmeticContext): string[] => {
  if (u.kind === 'free') return [];
  const sources = [u.quest, u.regatta, u.milestone].filter((s) => s !== undefined);
  if (sources.length !== 1) return ['earned needs exactly one of quest, regatta or milestone'];
  if (u.quest && !cx.quests.includes(u.quest)) return [`no quest "${u.quest}"`];
  if (u.regatta && !cx.series.some((s) => s.id === u.regatta)) return [`no series "${u.regatta}"`];
  return [];
};

const hexes = (what: string, list: (string | undefined)[]) =>
  list.filter((c) => c !== undefined && !HEX.test(c)).map((c) => `${what}: "${c}" is not #rrggbb`);

/** The slot-specific problems of one item. */
function slotProblems(item: Item, cat: Catalogue, cx: CosmeticContext): string[] {
  switch (item.slot) {
    case 'sail-colour':
      return HEX.test(item.cloth)
        ? [sailColourProblem(item.cloth)].filter((p) => p !== null)
        : hexes('cloth', [item.cloth]);
    case 'sail-pattern': {
      const want = RULES.patterns[item.pattern];
      if (want === undefined)
        return [
          `pattern "${item.pattern}" is not one of ${Object.keys(RULES.patterns).join(', ')}`,
        ];
      return [
        ...(item.colours.length === want ? [] : [`${item.pattern} takes ${want} colours`]),
        ...hexes('colours', item.colours),
      ];
    }
    case 'sail-logo': {
      const svg = cat.logos[item.id];
      if (svg === undefined) return [`no ${item.id}.svg beside the file`];
      const tris = logoTriangles(svg);
      return [
        ...hexes('colour', [item.colour]),
        ...logoProblems(svg),
        ...(tris > RULES.maxTriangles['sail-logo']
          ? [
              `the emblem fills to about ${tris} triangles, at most ${RULES.maxTriangles['sail-logo']}`,
            ]
          : []),
      ];
    }
    case 'hull-colour':
      return hexes('hull colour', [item.band, item.strake]);
    case 'figurehead':
      return [
        ...(RULES.mounts.includes(item.mount)
          ? []
          : [`mount "${item.mount}" is not one of ${RULES.mounts.join(', ')}`]),
        ...(cx.props.includes(item.recipe) ? [] : [`no prop recipe "${item.recipe}"`]),
        ...(Number.isInteger(item.tris) &&
        item.tris >= 1 &&
        item.tris <= RULES.maxTriangles.figurehead
          ? []
          : [`tris must be 1 to ${RULES.maxTriangles.figurehead}`]),
        ...(item.size > 0 && item.size <= 2 ? [] : ['size must be above 0 and at most 2']),
      ];
    case 'flag':
      return flagProblems(item, cx);
    case 'wake':
      return [
        ...(RULES.wakeStyles.includes(item.style)
          ? []
          : [`style "${item.style}" is not one of ${RULES.wakeStyles.join(', ')}`]),
        ...(item.tint === null ? [] : hexes('tint', [item.tint])),
      ];
    default:
      return [];
  }
}

/** A personal flag may not copy a regatta flag; a pennant must be won, and is never recoloured. */
function flagProblems(item: Extract<Item, { slot: 'flag' }>, cx: CosmeticContext): string[] {
  if (!!item.own === !!item.ref) return ['a flag has either `own` (a design) or `ref` (a pennant)'];
  if (item.ref) {
    const series = cx.series.find((s) => s.pennant === item.ref);
    if (!series)
      return [`"${item.ref}" is not the pennant of any series (Kestrel's burgee stays hers)`];
    const u = item.unlock;
    return u.kind === 'earned' && u.regatta === series.id
      ? []
      : [
          `the pennant of ${series.id} is earned by that series: unlock { kind: "earned", regatta: "${series.id}" }`,
        ];
  }
  const own = item.own!;
  const out: string[] = [];
  if (!FLAG_SHAPES.includes(own.shape))
    out.push(`shape "${own.shape}" is not one of ${FLAG_SHAPES.join(', ')}`);
  const { min, max } = RULES.flagBands;
  if (own.bands.length < min || own.bands.length > max) out.push(`bands: ${min} to ${max} colours`);
  out.push(...hexes('bands', own.bands));
  if (!(own.length >= 0.8 && own.length <= 1.4 && own.height >= 0.4 && own.height <= 0.7))
    out.push('length 0.8 to 1.4 and height 0.4 to 0.7');
  const copy = cx.flags.find(
    (f) =>
      f.shape === own.shape &&
      f.bands.length === own.bands.length &&
      f.bands.every((c, i) => c.toLowerCase() === own.bands[i]?.toLowerCase()),
  );
  if (copy) out.push(`looks exactly like the flag "${copy.id}" (a regatta prize or Kestrel's)`);
  return out;
}

/** Every problem in a catalogue, one line each, "slot/id: what". */
export function cosmeticProblems(cat: Catalogue, cx: CosmeticContext): string[] {
  const out: string[] = [];
  const add = (item: Item, msgs: string[]) =>
    out.push(...msgs.map((m) => `${item.slot}/${item.id}: ${m}`));
  const seen = new Set<string>();
  for (const item of cat.items) {
    const key = `${item.slot}/${item.id}`;
    if (!ID.test(item.id)) add(item, ['id: lower case words joined by "-"']);
    if (seen.has(key)) add(item, ['duplicate id']);
    seen.add(key);
    if (!item.name?.en?.trim() || !item.name?.fr?.trim()) add(item, ['name needs en and fr']);
    if (!item.unlock) add(item, ['unlock is missing']);
    else add(item, unlockProblems(item.unlock, cx));
    if (item.slot === 'set') add(item, setProblems(item, cat));
    else {
      for (const c of item.classes ?? [])
        if (!cx.shipClasses.includes(c)) add(item, [`no ship class "${c}"`]);
      add(item, slotProblems(item, cat, cx));
    }
  }
  for (const id of Object.keys(cat.logos))
    if (!cat.items.some((i) => i.slot === 'sail-logo' && i.id === id))
      out.push(`sail-logo/${id}: ${id}.svg has no ${id}.json`);
  for (const slot of SLOTS) out.push(...stockProblems(cat, slot));
  return out;
}

function setProblems(set: Extract<Item, { slot: 'set' }>, cat: Catalogue): string[] {
  return Object.entries(set.items).flatMap(([slot, id]) =>
    !SLOTS.includes(slot as Slot)
      ? [`no slot "${slot}"`]
      : cat.items.some((i) => i.slot === slot && i.id === id)
        ? []
        : [`${slot}: no item "${id}"`],
  );
}

/** A slot's stock item must exist (when the slot has one) and be free. */
function stockProblems(cat: Catalogue, slot: Slot): string[] {
  const id = RULES.stock[slot];
  if (id === null) return [];
  const item = cat.items.find((i) => i.slot === slot && i.id === id);
  if (!item) return [`${slot}/${id}: the stock item (rules.json) is missing`];
  return item.unlock.kind === 'free' ? [] : [`${slot}/${id}: the stock item must be free`];
}
