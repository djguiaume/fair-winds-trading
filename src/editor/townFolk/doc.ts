import { formatJson } from '../../data/jsonFormat';
import { PALETTE, PROP_RECIPES } from '../../data/props';
import { QUALITY_LEVELS } from '../../render/quality';
import { TOWN_FOLK, type TownFolkData, WHERES } from '../../sim/townFolk';
import { townFolkProblems } from '../../sim/townFolkChecks';
import type { FieldsDoc } from '../fieldsDoc';

/**
 * `src/data/town-folk.json` as the editors' Town folk page and `npm run folk` edit it (issue
 * #477, decision 0153): one description of the file's fields, kinds, checks and text, so the
 * page and the command can never disagree (`fieldsDoc.ts` does the editing).
 */
export type TownFolkDoc = TownFolkData;

export const FOLK_FILE = 'src/data/town-folk.json';

export const shippedFolkDoc = (): TownFolkDoc => structuredClone(TOWN_FOLK);

export const folkProblems = (doc: TownFolkDoc) =>
  townFolkProblems(doc, {
    levels: QUALITY_LEVELS,
    recipes: Object.keys(PROP_RECIPES),
    colors: Object.keys(PALETTE.colors),
  });

export const folkText = (doc: TownFolkDoc) => formatJson(doc);

/** A working copy read back from the browser: only the shape, the checks say the rest. */
export function isFolkDoc(raw: unknown): raw is TownFolkDoc {
  const doc = raw as TownFolkDoc | null;
  return !!doc && typeof doc.kinds === 'object' && !!doc.town && Array.isArray(doc.town.perLevel);
}

export const TOWN_FOLK_DOC: FieldsDoc<TownFolkDoc> = {
  tool: 'folk',
  file: FOLK_FILE,
  storageKey: 'fwt-editor-town-folk',
  about: 'Town folk',
  shipped: shippedFolkDoc,
  isDoc: isFolkDoc,
  text: folkText,
  problems: folkProblems,
  kinds: { key: 'kinds', name: 'kind of person' },
  sections: (doc) => [...Object.keys(doc.kinds).map((id) => `kinds.${id}`), 'town', 'quality'],
  sectionAbout: {
    quality: 'Share of every count drawn at each quality level (0 to 1); Ultra-low draws none.',
    kinds:
      'A kind of person and its share of a town: where it goes (lane; pier; edge: standing fishing at a pier side; cargo: carrying between the cargo and the pier), its speed (reference units a second, 0 stands), its steps a second and its rest at each end, "low, high" seconds.',
    town: 'The town as a whole: the person model, the palette list its coats come from, how many people a town has at each level, how far off the boat sees them, how they fade, and the share left at night.',
  },
  names: `Where: ${WHERES.join(', ')}. The model is a prop recipe (folk-*), coats a palette colour list, cargo prop recipe ids.`,
};
