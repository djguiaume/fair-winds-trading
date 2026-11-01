import type { TuningMeta } from './tuning-meta-types';
import { GRAPHICS_META } from './tuning-meta-graphics';
import { CAMERA_META } from './tuning-meta-camera';
import { BUOYS_META } from './tuning-meta-buoys';
import { STORMS_META } from './tuning-meta-storms';
import { TERRAIN_META } from './tuning-meta-terrain';
import { SMOOTH_META } from './tuning-meta-smooth';
import { WATER_DEPTH_META } from './tuning-meta-water-depth';
import { WAVES_META } from './tuning-meta-waves';
import { MOTION_META } from './tuning-meta-motion';
import { SURF_META } from './tuning-meta-surf';
import { SEA_DRAG_META } from './tuning-meta-sea-drag';
import { QUALITY_META } from './tuning-meta-quality';
import { HUD_META } from './tuning-meta-hud';

/** The meta entries kept in their own files, one subject each, so tuning-meta.ts stays readable. */
export const FILE_METAS: Readonly<Record<string, TuningMeta>> = {
  ...GRAPHICS_META,
  ...QUALITY_META,
  ...CAMERA_META,
  ...BUOYS_META,
  ...STORMS_META,
  ...TERRAIN_META,
  ...SMOOTH_META,
  ...WATER_DEPTH_META,
  ...WAVES_META,
  ...MOTION_META,
  ...SURF_META,
  ...SEA_DRAG_META,
  ...HUD_META,
};
