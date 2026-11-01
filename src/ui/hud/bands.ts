import { SHIPPED_THEME } from '../theme/model';

/** The heading strip's height under the safe margin: the tape and the course line under it. */
const STRIP = 72;

export function isPhoneLayout(): boolean {
  return document.documentElement.dataset.layout === 'phone';
}

/** How far down the heading strip reaches: the names pinned to the scene stay below it. */
export function stripBottom(): number {
  const hud = SHIPPED_THEME.hud;
  return (isPhoneLayout() ? hud['margin-phone']! : hud.margin!) + STRIP;
}
