import { HULL_SCALE, HULL_BEAM_SCALE } from '../../sim/hullShape';
import boatLook from '../../data/boat-look.json';
/** Shared storybook palette and display scale (decisions 0012, 0016). */
export const STYLE_D = {
  L: 1,
  B: HULL_BEAM_SCALE,
  H: 1.2,
  sheer: 0.45,
  belly: 0.35,
  mastK: 0.95,
  flag: 1.3,
  sail: '#fbf6e8',
  /** Sails 1's worn canvas (`boat-look.json`). */
  patchedSail: boatLook.sails.canvas['1'],
  patches: ['#b8a27a', '#a89068'],
  /** A damaged sail's big patches (decision 0208): warm plank-toned canvas that shows about
   * 30 % darker than the sail. The sails' material adds a flat white glow (emissive 0.22), which
   * lifts dark colours a lot, so these are written much darker than they look in the game. */
  damagePatches: ['#7c5226', '#6c4520'],
  deck: '#d4a466',
  mast: '#5b3a1e',
  crate: '#c4914e',
  barrel: '#8a5a30',
  /** Hull 3's copper bottom (`boat-look.json`). */
  copper: boatLook.hull.copper,
  rigging: '#2d2218',
  lamp: '#ffd774',
};

/** The 5 m reference sloop is drawn about 11 m long for readability. */
export const BOAT_SCALE = HULL_SCALE;
