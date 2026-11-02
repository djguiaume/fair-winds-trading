/** The grain tile's size in pixels and how many specks it holds. */
const TILE = 96;
const SPECKS = 260;

/**
 * The chart paper's fine grain (issue #444): one small tile of ink and light specks, made once
 * from a fixed seed so it never changes, and laid as a CSS background image. No filters or noise
 * shaders, so an old tablet pays for it once, when the tile is first drawn.
 */
export function grainImage(ink: string, light: string): string {
  let seed = 444;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  let specks = '';
  for (let i = 0; i < SPECKS; i++) {
    const x = (random() * TILE).toFixed(1),
      y = (random() * TILE).toFixed(1);
    const dark = random() < 0.6;
    const r = (0.3 + random() * 0.5).toFixed(2);
    const a = ((dark ? 0.05 : 0.25) + random() * 0.07).toFixed(2);
    specks += `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark ? ink : light}" fill-opacity="${a}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}">${specks}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
