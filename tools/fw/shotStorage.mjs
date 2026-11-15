// What `npm run shots` puts in the browser's storage before the game starts (shots.mjs).
import { readFileSync } from 'node:fs';
import { followView } from './shotOptions.mjs';

/** What goes in the browser's storage before the game starts. */
export function seedStorage(shot) {
  const items = {
    'fwt.settings.v1': JSON.stringify({
      seenHelp: true,
      seenWindHint: true,
      seenPressHint: true,
      seenCurrentHint: true,
      musicVolume: 0,
      voices: false,
      language: shot.lang,
      dayNight: shot.night || shot.time !== null,
      weather: shot.weather,
      storms: shot.storms,
      windZones: shot.zones,
      stormBelt: shot.belt ?? true,
      ...(shot.quality ? { quality: shot.quality } : {}),
      // The saved sailing view, so the first voyage's opening hands back to the chase camera.
      ...(shot.chase ? { sailingView: followView() } : {}),
      currents: shot.currents,
      eruptions: shot.eruptions,
    }),
    ...shot.storage,
  };
  if (shot.seaFile) items['fwt.editor.map.v1'] = shot.seaMap ?? readFileSync(shot.seaFile, 'utf8');
  if (shot.draft)
    items[shot.editor === 'phase4' ? 'fwt.editor.seas.v1' : 'fwt.editor.map.v1'] = readFileSync(
      shot.draft,
      'utf8',
    );
  if (shot.islands.length) {
    const designs = shot.islands.map((f) => JSON.parse(readFileSync(f, 'utf8')));
    items['fwt.editor.islands.v1'] = JSON.stringify(
      Object.fromEntries(designs.map((d) => [d.id, d])),
    );
  }
  return items;
}
