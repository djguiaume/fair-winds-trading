import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  controlsProblems,
  controlsText,
  isControlsDoc,
  padNumbers,
  placeFields,
  shippedControls,
  toggleButton,
} from '../src/editor/controls/doc';

// The controls page (decision 0189): it edits all of controls.json and exports it as written.
describe('controls page', () => {
  it('exports the shipped file byte for byte', () => {
    expect(controlsText(shippedControls())).toBe(readFileSync('src/data/controls.json', 'utf8'));
  });
  it('the shipped file passes the checks, a broken one does not', () => {
    expect(controlsProblems(shippedControls())).toEqual([]);
    const doc = shippedControls();
    doc.gamepad.chart.actions.pick = [];
    doc.tv.safeMargin.y = 1;
    doc.padBrands.xbox!.names.a = ' ';
    expect(controlsProblems(doc)).toHaveLength(3);
  });
  it('lists each place’s sticks and numbers, and the pad-wide numbers', () => {
    const doc = shippedControls();
    expect(placeFields(doc, 'chart').axes).toEqual(['panX', 'panY']);
    expect(placeFields(doc, 'chart').numbers).toContain('pickReachPx');
    expect(padNumbers(doc)).toContain('sampleEveryMs');
  });
  it('turns buttons on and off in the pad’s order', () => {
    expect(toggleButton(['b'], 'a')).toEqual(['a', 'b']);
    expect(toggleButton(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('knows a controls file', () => {
    expect(isControlsDoc(shippedControls())).toBe(true);
    expect(isControlsDoc({ gamepad: {} })).toBe(false);
  });
});
