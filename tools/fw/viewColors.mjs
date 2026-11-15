/* global console, window, document */
// `npm run shots -- --both` (issue #573): each shot from above and from the follow cam, and the
// average colour of the sea, the land and the sky in each, so drift between the views is a number.

/** The two views of each shot: `<name>-top` and `<name>-follow`, the colours measured on both. */
export function bothViews(shot) {
  if (!shot.both) return [shot];
  return [
    { ...shot, name: `${shot.name}-top`, chase: false, measure: true, pair: shot.name },
    { ...shot, name: `${shot.name}-follow`, chase: true, measure: true, pair: shot.name },
  ];
}

/** Run in the page: the mask of surfaces drawn by the game's own module, the screenshot averaged. */
async function measureInPage({ png, width, height }) {
  const { renderViewMask } = await import('/src/render/viewMask.ts');
  const { averageColors } = await import('/src/render/colorDrift.ts');
  const view = window.fwt.view;
  const ids = renderViewMask(
    {
      renderer: view.renderer,
      scene: view.scene,
      camera: view.camera,
      land: [view.islands],
      sea: [
        view.ocean.mesh,
        view.calmWater?.root,
        view.roughWater?.root,
        view.shallowsWater?.root,
        view.currentWater?.root,
      ].filter(Boolean),
      sky: view.atmosphere.skyMesh,
    },
    width,
    height,
  );
  const image = new window.Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const colors = averageColors(ctx.getImageData(0, 0, width, height).data, ids);
  return { colors, fog: `#${view.scene.fog.color.getHexString()}` };
}

/** The colours of the shot just taken (`png`, a Buffer of the screenshot). */
export async function measureColors(page, png) {
  const { width, height } = page.viewportSize();
  return page.evaluate(measureInPage, { png: png.toString('base64'), width, height });
}

/** One line per pair: each surface's colour from above and behind, and their distance (ΔE). */
export async function driftReport(server, measured) {
  const { viewDrift, hexOf, SURFACES } = await server.ssrLoadModule('/src/render/colorDrift.ts');
  const pairs = new Map();
  for (const m of measured) {
    const pair = pairs.get(m.pair) ?? {};
    pair[m.chase ? 'follow' : 'top'] = m;
    pairs.set(m.pair, pair);
  }
  const rows = [];
  for (const [name, { top, follow }] of pairs) {
    if (!top || !follow) continue;
    const drift = viewDrift(top.colors, follow.colors);
    const cells = SURFACES.map((s) => {
      const a = top.colors[s];
      const b = follow.colors[s];
      const shown = (c) => (c ? hexOf(c.rgb) : '   —   ');
      const d = drift[s] === undefined ? '  —' : drift[s].toFixed(1).padStart(4);
      return `${s} ${shown(a)} ${shown(b)} ΔE ${d}`;
    });
    rows.push({ name, drift, top: top.colors, follow: follow.colors, fog: [top.fog, follow.fog] });
    console.log(`${name.padEnd(18)} ${cells.join('   ')}   fog ${top.fog} ${follow.fog}`);
  }
  return rows;
}
