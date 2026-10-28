/**
 * B2 "Bright highlands" islands (decision 0012), ported from the reference builder in
 * docs/art/src/lib.js (`kit('highlandLight')`, `island`): a beach, stacked sandstone layers and a
 * grass cap, with props that show what the island produces. Each island is batched separately so the camera can cull distant land. The shallows glow is drawn by the ocean shader.
 */
export const B2 = {
  sand: '#f2d9a0',
  grass: '#7cc04f',
  rock: '#c2ad8c',
  rock2: '#d6c4a4',
  field: ['#e8c547', '#c9d65a', '#e2b53e'],
  furrow: '#8f7a30',
  leaves: ['#3f8f45', '#4aa04f', '#38833f'],
  trunk: '#5a3d24',
  walls: ['#f4ede0', '#ece2cf', '#f8f3ea'],
  roofs: ['#c8603e', '#3f74a8', '#c8603e'],
  chimney: '#8a8174',
  dock: '#9b6b3d',
  post: '#6b4a2a',
  rack: '#b08a5a',
  logs: '#a8703c',
  mill: '#fff3dc',
  millCap: '#8a4a2a',
  blade: '#f4ead2',
  cart: '#8a6a4a',
};
