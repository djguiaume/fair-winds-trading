// Apart from ultraPipeline.ts so the Ultra code is only fetched on Ultra (issue #557).

/** The effects the player can switch off one by one (Settings, decision 0221). */
export interface GraphicsEffects {
  /** The sun's shadows: on everything on Ultra, the land and the sea on High (issue #550). */
  shadows: boolean;
  /** Houses, trees and quays darken toward their foot, on High and Ultra (issue #550). */
  contact: boolean;
  /** Ultra's ambient occlusion. */
  occlusion: boolean;
  /** Ultra's tone mapping (Neutral, decision 0221). */
  toneMapping: boolean;
  /** Ultra's horizon haze. */
  haze: boolean;
  /** Ultra's glow round lit windows, lanterns and the moon (decision 0299). */
  bloom: boolean;
  /** The sea's sky reflection and sun glint, on High and Ultra. */
  reflection: boolean;
  /** The boats, islands and sky mirrored on the sea, on the levels with `mirror` (decision 0292). */
  mirror: boolean;
  /** The ground's cover on grass and sand, on the levels of `terrain.json › draw.cover.on` (0298). */
  groundCover: boolean;
  /** Ultra's multisampled off-screen render; on unless a `?off=msaa` device test says false. */
  msaa?: boolean;
  /** The wind's gusts on the sea; on unless a `?off=gusts` device test says false (issue #498). */
  gusts?: boolean;
  /** Cloud shadows on the sea; on unless a `?off=clouds` device test says false (issue #546). */
  clouds?: boolean;
  /** The sun's glitter path on the sea; on unless `?off=glitter` says false (issue #550). */
  glitter?: boolean;
  /** Sun through the sails and haze toward the sun; on unless `?off=sunlight` (issue #550). */
  sunlight?: boolean;
  /** Lamplight pools round the lanterns at night; on unless `?off=pools` (issue #547). */
  pools?: boolean;
  /** Surface patterns near the camera; on unless `?off=surface` says false (issue #572). */
  surface?: boolean;
}

/** Every effect on: the view's default before Settings are applied. */
export const allEffects = (): GraphicsEffects => ({
  shadows: true,
  contact: true,
  occlusion: true,
  toneMapping: true,
  haze: true,
  bloom: true,
  reflection: true,
  mirror: true,
  groundCover: true,
});
