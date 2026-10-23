import { describe, expect, it, vi } from 'vitest';

// Decision 0108: a good or a weather kind added to its JSON file exists everywhere, with no code.
vi.mock('../src/data/tuning/goods.json', async (importOriginal) => {
  const goods = ((await importOriginal()) as { default: Record<string, object> }).default;
  const salt = { id: 'salt', name: 'Salt', kind: 'raw', basePrice: 12, icon: '🧂' };
  return { default: { ...goods, salt } };
});
vi.mock('../src/data/tuning/weather.json', async (importOriginal) => {
  const weather = (
    (await importOriginal()) as {
      default: { default: { kinds: Record<string, object> } } & Record<string, unknown>;
    }
  ).default;
  const fog = { name: 'Fog', weight: 0.3, strength: [0.4, 0.6], rain: 0, gusts: 0.5, gloom: 0.4 };
  const kinds = { ...weather.default.kinds, fog };
  return { default: { ...weather, default: { ...weather.default, kinds } } };
});

const { GOODS, RAW_GOODS, emptyAmounts, isGood } = await import('../src/sim/goods');
const { DEFAULT_WEATHER, WEATHER_KINDS, weatherSlot } = await import('../src/sim/wind');
const { goodName, weatherName } = await import('../src/i18n');
const { PHASE1_MAP } = await import('../src/data/maps');
const { SLOOP } = await import('../src/sim/ship');
const { createWorld } = await import('../src/sim/world');
const { serializeWorld, validateSave } = await import('../src/sim/save');

describe('content added in data files only (decision 0108)', () => {
  it('a new good in goods.json is a good: listed, typed by kind, named and saved', () => {
    expect(GOODS).toContain('salt');
    expect(RAW_GOODS).toContain('salt');
    expect(isGood('salt')).toBe(true);
    expect(emptyAmounts()).toHaveProperty('salt', 0);
    // No translation yet: the name from the file.
    expect(goodName('salt')).toBe('Salt');
    const world = createWorld(PHASE1_MAP, SLOOP);
    (world.trade.captain.cargo as Record<string, number>).salt = 3;
    const back = validateSave(JSON.parse(JSON.stringify(serializeWorld(world))), world);
    expect((back!.cargo as Record<string, number>).salt).toBe(3);
  });

  it('a new weather kind in weather.json comes up at sea and has a name', () => {
    expect(WEATHER_KINDS).toContain('fog');
    let fog = 0;
    for (let slot = 1; slot < 300; slot++) {
      const w = weatherSlot(DEFAULT_WEATHER, 7, slot);
      if (w.kind !== 'fog') continue;
      fog++;
      expect(w.gloom).toBe(0.4);
    }
    expect(fog).toBeGreaterThan(20);
    expect(weatherName('fog')).toBe('Fog');
  });
});
