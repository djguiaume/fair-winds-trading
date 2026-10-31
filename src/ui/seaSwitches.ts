import { hazeSwitches } from '../sim/windZones';
import type { World } from '../sim/world';
import { switchRow } from './graphicsSettings';
import type { Settings } from './settings';

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

/**
 * The sea's hazards in Settings, each with its own switch like every hazard: currents (0140),
 * the waves slowing the boat (0256), drifting icebergs (0170), other ships (0215), and one switch
 * per fog bank or ash cloud kind (0169), made from the data so a new kind needs no code. `keep`
 * stores the settings after a change.
 */
export function wireSeaSwitches(world: World, settings: Settings, keep: () => void) {
  const wire = (id: string, on: boolean, change: (on: boolean) => void) => {
    const box = input(id);
    box.checked = on;
    box.addEventListener('change', () => {
      change(box.checked);
      keep();
    });
    return box;
  };
  world.currentsOn = settings.currents;
  world.bergsOn = settings.bergs;
  world.traffic.on = settings.ships;
  world.seaDragOn = settings.seaDrag;
  const currents = wire('currents', settings.currents, (on) => {
    world.currentsOn = settings.currents = on;
  });
  wire('bergs', settings.bergs, (on) => {
    world.bergsOn = settings.bergs = on;
  });
  wire('ships', settings.ships, (on) => {
    world.traffic.on = settings.ships = on;
    if (on) world.traffic.fresh = true;
  });
  const rows = [
    switchRow('sea-drag', 'settings.seaDrag', settings.seaDrag, (on) => {
      world.seaDragOn = settings.seaDrag = on;
      keep();
    }),
  ];
  const hazeOff = () => hazeSwitches().filter((id) => settings.haze[id] === false);
  world.hazeOff = hazeOff();
  for (const id of hazeSwitches())
    rows.push(
      switchRow(`haze-${id}`, `settings.haze.${id}`, settings.haze[id] !== false, (on) => {
        settings.haze = { ...settings.haze, [id]: on };
        world.hazeOff = hazeOff();
        keep();
      }),
    );
  currents.closest('.set-row')?.after(...rows);
}
