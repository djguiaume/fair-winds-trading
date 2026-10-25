/**
 * Tiny in-repo translation layer (decision 0037).
 *
 * - Every player-facing string lives in one JSON file per language (`en.json` is the source of
 *   truth; other languages must define exactly the same keys, which TypeScript and a test check).
 *   Editing text needs no code: see docs/i18n/README.md.
 * - `t('key', { name })` looks a string up and fills `{name}` placeholders.
 * - Static markup in index.html carries `data-i18n` attributes that `translateDom` fills.
 * - The language comes from the saved setting, else the browser, else English.
 *
 * Adding a language: copy `fr.json`, translate it, import it and add one line to `LANGUAGES` below.
 */
import { TUNING } from '../data/tuning';
import townLevels from '../data/town-levels.json';
import en from './en.json';
import frJson from './fr.json';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

/** Typed so a key missing from `fr.json` fails the build, not just the test. */
const fr: Messages = frJson;

export const LANGUAGES = [
  { id: 'en', name: 'English', locale: 'en-GB', messages: en },
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

let variant: 'pad' | null = null;

/**
 * Text written for one way of playing (decision 0183): while the game controller is the last
 * input, `t('key')` reads `key@pad` where that key exists ("press A" instead of "tap"), else
 * `key`. Quest and lesson texts get these in the quest builder like any other line.
 */
export function setTextVariant(v: 'pad' | null): void {
  variant = v;
}

export function textVariant(): 'pad' | null {
  return variant;
}

/** The key to read: its variant for the current way of playing when there is one. */
function variantOf(key: string): string {
  if (!variant) return key;
  const k = `${key}@${variant}`;
  // An empty variant (cleared in the quest builder) leaves the plain text.
  return (en as Record<string, string>)[k] ? k : key;
}

/** Translate `key`, replacing `{name}` with `params.name`. Falls back to English, then the key. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  key = variantOf(key) as MessageKey;
  const text = current.messages[key] ?? (en as Messages)[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Translate a key built at run time (quest text, `<text>.<step>.title`), or `undefined` when no
 * language has it, so the interface can leave that line out.
 */
export function tOptional(
  key: string,
  params: Record<string, string | number> = {},
): string | undefined {
  return key in en ? t(key as MessageKey, params) : undefined;
}

/**
 * The quest builder's play-test (decision 0142): text edited there replaces or adds keys for this
 * page only. `en` decides which keys exist, so a key new in French alone is left out.
 */
export function useTextEdits(edits: { en: Record<string, string>; fr: Record<string, string> }) {
  Object.assign(en, edits.en);
  for (const [key, text] of Object.entries(edits.fr))
    if (key in en) Object.assign(fr, { [key]: text });
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

/** A trade good's name in the current language; a good with no translation keeps its `goods.json` name. */
export function goodName(id: string): string {
  const key = `good.${id}` as MessageKey;
  return key in en ? t(key) : (TUNING.goods[id]?.name ?? id);
}

/** A weather kind's name ("Gale"); a kind with no translation keeps its `weather.json` name. */
export function weatherName(kind: string): string {
  const key = `weather.${kind}` as MessageKey;
  return key in en ? t(key) : (TUNING.weather.default.kinds?.[kind]?.name ?? kind);
}

/** True when the text files have this key (content added in data may not be translated yet). */
/** A wind zone kind in words ("doldrums"), or the kind's id when it has no text (decision 0152). */
export function zoneKindName(kind: string): string {
  const key = `zone.${kind}` as MessageKey;
  return key in en ? t(key) : kind;
}

export function hasText(key: string): key is MessageKey {
  return key in en;
}

/** A town level's name ("Village"); a level with no translation keeps its `town-levels.json` name. */
export function townLevelName(level: number): string {
  const key = `settlement.level.${level}` as MessageKey;
  return key in en ? t(key) : (townLevels.levels[level - 1]?.name ?? String(level));
}

/** The workshop that makes a specialty, "a smokehouse"; a newer good gets "a workshop". */
export function workshopName(good: string): string {
  const key = `workshop.${good}` as MessageKey;
  return t(key in en ? key : 'workshop.any');
}

/**
 * A good inside a sentence (decision 0091): `the` reads "le poisson" / "the fish", `some` reads
 * "du poisson" / "fish". French needs the article, so templates never glue a bare name in.
 */
export function goodThe(id: string): string {
  const key = `goodThe.${id}` as MessageKey;
  return key in en ? t(key) : goodName(id);
}

export function goodSome(id: string): string {
  const key = `goodSome.${id}` as MessageKey;
  return key in en ? t(key) : goodName(id);
}

/** A ship class inside a sentence with its article: "la goélette", "the schooner" (decision 0091). */
export function shipThe(ship: { id: string; name: string }): string {
  const key = `shipThe.${ship.id}` as MessageKey;
  return key in en ? t(key) : shipName(ship);
}

/** A ship class's name in the current language; unknown classes keep their English name. */
export function shipName(ship: { id: string; name: string }): string {
  const key = `ship.${ship.id}` as MessageKey;
  return key in en ? t(key) : ship.name;
}
