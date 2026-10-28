import { PAD, PAD_AXES, PAD_BRANDS, PAD_BUTTONS, type PadBrand, type PadControls } from './gamepad';

/**
 * The checks on `src/data/controls.json` (decisions 0162, 0186): shared by the game's tests, the
 * editors' Controls page and `npm run check`.
 */

/** Problems in `padBrands`: none, unknown buttons, empty names, a brand without names. */
export function brandProblems(brands: Record<string, PadBrand> = PAD_BRANDS): string[] {
  const out: string[] = [];
  const buttons = new Set<string>(PAD_BUTTONS);
  if (!Object.keys(brands).length) out.push('padBrands: needs at least one brand');
  for (const [name, b] of Object.entries(brands)) {
    for (const [button, label] of Object.entries(b.names)) {
      if (!buttons.has(button)) out.push(`padBrands.${name}: no button "${button}"`);
      if (!label?.trim()) out.push(`padBrands.${name}.${button}: empty name`);
    }
    for (const button of ['a', 'b', 'x', 'y'] as const)
      if (!b.names[button]) out.push(`padBrands.${name}: no name for ${button}`);
    if (b.match.some((w) => !w.trim())) out.push(`padBrands.${name}.match: an empty word`);
    for (const [lang, names] of Object.entries(b.lang ?? {}))
      for (const button of Object.keys(names))
        if (!buttons.has(button)) out.push(`padBrands.${name}.lang.${lang}: no button "${button}"`);
  }
  return out;
}

/** The settings that name a stick axis, in any place. */
const AXIS_KEYS = 'steerAxis zoomAxis orbitAxis panX panY moveX moveY scrollY'.split(' ');

/** Problems in a controls file: unknown buttons or axes, actions with no button, bad numbers. */
export function controlProblems(c: PadControls = PAD): string[] {
  const out: string[] = [];
  const buttons = new Set<string>(PAD_BUTTONS);
  const axes = new Set<string>(PAD_AXES);
  if (!(c.deadZone >= 0 && c.deadZone < 1)) out.push('deadZone must be 0..1');
  if (c.sampleEveryMs !== undefined && !(c.sampleEveryMs >= 0 && c.sampleEveryMs <= 50))
    out.push('sampleEveryMs must be 0..50 (0: once a frame only)');
  if (!(c.triggerPress > 0 && c.triggerPress <= 1)) out.push('triggerPress must be 0..1');
  if (!(c.repeatDelayMs > 0 && c.repeatEveryMs > 0)) out.push('repeat timings must be > 0');
  if (!(c.menu.stickPress > 0 && c.menu.stickPress <= 1)) out.push('menu.stickPress must be 0..1');
  if (!(c.menu.hintsSeconds >= 0)) out.push('menu.hintsSeconds must be 0 or more (0: always up)');
  if (!(c.menu.scrollPxPerSec > 0)) out.push('menu.scrollPxPerSec must be > 0');
  const contexts = { sea: c.sea, chart: c.chart, menu: c.menu } as Record<
    string,
    { actions: Record<string, string[]> } & Record<string, unknown>
  >;
  for (const [name, ctx] of Object.entries(contexts)) {
    for (const key of AXIS_KEYS)
      if (key in ctx && !axes.has(ctx[key] as string))
        out.push(`${name}.${key}: no axis "${String(ctx[key])}"`);
    for (const [action, list] of Object.entries(ctx.actions)) {
      if (!list.length) out.push(`${name}.${action}: no button`);
      for (const b of list) if (!buttons.has(b)) out.push(`${name}.${action}: no button "${b}"`);
    }
  }
  return out;
}
