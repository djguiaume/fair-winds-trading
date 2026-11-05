import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { TEXT_VARIANTS, type TextVariant } from '../../i18n';
import type { MapDef } from '../../sim/map';
import { BUILDINGS, homeSpots, resolveSpot } from '../../sim/home';
import type { QuestReward } from '../../sim/questRewards';
import { type QuestDef } from '../../sim/quests';

/* The quest builder's text (decision 0142): the shipped and edited lines, their keys and checks. */

export type Lang = 'en' | 'fr';
export const LANGS: readonly Lang[] = ['en', 'fr'];
const SHIPPED_TEXT: Record<Lang, Record<string, string>> = { en, fr };

/** What the builder edits: the quests, and the text keys changed from `en.json` and `fr.json`. */
export interface QuestDoc {
  quests: QuestDef[];
  text: Record<Lang, Record<string, string>>;
}
/** A text in a language: the edited one, else the shipped one. */
export function textOf(doc: QuestDoc, lang: Lang, key: string): string | undefined {
  return doc.text[lang][key] ?? SHIPPED_TEXT[lang][key];
}

/** Sets a text; back to the shipped text drops the edit. */
export function setText(doc: QuestDoc, lang: Lang, key: string, value: string) {
  if (SHIPPED_TEXT[lang][key] === value) delete doc.text[lang][key];
  else doc.text[lang][key] = value;
}

/** A text line the builder edits: its key, what it is, and whether it has controls versions. */
export interface TextLine {
  key: string;
  label: string;
  long: boolean;
  /**
   * Speech that can name controls (decision 0184): besides the default `key`, optional
   * `key@touch`, `key@keys` and `key@pad` for a touch screen, keyboard and mouse, a controller.
   */
  variants?: boolean;
}

/** The text keys a quest's card and journal read (decision 0124), with what each one is. */
export function textKeys(quest: QuestDef): TextLine[] {
  const t = quest.text;
  const out: TextLine[] = [{ key: `${t}.name`, label: 'Quest name', long: false }];
  for (const s of quest.steps) {
    out.push({ key: `${t}.${s.id}.title`, label: `${s.id} · ask`, long: false });
    out.push({ key: `${t}.${s.id}.copy`, label: `${s.id} · speech`, long: true, variants: true });
    for (const o of s.choose ?? []) {
      out.push({ key: `${t}.${s.id}.${o.id}.title`, label: `${s.id} › ${o.id}`, long: false });
      out.push({
        key: `${t}.${s.id}.${o.id}.copy`,
        label: `${s.id} › ${o.id} · words`,
        long: true,
      });
    }
  }
  // A standing order thanks for each ask in its own words (decision 0214).
  if (quest.repeat)
    for (const s of quest.steps)
      out.push({ key: `${t}.${s.id}.thanks`, label: `${s.id} · thanks`, long: true });
  else {
    out.push({ key: `${t}.done.title`, label: 'Thanks · title', long: false });
    out.push({ key: `${t}.done.copy`, label: 'Thanks · speech', long: true, variants: true });
  }
  // Quest cargo's names for the dock news (decision 0213); a passenger (space 0) is a person.
  for (const [id, item] of Object.entries(quest.items ?? {}))
    if (item.space > 0)
      for (const [form, what] of ITEM_FORMS)
        out.push({ key: `quest.item.${id}.${form}`, label: `item ${id} · ${what}`, long: false });
  // A plot given (decision 0210): the giver by their stake, on the next mooring at the island.
  if (givesPlot(quest))
    out.push({ key: `${t}.plot.copy`, label: 'Plot · speech at the island', long: true });
  return out;
}

/** The forms of a quest item's name the dock news reads (decision 0213). */
export const ITEM_FORMS = [
  ['one', 'one ("millstone")'],
  ['many', 'several ("millstones")'],
  ['the', 'the load ("the millstones")'],
  ['own', 'someone’s ("Maren’s millstones" / « les meules »)'],
  ['unloadedOne', '"unloaded", one (FR « déchargée »)'],
  ['unloadedMany', '"unloaded", several (FR « déchargées »)'],
] as const;

const givesPlot = (q: QuestDef) => !!(q.reward as QuestReward | undefined)?.homeSpot;

