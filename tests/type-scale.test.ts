import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Game CSS takes its type from the tokens in theme.css (issue #319, ADR 0220).
const dir = 'src/ui';
const sheets = readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'theme.css');
const lines = (file: string) => readFileSync(`${dir}/${file}`, 'utf8').split('\n');

const RAW = [
  { what: 'a pixel font size', re: /font(-size)?:\s*(\d+\s+)?[\d.]+px/ },
  { what: 'a font family name', re: /font-family:\s*'/ },
  { what: 'a hex text colour', re: /^\s*color:\s*#/ },
];

describe('game CSS type', () => {
  for (const { what, re } of RAW) {
    it(`has no ${what} outside theme.css`, () => {
      const found = sheets.flatMap((f) =>
        lines(f)
          .map((line, i) => (re.test(line) ? `${f}:${i + 1} ${line.trim()}` : ''))
          .filter(Boolean),
      );
      expect(found).toEqual([]);
    });
  }
});
