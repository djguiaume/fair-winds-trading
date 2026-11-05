import { FieldsPage } from '../fieldsPage';
import { TOWN_FOLK_DOC } from './doc';

/** The editors' Town folk page (issue #477): `src/data/town-folk.json`, as `npm run folk` edits it. */
const page = new FieldsPage(TOWN_FOLK_DOC);

export const townFolkOpen = () => page.open;
export const setupTownFolkPage = (close: () => void) => page.setup(close);
export const openTownFolk = () => page.openPage();
