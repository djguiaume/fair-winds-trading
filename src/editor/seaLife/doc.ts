import { RING } from '../../audio/catalog';
import { SEA_SECTORS } from '../../data/grownMap';
import { formatJson } from '../../data/jsonFormat';
import { PALETTE, PROP_RECIPES } from '../../data/props';
import { QUALITY_LEVELS } from '../../render/quality';
import { SEA_LIFE, type SeaLifeData } from '../../sim/seaLife';
import { seaLifeProblems } from '../../sim/seaLifeChecks';
import type { FieldsDoc } from '../fieldsDoc';

/**
 * `src/data/sea-life.json` as the editors' Sea life page and `npm run life` edit it (issue
 * #476, decision 0153): one description of the file's fields, kinds, checks and text, so the
 * page and the command can never disagree (`fieldsDoc.ts` does the editing).
 */
export type SeaLifeDoc = SeaLifeData;

export const LIFE_FILE = 'src/data/sea-life.json';

export const shippedLifeDoc = (): SeaLifeDoc => structuredClone(SEA_LIFE);

/** The sea ids a creature may live in: the ring and each grown sea. */
export const LIFE_SEAS = [RING, ...Object.keys(SEA_SECTORS)];

export const lifeProblems = (doc: SeaLifeDoc) =>
  seaLifeProblems(doc, {
    levels: QUALITY_LEVELS,
    seas: LIFE_SEAS,
    recipes: Object.keys(PROP_RECIPES),
    colors: Object.keys(PALETTE.colors),
  });

export const lifeText = (doc: SeaLifeDoc) => formatJson(doc);

/** A working copy read back from the browser: only the shape, the checks say the rest. */
export function isLifeDoc(raw: unknown): raw is SeaLifeDoc {
  const doc = raw as SeaLifeDoc | null;
  return !!doc && typeof doc.birds === 'object' && !!doc.dolphins && !!doc.whale && !!doc.shoals;
}

export const SEA_LIFE_DOC: FieldsDoc<SeaLifeDoc> = {
  tool: 'life',
  file: LIFE_FILE,
  storageKey: 'fwt-editor-sea-life',
  about: 'Sea life',
  shipped: shippedLifeDoc,
  isDoc: isLifeDoc,
  text: lifeText,
  problems: lifeProblems,
  kinds: { key: 'birds', name: 'bird kind' },
  sections: (doc) => [
    ...Object.keys(doc.birds).map((id) => `birds.${id}`),
    'dolphins',
    'whale',
    'shoals',
    'quality',
  ],
  sectionAbout: {
    quality:
      'Share of every count drawn at each quality level (0 to 1); Ultra-low draws none. A group\'s "from" is the lowest level that draws it.',
    birds:
      'A flock circling its home near the boat: harbour (the nearest pier head), reef or wake (astern of her near a coast). Spans are "low, high".',
    dolphins: 'A pod now and then in its waters: rides abeam of the boat, leaping in turn.',
    whale: 'Surfaces now and then off the bow in deep water: rises, blows, dives flukes up.',
    shoals: 'Dark fish just under the surface, placed round the boat where fish live.',
  },
  names: `Seas: ${LIFE_SEAS.join(', ')}. Models are prop recipes (life-*).`,
};
