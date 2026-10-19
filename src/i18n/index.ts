/**
 * Tiny in-repo translation layer (decision 0037).
 *
 * - Every player-facing string lives in one dictionary per language (`en.ts` is the source of
 *   truth; other languages must define exactly the same keys, which TypeScript checks).
 * - `t('key', { name })` looks a string up and fills `{name}` placeholders.
 * - Static markup in index.html carries `data-i18n` attributes that `translateDom` fills.
 * - The language comes from the saved setting, else the browser, else English.
 *
 * Adding a language: copy `fr.ts`, translate it, and add one line to `LANGUAGES` below.
 */
import { en, type MessageKey } from './en';
import { fr } from './fr';

export type { MessageKey };
export type Messages = Record<MessageKey, string>;

export const LANGUAGES = [
  { id: 'en', name: 'English', locale: 'en-GB', messages: en as Messages },
  { id: 'fr', name: 'Français', locale: 'fr-FR', messages: fr },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]['id'];

let current: (typeof LANGUAGES)[number] = LANGUAGES[0];

export function isLanguage(id: unknown): id is LanguageId {
  return LANGUAGES.some((l) => l.id === id);
}

/** First supported language in the browser's preference list (`fr-CA` → `fr`), else English. */
export function detectLanguage(preferred: readonly string[]): LanguageId {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en'];
}

export function setLanguage(id: LanguageId): void {
  current = LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
  if (typeof document !== 'undefined') document.documentElement.lang = current.id;
}

export function language(): LanguageId {
  return current.id;
}

/** Locale for number formatting, e.g. `1,200` in English and `1 200` in French. */
export function locale(): string {
  return current.locale;
}

export function formatNumber(n: number, digits?: number): string {
  return n.toLocaleString(
    current.locale,
    digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  );
}

/** Translate `key`, replacing `{name}` with `params.name`. Falls back to English, then the key. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const text = current.messages[key] ?? (en as Messages)[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Fill static markup: `data-i18n="key"` sets the text, `data-i18n-html="key"` sets trusted markup
 * from our own dictionaries, and `data-i18n-attr="aria-label:key;title:key2"` sets attributes.
 */
export function translateDom(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]'))
    el.textContent = t(el.dataset.i18n as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]'))
    el.innerHTML = t(el.dataset.i18nHtml as MessageKey);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key as MessageKey));
    }
  }
}

/** A trade good's name in the current language. */
export function goodName(id: string): string {
  const key = `good.${id}` as MessageKey;
  return key in en ? t(key) : id;
}

/** A ship class's name in the current language; unknown classes keep their English name. */
export function shipName(ship: { id: string; name: string }): string {
  const key = `ship.${ship.id}` as MessageKey;
  return key in en ? t(key) : ship.name;
}
