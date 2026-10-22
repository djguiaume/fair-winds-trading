import { HULL_SCALE, HULL_BEAM_SCALE } from '../../sim/hullShape';
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
  patchedSail: '#d9c9a2',
  patches: ['#b8a27a', '#a89068'],
  deck: '#d4a466',
  mast: '#5b3a1e',
  crate: '#c4914e',
  barrel: '#8a5a30',
  copper: '#c8743c',
  rigging: '#2d2218',
  lamp: '#ffd774',
};

/** The 5 m reference sloop is drawn about 11 m long for readability. */
export const BOAT_SCALE = HULL_SCALE;
