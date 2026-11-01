// The game's own portraits for the mockups: npx tsx docs/ui-refactor/v1.6/portraits.ts > portraits-src.json
import { character, portraitSvg } from '../../../src/ui/portraits';

const out: Record<string, string> = {};
for (const id of ['rook', 'kit', 'maren', 'ines']) {
  const c = character(id);
  if (!c) throw new Error(`no character ${id}`);
  out[id] = portraitSvg(c, { size: 200, mood: id === 'kit' ? 'worried' : 'neutral' });
}
console.log(JSON.stringify(out));
