// `npm run folk` (decision 0153, issue #477): the people of the towns in src/data/town-folk.json
// from the command line, with the editors' Town folk page's own fields, edits and checks.
import { TOWN_FOLK_DOC } from '../../src/editor/townFolk/doc';
import { type Args, runFieldsCli } from './fieldsCli';

export const run = (args: Args) => runFieldsCli(TOWN_FOLK_DOC, args);
