import { RULES } from '../../sim/cosmetics';

/**
 * A signal colour the game keeps for itself (`rules.json` › `reservedColours`), by its name: the
 * storm amber, the regatta yellow, the edge-buoy red. Only the signal itself may wear one (art
 * bible section 11), so the HUD and the chart read them here, never from the theme.
 */
export function signal(name: string): string {
  return RULES.reservedColours.find((c) => c.name === name)?.hex ?? '#000000';
}
