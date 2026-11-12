import { formatJson } from '../../data/jsonFormat';
import { GROUNDS } from '../../data/grounds';
import { PROP_TYPES } from '../../render/models/props';
import { TOWN_RULES, type TownRules, townRulesProblems } from '../../sim/townRules';
import type { FieldsDoc } from '../fieldsDoc';

/**
 * `src/data/town-rules.json` as the editors' Town rules page and `npm run towns` edit it (issue
 * #513, decision 0153): one description of the file's fields, styles, checks and text, so the
 * page and the command can never disagree (`fieldsDoc.ts` does the editing).
 */
export type TownRulesDoc = TownRules;

export const TOWN_RULES_FILE = 'src/data/town-rules.json';

export const shippedTownRulesDoc = (): TownRulesDoc => structuredClone(TOWN_RULES);

export const townRulesDocProblems = (doc: TownRulesDoc) =>
  townRulesProblems(doc, { props: Object.keys(PROP_TYPES), grounds: Object.keys(GROUNDS) });

/** A working copy read back from the browser: only the shape, the checks say the rest. */
export function isTownRulesDoc(raw: unknown): raw is TownRulesDoc {
  const doc = raw as TownRulesDoc | null;
  return !!doc && typeof doc.styles === 'object' && !!doc.houses && !!doc.types;
}

export const TOWN_RULES_DOC: FieldsDoc<TownRulesDoc> = {
  tool: 'towns',
  file: TOWN_RULES_FILE,
  storageKey: 'fwt-editor-town-rules',
  about: 'Town rules',
  shipped: shippedTownRulesDoc,
  isDoc: isTownRulesDoc,
  text: (doc) => formatJson(doc),
  problems: townRulesDocProblems,
  kinds: { key: 'styles', name: 'town style' },
  sections: (doc) => [
    ...Object.keys(doc.styles).map((id) => `styles.${id}`),
    'houses',
    'harbour',
    'lanes',
    'piers',
    'fields',
    'woods',
    'types',
    'grading',
  ],
  sectionAbout: {
    styles:
      'The rules an island style changes (art bible › Towns): slope "warn, fail" in degrees; setback from the waterline, below 0 out over the water; spacing "merge under, row within"; lonely and laneReach; fields yes or no; avoid: grounds a house never stands on; hazardGap from lava, ash and the cone (0: none). Distances in W, the town’s house width. A style not listed takes default.',
    houses:
      'Every house: a church on a rise (degrees), a quay house’s setback, how far a door looks for a lane or quay before the water, the facing error "warn, fail" and a row’s turn (degrees).',
    harbour:
      'The harbour is the centre: the core’s radius and its slope warning (a main port only: a town of mainPort houses or more), the houses’ centre, the share within shareReach, the nearest church or market (W).',
    lanes:
      'Lanes follow the shore or the contour within turn (ground under flat has none), warn past offShare; the waterfront lane "near, far" from the water; steepest climb (degrees); an end within endReach of something.',
    piers: 'Piers start within shore (W) of it and run out within square (degrees) of square.',
    fields: 'Fields and orchards: steepest ground (degrees), "nearest, furthest" from a house (W).',
    woods:
      'Trees on ground flatter than slope (degrees) near the harbour stand on the town’s ground; houseGap (W) keeps them off the houses.',
    types:
      'Prop types the rules name: civic (the harbour’s church or market), churches, outliers (farms may stand apart), fields, quays a door faces, laneEnds.',
    grading:
      'fails: what a failed rule counts as, "warning" until towns 2 and 3 fix the islands, then "error".',
  },
  names: 'Grounds are palette.json ground ids; types are prop ids (src/data/props/).',
};
