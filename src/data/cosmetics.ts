import { SHIP_FILES } from './ships';
import { PROP_RECIPES } from './props';
import { QUESTS } from '../sim/quests';
import { FLAGS, REGATTA } from '../sim/regatta';
import type { Catalogue, Item } from '../sim/cosmetics';
import type { CosmeticContext } from '../sim/cosmeticChecks';

/**
 * The cosmetic items as the game ships them (decision 0261): every `src/data/cosmetics/<slot>/<id>.json`
 * is an item, every `sail-logo/<id>.svg` its emblem. Adding a file adds the item. How:
 * docs/content/cosmetics.md.
 */
const itemFiles = import.meta.glob<Item>('./cosmetics/*/*.json', {
  eager: true,
  import: 'default',
});
const logoFiles = import.meta.glob<string>('./cosmetics/sail-logo/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const idOf = (path: string) => /([^/]+)\.[a-z]+$/.exec(path)![1]!;

export const SHIPPED_CATALOGUE: Catalogue = {
  items: Object.values(itemFiles),
  logos: Object.fromEntries(Object.entries(logoFiles).map(([p, svg]) => [idOf(p), svg])),
};

/** What the checks compare items with: classes, quests, series, flags and prop recipes. */
export const cosmeticContext = (): CosmeticContext => ({
  shipClasses: SHIP_FILES.map((s) => s.id),
  quests: QUESTS.map((q) => q.id),
  series: REGATTA.series.map((s) => ({ id: s.id, pennant: s.pennant })),
  flags: FLAGS,
  props: Object.keys(PROP_RECIPES),
});
