import { FieldsPage } from '../fieldsPage';
import { TOWN_RULES_DOC } from './doc';

/** The editors' Town rules page (issue #513): `src/data/town-rules.json`, as `npm run towns` edits it. */
const page = new FieldsPage(TOWN_RULES_DOC);

export const townRulesOpen = () => page.open;
export const setupTownRulesPage = (close: () => void) => page.setup(close);
export const openTownRules = () => page.openPage();
