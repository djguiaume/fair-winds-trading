import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  flagSvg,
  flagsText,
  regattaProblems,
  regattaText,
  removeFlag,
  setFlag,
  setRule,
  setSeries,
  shippedRegattaDoc,
} from '../src/editor/regatta/doc';

// Decision 0217: the Regatta page and `npm run race -- set|series|flag` edit regatta.json and
// flags.json with the same pure edits, checks and export.

describe('regatta editor (decision 0217)', () => {
  it('exports both files byte for byte as shipped, and they pass the checks', () => {
    const doc = shippedRegattaDoc();
    expect(regattaText(doc)).toBe(readFileSync('src/data/regatta.json', 'utf8'));
    expect(flagsText(doc)).toBe(readFileSync('src/data/flags.json', 'utf8'));
    expect(regattaProblems(doc)).toEqual([]);
  });

  it('sets values by path as the kind the file holds', () => {
    const doc = shippedRegattaDoc();
    expect(setRule(doc, 'medals.silver', '1.2')).toBeNull();
    expect(doc.regatta.medals.silver).toBe(1.2);
    expect(setRule(doc, 'rival.paceRange', '0.5,1.3')).toBeNull();
    expect(doc.regatta.rival.paceRange).toEqual([0.5, 1.3]);
    expect(setRule(doc, 'rival.hull', '#ffffff')).toBeNull();
    expect(setRule(doc, 'rival.paceRange', '2')).toMatch(/2 numbers/);
    expect(setRule(doc, 'medals.tin', '1')).toMatch(/no/);
    expect(setRule(doc, 'countdownSec', 'soon')).toMatch(/a number/);
    // A silver slower than bronze is refused by the checks.
    setRule(doc, 'medals.silver', '2');
    expect(regattaProblems(doc).some((p) => p.includes('medals.silver'))).toBe(true);
  });

  it('adds and changes series and flags; a pennant must name a flag', () => {
    const doc = shippedRegattaDoc();
    setFlag(doc, 'pennant-test', { shape: 'swallowtail', bands: ['#123456', '#abcdef'] });
    setSeries(doc, 'regatta-test', { name: 'A test', pennant: 'pennant-test' });
    expect(regattaProblems(doc)).toEqual([]);
    expect(flagSvg(doc.flags.flags.at(-1)!)).toContain('#abcdef');
    removeFlag(doc, 'pennant-test');
    expect(regattaProblems(doc).some((p) => p.includes('no flag "pennant-test"'))).toBe(true);
  });
});
