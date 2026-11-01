import type { UiEvent } from '../audio/catalog';

/**
 * The interface's sounds (decision 0274): the components say what happened (a press, a choice, a
 * step back, a tab, an error) and the game plays it; before the game connects a player, and in the
 * editors, nothing is heard. The effects themselves are `audio.json`'s `events`.
 */
type Player = (event: UiEvent) => void;

let player: Player | null = null;

/** The game connects its sound player once; null disconnects (tests). */
export function connectUiSounds(next: Player | null): void {
  player = next;
}

export function uiSound(event: UiEvent): void {
  player?.(event);
}
