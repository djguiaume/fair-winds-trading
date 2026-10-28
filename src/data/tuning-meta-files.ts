import type { TuningMeta } from './tuning-meta-types';
import { GRAPHICS_META } from './tuning-meta-graphics';
import { CAMERA_META } from './tuning-meta-camera';
import { BUOYS_META } from './tuning-meta-buoys';
import { STORMS_META } from './tuning-meta-storms';
import { TERRAIN_META } from './tuning-meta-terrain';

/** The meta entries kept in their own files, one subject each, so tuning-meta.ts stays readable. */
export const FILE_METAS: Readonly<Record<string, TuningMeta>> = {
  ...GRAPHICS_META,
  ...CAMERA_META,
  ...BUOYS_META,
  ...STORMS_META,
  ...TERRAIN_META,
};
