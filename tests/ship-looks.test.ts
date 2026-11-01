import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SHIPPED_CATALOGUE as CAT } from '../src/data/cosmetics';
import { stockAppearance } from '../src/sim/cosmetics';
import { loadGame, SAVE_KEY, serializeWorld, validateSave } from '../src/sim/save';
import { readSaveCode, encodeSaveCode, readSaveFile, saveFileText } from '../src/sim/saveTransfer';
import { LookDraft, lookOf, readLooks, type ShipLooks } from '../src/sim/shipLooks';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';

const freeIn = (slot: string, not: string) =>
  CAT.items.find((i) => i.slot === slot && i.id !== not && i.unlock.kind === 'free')!.id;
const colour = freeIn('sail-colour', stockAppearance().sailColour);

function worldWithLook() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  const ship = world.trade.captain.activeShip;
  world.trade.captain.looks = { [ship]: { sailColour: colour } };
  return { world, ship };
}

describe('ship looks', () => {
  it('a legacy save has no looks and the stock look', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const data = serializeWorld(world);
    expect(data.looks).toBeUndefined();
    const back = validateSave(JSON.parse(JSON.stringify(data)), world)!;
    expect(back.looks).toBeUndefined();
    expect(lookOf(back.looks, world.trade.captain.activeShip)).toEqual(stockAppearance());
  });

  it('round-trips through JSON, a save code and a file', () => {
    const { world, ship } = worldWithLook();
    const data = serializeWorld(world);
    expect(validateSave(JSON.parse(JSON.stringify(data)), world)!.looks).toEqual({
      [ship]: { sailColour: colour },
    });
    const code = readSaveCode(encodeSaveCode(data, PHASE1_MAP), world);
    expect(code.ok && code.save.looks).toEqual({ [ship]: { sailColour: colour } });
    const file = readSaveFile(saveFileText(data, new Date(0)), world);
    expect(file.ok && file.save.looks).toEqual({ [ship]: { sailColour: colour } });
  });

  it('does not store a cleared slot that already is stock', () => {
    const looks = readLooks(CAT, { sloop: { sailLogo: null, flag: null } }, ['sloop']);
    expect(looks.sloop ?? {}).toEqual({});
  });

  it('drops unknown ids, unknown slots, unowned ships and stock values', () => {
    const raw = {
      sloop: { sailColour: 'no-such', sailPattern: 7, hat: 'x', wake: stockAppearance().wake },
      ghost: { sailColour: colour },
    };
    expect(readLooks(CAT, raw, ['sloop'])).toEqual({});
    expect(readLooks(CAT, 'junk', ['sloop'])).toEqual({});
    expect(readLooks(CAT, { sloop: { sailColour: colour, sailLogo: 3 } }, ['sloop'])).toEqual({
      sloop: { sailColour: colour },
    });
  });

  it('a damaged looks block never loses the voyage', () => {
    const { world } = worldWithLook();
    const raw = JSON.parse(JSON.stringify(serializeWorld(world)));
    raw.looks = { [world.trade.captain.activeShip]: { sailColour: 'removed-item' } };
    const back = validateSave(raw, world)!;
    expect(back.gold).toBe(world.trade.captain.gold);
    expect(back.looks).toBeUndefined();
  });

  it('switching ships restores each ship its own look', () => {
    const looks: ShipLooks = { sloop: { sailColour: colour } };
    expect(lookOf(looks, 'sloop').sailColour).toBe(colour);
    expect(lookOf(looks, 'brig').sailColour).toBe(stockAppearance().sailColour);
  });

  it('autosave and reload keep the look', () => {
    const { world, ship } = worldWithLook();
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    storage.setItem(SAVE_KEY, JSON.stringify(serializeWorld(world)));
    const fresh = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, fresh)).toBe(true);
    expect(fresh.trade.captain.looks?.[ship]).toEqual({ sailColour: colour });
  });
});

describe('look draft', () => {
  const ship = 'sloop';

  it('preview and cancel never touch the stored look or the save', () => {
    const { world, ship: active } = worldWithLook();
    const looks = world.trade.captain.looks!;
    const draft = new LookDraft(CAT, looks, active);
    const other = freeIn('sail-colour', colour);
    expect(draft.preview('sailColour', other)).toBe(true);
    expect(draft.changed).toBe(true);
    expect(serializeWorld(world).looks).toEqual({ [active]: { sailColour: colour } });
    draft.cancel();
    expect(draft.current.sailColour).toBe(colour);
    expect(draft.changed).toBe(false);
  });

  it('apply commits all previewed slots at once, stock removes the entry', () => {
    const looks: ShipLooks = {};
    const draft = new LookDraft(CAT, looks, ship);
    draft.preview('sailColour', colour);
    expect(looks[ship]).toBeUndefined();
    draft.apply();
    expect(looks[ship]).toEqual({ sailColour: colour });
    draft.stock();
    draft.apply();
    expect(looks[ship]).toBeUndefined();
  });

  it('refuses unknown, unfit, locked and non-clearable choices', () => {
    const draft = new LookDraft(CAT, {}, ship);
    expect(draft.preview('sailColour', 'no-such')).toBe(false);
    expect(draft.preview('sailColour', null)).toBe(false);
    const locked = CAT.items.find((i) => i.slot === 'figurehead' && i.unlock.kind === 'earned')!;
    expect(draft.preview('figurehead', locked.id)).toBe(false);
    const allowed = new LookDraft(CAT, {}, ship, () => true);
    const classes = 'classes' in locked ? locked.classes : undefined;
    const fits = !classes || classes.includes(ship);
    expect(allowed.preview('figurehead', locked.id)).toBe(fits);
  });
});

describe('setShipLook', () => {
  it('writes a valid look and refuses a bad one without changing anything', async () => {
    const { setShipLook, shipLook } = await import('../src/sim/shipLooks');
    const captain: { looks?: ShipLooks } = {};
    const good = { ...stockAppearance(), sailColour: colour };
    expect(setShipLook(captain, CAT, 'sloop', good)).toBe(true);
    expect(shipLook(captain, 'sloop')).toEqual(good);
    expect(setShipLook(captain, CAT, 'sloop', { ...good, sailPattern: 'nope' })).toBe(false);
    expect(shipLook(captain, 'sloop')).toEqual(good);
  });
});
