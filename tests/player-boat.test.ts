import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { SHIPPED_CATALOGUE } from '../src/data/cosmetics';
import { PlayerBoat } from '../src/render/playerBoat';
import { SLOOP } from '../src/sim/ship';
import { setShipLook, shipLook } from '../src/sim/shipLooks';
import { createWorld } from '../src/sim/world';

// Issue #418: the player's boat wears her stored look (decision 0263) and her racing number
// while a race runs; it is rebuilt only when something it shows changes.
describe("the player's boat", () => {
  it('is rebuilt for a new look and for a race, and not otherwise', () => {
    const { trade } = createWorld(GAME_MAP, SLOOP);
    const boat = new PlayerBoat();
    expect(boat.stale(trade, undefined, false)).toBe(true);
    boat.build(trade, undefined, false).dispose();
    expect(boat.stale(trade, undefined, false)).toBe(false);
    const ship = trade.captain.activeShip;
    const look = { ...shipLook(trade.captain, ship), sailLogo: 'anchor', wake: 'plain' };
    expect(setShipLook(trade.captain, SHIPPED_CATALOGUE, ship, look)).toBe(true);
    expect(boat.stale(trade, undefined, false)).toBe(true);
    boat.build(trade, undefined, false).dispose();
    expect(boat.worn?.look.sailLogo?.svg).toContain('<svg');
    expect(boat.stale(trade, undefined, true)).toBe(true);
  });
});
