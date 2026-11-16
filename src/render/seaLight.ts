import { glitterUniforms } from './seaGlitter';
import { seaShadowUniforms } from './seaShadow';
import { sunHazeUniforms } from './sunHaze';

/**
 * The sea's share of the sunlight (issue #550): the haze toward the sun on every level, and on the
 * levels with the sky's reflection (High and Ultra) the shadows on the water and the glitter path.
 * `SunShadows.settle` writes them each frame.
 */
export const seaLightUniforms = (reflect: boolean) => ({
  ...sunHazeUniforms(),
  ...(reflect ? { ...seaShadowUniforms(), ...glitterUniforms() } : {}),
});
