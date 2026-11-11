import { FieldsPage } from '../fieldsPage';
import { SEA_LIFE_DOC } from './doc';

/** The editors' Sea life page (issue #476): `src/data/sea-life.json`, as `npm run life` edits it. */
const page = new FieldsPage(SEA_LIFE_DOC);

export const seaLifeOpen = () => page.open;
export const setupSeaLifePage = (close: () => void) => page.setup(close);
export const openSeaLife = () => page.openPage();