/**
 * `{spotA}` and `{spotB}` in a language (decision 0210): the two buildings of the plot a quest
 * gives, with their article, as the game fills them; none for a quest that gives no plot.
 */
export function plotWords(
  doc: QuestDoc,
  map: MapDef,
  q: QuestDef,
  lang: Lang,
): Record<string, string> {
  const ref = (q.reward as QuestReward | undefined)?.homeSpot;
  const plot = resolveSpot(map, Array.isArray(ref) ? ref[0] : ref);
  const pair = plot && homeSpots(map, plot.island).find((x) => x.id === plot.spot)?.pair;
  if (!pair) return {};
  const [a, b] = BUILDINGS.filter((x) => x.pair === pair).map(
    (x) => textOf(doc, lang, `building.${x.id}.a`) ?? x.id,
  );
  return { spotA: a ?? '', spotB: b ?? '' };
}

/** A text with its `{name}`s filled in. */
export const fillWords = (text: string, words: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (all, name: string) => words[name] ?? all);

/** Every key of a line: the default, then its controls versions (decision 0184). */
export function lineKeys(line: TextLine): { key: string; label: string; way?: TextVariant }[] {
  const out: { key: string; label: string; way?: TextVariant }[] = [
    { key: line.key, label: line.label },
  ];
  if (line.variants)
    for (const way of TEXT_VARIANTS)
      out.push({ key: `${line.key}@${way}`, label: `${line.label} · ${WAY_NAMES[way]}`, way });
  return out;
}

/** The builder's names for the ways of playing. */
export const WAY_NAMES: Record<TextVariant, string> = {
  touch: 'touch',
  keys: 'keyboard & mouse',
  pad: 'controller',
};

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Problems with the quests' text: a step ask missing, a language missing, `{par}` not in both. */
export function checkText(doc: QuestDoc): string[] {
  const out: string[] = [];
  for (const q of doc.quests)
    for (const { key, label } of textKeys(q).flatMap(lineKeys)) {
      const [a, b] = LANGS.map((l) => textOf(doc, l, key));
      const isAsk =
        /\.title$/.test(key) && !key.endsWith('.done.title') && key.split('.').length === 4;
      if ((isAsk || key.startsWith('quest.item.')) && a === undefined && b === undefined)
        out.push(`quest ${q.id} › ${label}: no text`);
      else if ((a === undefined) !== (b === undefined))
        out.push(`quest ${q.id} › ${label}: no ${a === undefined ? 'English' : 'French'}`);
      else if (a !== undefined && placeholders(a).join() !== placeholders(b!).join())
        out.push(`quest ${q.id} › ${label}: the {…} differ between English and French`);
    }
  // A plot given (decision 0210): the thanks names its two buildings, and the giver speaks at
  // the island.
  for (const q of doc.quests) {
    if (!givesPlot(q)) continue;
    const thanks = textOf(doc, 'en', `${q.text}.done.copy`) ?? '';
    if (!thanks.includes('{spotA}') || !thanks.includes('{spotB}'))
      out.push(
        `quest ${q.id} › Thanks · speech: a plot given, name its buildings with {spotA} and {spotB}`,
      );
    if (textOf(doc, 'en', `${q.text}.plot.copy`) === undefined)
      out.push(`quest ${q.id} › Plot · speech at the island: no text`);
  }
  return out;
}
/** The shipped text with edits: changed keys in place, new keys after their quest's last key. */
export function mergeText(lang: Lang, edits: Record<string, string>): Record<string, string> {
  const merged: [string, string][] = Object.entries(SHIPPED_TEXT[lang]).map(([k, v]) => [
    k,
    edits[k] ?? v,
  ]);
  for (const [key, value] of Object.entries(edits)) {
    if (key in SHIPPED_TEXT[lang]) continue;
    const prefix = key.split('.').slice(0, 2).join('.') + '.';
    let at = -1;
    merged.forEach(([k], i) => {
      if (k.startsWith(prefix)) at = i;
    });
    if (at < 0)
      merged.forEach(([k], i) => {
        if (k.startsWith('quest.')) at = i;
      });
    merged.splice(at < 0 ? merged.length : at + 1, 0, [key, value]);
  }
  return Object.fromEntries(merged);
}
