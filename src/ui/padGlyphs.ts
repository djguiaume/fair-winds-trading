import { PAD_BRANDS, type PadButton } from '../input/gamepad';
import { language, setPadNames } from '../i18n';

/**
 * The pad's button names on screen (decision 0186): glyphs (`data-pad-key`), hints and texts
 * (`{pad:a}`) say "A" on an Xbox pad, "✕" on a PlayStation pad and "B" on a Switch pad, from
 * `controls.json` › `padBrands`.
 */
let names: Partial<Record<PadButton, string>> = {};

/** A brand's names in the current language. */
function brandNames(brand: string): Partial<Record<PadButton, string>> | null {
  const b = PAD_BRANDS[brand];
  return b ? { ...b.names, ...b.lang?.[language()] } : null;
}

/** A button's name on the pad in use. */
export function padName(button: PadButton): string {
  return names[button] ?? button.toUpperCase();
}

/** A button glyph shown only while the pad is the last input (`kind`: a b x y bumper…). */
export function padGlyph(button: PadButton, kind: string = button): string {
  return `<i class="pad-key ${kind} pad-only" data-pad-key="${button}" aria-hidden="true">${padName(button)}</i>`;
}

/** A button's glyph in its own look: A B X Y round and coloured, the others a grey pill. */
export function padGlyphFor(button: PadButton): string {
  return padGlyph(button, ['a', 'b', 'x', 'y'].includes(button) ? button : 'bumper');
}

/**
 * The Xbox pad's View and Menu buttons as their printed symbols (decision 0201), not their names:
 * View is two overlapping windows, Menu three lines. Other pads keep the name (PlayStation's
 * "Create", Switch's "−"), which their CSS shows instead of the symbol.
 */
const SYMBOLS: Partial<Record<PadButton, string>> = {
  view: '<rect x="2.5" y="2.5" width="8" height="8" rx="1.5"/><path d="M6.5 13.5h6.5a1.5 1.5 0 0 0 1.5-1.5V5.5"/>',
  menu: '<path d="M3 4.5h10M3 8h10M3 11.5h10"/>',
};

/**
 * A button's glyph as the symbol printed on it, for a game button whose own icon it replaces
 * while the pad is in use (View on the Map button, decision 0201). Buttons without a symbol get
 * `padGlyphFor`.
 */
export function padSymbol(button: PadButton): string {
  const symbol = SYMBOLS[button];
  if (!symbol) return padGlyphFor(button);
  return `<i class="pad-symbol pad-only" aria-hidden="true"><svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${symbol}</svg><b class="pad-key bumper" data-pad-key="${button}">${padName(button)}</b></i>`;
}

/** The pad in use is of this brand: texts and every glyph on the page take its names. */
export function usePadBrand(brand: string, root: ParentNode = document) {
  names = brandNames(brand) ?? names;
  setPadNames(names as Record<string, string>);
  document.documentElement.dataset.padBrand = brand;
  for (const el of root.querySelectorAll<HTMLElement>('[data-pad-key]'))
    el.textContent = el.dataset
      .padKey!.split(' ')
      .map((b) => padName(b as PadButton))
      .join(' ');
}
