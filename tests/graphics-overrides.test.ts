import { describe, expect, it } from 'vitest';
import { applyGraphicsOverrides, describeOverrides } from '../src/perf/graphicsOverrides';

const fresh = () => ({
  quality: 'auto' as const,
  effects: {} as Record<string, boolean>,
  seaLife: true,
  townFolk: true,
});

describe('?quality and ?off device-test switches (issue #377)', () => {
  it('changes nothing when neither is set', () => {
    const s = fresh();
    expect(applyGraphicsOverrides('?perf', s)).toBe(false);
    expect(s).toEqual(fresh());
  });

  it('forces a quality level and ignores unknown ones', () => {
    const s = fresh();
    expect(applyGraphicsOverrides('?quality=ultra', s)).toBe(true);
    expect(s.quality).toBe('ultra');
    const t = fresh();
    expect(applyGraphicsOverrides('?quality=extreme', t)).toBe(false);
    expect(t.quality).toBe('auto');
  });

  it('turns effects off by name, ignoring unknown names', () => {
    const s = fresh();
    applyGraphicsOverrides('?off=AO,msaa,nonsense,ao,tonemap', s);
    expect(s.effects).toEqual({ occlusion: false, msaa: false, toneMapping: false });
  });

  it('turns sea life off for a device run with and without it (issue #476)', () => {
    const s = fresh();
    expect(applyGraphicsOverrides('?bench&off=life', s)).toBe(true);
    expect(s.seaLife).toBe(false);
    expect(s.effects).toEqual({});
    const t = fresh();
    applyGraphicsOverrides('?bench&off=folk', t);
    expect(t.townFolk).toBe(false);
    expect(t.seaLife).toBe(true);
  });

  it('says in the report what ran', () => {
    expect(describeOverrides('?off=ao,msaa&quality=ultra')).toBe(
      'look v2 · quality forced ultra · off ao,msaa',
    );
    expect(describeOverrides('?look=v1')).toBe('look v1 · all effects on');
  });
});
