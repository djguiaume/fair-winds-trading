import { describe, expect, it } from 'vitest';
import { UltraTrial } from '../src/render/ultraTrial';
import { capQuality } from '../src/render/quality';

function memory() {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  };
}

describe('Ultra trial (decision 0244)', () => {
  it('trusts Ultra after enough frames', () => {
    const store = memory();
    const trial = new UltraTrial(store, 20);
    trial.tick(10);
    trial.tick(10);
    expect(new UltraTrial(store, 20).failed).toBe(false);
    expect(store.getItem('fwt.ultraTrial')).toBe('ok');
  });

  it('holds the next page at High when the last Ultra run died before proving itself', () => {
    const store = memory();
    new UltraTrial(store, 20).tick(5);
    const next = new UltraTrial(store, 20);
    expect(next.failed).toBe(true);
    expect(new UltraTrial(store, 20).failed).toBe(true);
  });

  it('fails at once when the graphics are lost, even after Ultra proved itself', () => {
    const store = memory();
    const trial = new UltraTrial(store, 1);
    trial.tick(2);
    trial.fail();
    expect(trial.failed).toBe(true);
    expect(new UltraTrial(store, 1).failed).toBe(true);
  });

  it('does not blame Ultra for being left early', () => {
    const store = memory();
    const trial = new UltraTrial(store, 20);
    trial.tick(5);
    trial.stop();
    expect(new UltraTrial(store, 20).failed).toBe(false);
  });

  it('works without storage', () => {
    const trial = new UltraTrial(null, 20);
    trial.tick(30);
    expect(trial.failed).toBe(false);
  });

  it('caps a level at the highest one allowed', () => {
    expect(capQuality('ultra', 'high')).toBe('high');
    expect(capQuality('medium', 'high')).toBe('medium');
    expect(capQuality('ultra', 'ultra')).toBe('ultra');
  });
});
