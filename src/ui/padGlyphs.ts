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
