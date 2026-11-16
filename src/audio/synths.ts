import { SYNTHS as EFFECT_SYNTHS } from './sfx';
import { RIGGING_SYNTHS } from './rigging';
import { UI_SYNTHS } from './uiSfx';

/** Every synthesised sound `audio.json` may name: the effects of `sfx.ts`, the rigging's and the interface's. */
export const SYNTHS = { ...EFFECT_SYNTHS, ...RIGGING_SYNTHS, ...UI_SYNTHS };
