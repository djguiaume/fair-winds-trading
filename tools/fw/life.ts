// `npm run life` (decision 0153, issue #476): the birds and sea life of src/data/sea-life.json
// from the command line, with the editors' Sea life page's own fields, edits and checks.
import { SEA_LIFE_DOC } from '../../src/editor/seaLife/doc';
import { type Args, runFieldsCli } from './fieldsCli';

export const run = (args: Args) => runFieldsCli(SEA_LIFE_DOC, args);
