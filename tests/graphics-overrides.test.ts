import { describe, expect, it } from 'vitest';
import { describeOverrides, graphicsOverrides } from '../src/perf/graphicsOverrides';

describe('?quality and ?off device-test switches (issue #377)', () => {
  it('changes nothing when neither is set', () => {
    expect(graphicsOverrides('?perf')).toEqual({ quality: null, off: [] });
  });

  it('reads a quality level and ignores unknown ones', () => {
    expect(graphicsOverrides('?quality=ultra').quality).toBe('ultra');
    expect(graphicsOverrides('?quality=extreme').quality).toBeNull();
  });

  it('maps the off names to effects, once each, ignoring unknown names', () => {
    const { off } = graphicsOverrides('?off=AO,msaa,nonsense,ao,tonemap');
    expect(off).toEqual(['occlusion', 'msaa', 'toneMapping']);
  });

  it('says in the report what ran', () => {
    expect(describeOverrides('v2', graphicsOverrides('?off=ao,msaa&quality=ultra'))).toBe(
      'look v2 · quality forced ultra · off ao,msaa',
    );
    expect(describeOverrides('v1', graphicsOverrides(''))).toBe('look v1 · all effects on');
  });
});
