// `npm run towns` (decision 0153, issue #513): the town layout rules in src/data/town-rules.json
// from the command line, with the editors' Town rules page's own fields, edits and checks.
// `npm run island -- audit` runs the rules over every town.
import { TOWN_RULES_DOC } from '../../src/editor/townRules/doc';
import { type Args, runFieldsCli } from './fieldsCli';

export const run = (args: Args) => runFieldsCli(TOWN_RULES_DOC, args);
