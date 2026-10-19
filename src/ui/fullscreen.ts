/**
 * Fullscreen with graceful fallbacks (decision 0017).
 *
 * - Desktop browsers, Android and iPadOS Safari (16.4+, older ones prefixed) support the
 *   Fullscreen API on any element.
 * - iPhone Safari only allows fullscreen for <video>, so there we hide the button and suggest
 *   "Add to Home Screen" instead (the page already declares itself web-app capable).
 * - When launched from the home screen the game already fills the screen: nothing to show.
 */

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenSupport =
  /** The API works: show a toggle button. */
  | 'api'
  /** Already running as an installed web app (home screen): nothing to do. */
  | 'standalone'
  /** iPhone/iPod: no API for pages, but "Add to Home Screen" gives fullscreen. */
  | 'home-screen'
  /** Anything else without the API: hide the option. */
  | 'none';

export interface SupportProbe {
  apiEnabled: boolean;
  standalone: boolean;
  iphone: boolean;
}

/** Pure decision, kept separate from the browser checks so it can be unit-tested. */
export function classifySupport(p: SupportProbe): FullscreenSupport {
  if (p.standalone) return 'standalone';
  if (p.apiEnabled) return 'api';
  if (p.iphone) return 'home-screen';
  return 'none';
}

export function probeSupport(): SupportProbe {
  const doc = document as WebkitDocument;
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    apiEnabled: Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled),
    standalone:
      nav.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches,
    iphone: /iPhone|iPod/.test(navigator.userAgent),
  };
}

export function isFullscreen(): boolean {
  const doc = document as WebkitDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/** Toggles fullscreen on the whole page. Must be called from a click/tap handler. */
export async function toggleFullscreen(): Promise<void> {
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  try {
    if (isFullscreen()) {
      await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
    } else if (root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    } else {
      await root.webkitRequestFullscreen?.();
    }
  } catch {
    // Refused (e.g. not from a user gesture, or blocked by an iframe): stay windowed.
  }
}

/** Calls `cb` whenever the page enters or leaves fullscreen (including via Esc). */
export function onFullscreenChange(cb: () => void): void {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
}
