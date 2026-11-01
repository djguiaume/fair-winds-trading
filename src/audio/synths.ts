import { SYNTHS as EFFECT_SYNTHS } from './sfx';
import { UI_SYNTHS } from './uiSfx';

/** Every synthesised sound `audio.json` may name: the effects of `sfx.ts` and the interface's. */
export const SYNTHS = { ...EFFECT_SYNTHS, ...UI_SYNTHS };
