// Apart from ultraPipeline.ts so the Ultra code is only fetched on Ultra (issue #557).

/** The effects the player can switch off one by one (Settings, decision 0221). */
export interface GraphicsEffects {
  /** Ultra's soft shadows on everything. */
  shadows: boolean;
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
}

/** Every effect on: the view's default before Settings are applied. */
export const allEffects = (): GraphicsEffects => ({
  shadows: true,
  occlusion: true,
  toneMapping: true,
  haze: true,
  bloom: true,
  reflection: true,
  mirror: true,
  groundCover: true,
});
