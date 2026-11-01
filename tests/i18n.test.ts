// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { PHASE1_MAP } from '../src/data/maps';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import {
  LANGUAGES,
  detectLanguage,
  goodSome,
  goodThe,
  setLanguage,
  shipThe,
  t,
  translateDom,
} from '../src/i18n';
import { GOODS } from '../src/sim/goods';
import { SHIP_CLASSES, SLOOP } from '../src/sim/ship';
import { QUESTS, QuestBook } from '../src/sim/quests';
import { lessonFor } from '../src/ui/questView';
import { createWorld } from '../src/sim/world';
import { SeaChart } from '../src/ui/seaChart';
import { loadSettings } from '../src/ui/settings';
import { TradePanel } from '../src/ui/tradePanel';
import { TitleScreen } from '../src/ui/screens/title';
import { Hud } from '../src/ui/hud';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const body = () =>
  html
    .split('<body>')[1]!
    .split('</body>')[0]!
    .replace(/<script[\s\S]*?<\/script>/g, '');

afterEach(() => setLanguage('en'));

describe('translations (decision 0037)', () => {
  it('gives every language the same keys and placeholders as English', () => {
    for (const lang of LANGUAGES) {
      expect(Object.keys(lang.messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(lang.messages)) {
        expect(text.trim(), `${lang.id} ${key}`).not.toBe('');
        expect(placeholders(text), `${lang.id} ${key}`).toEqual(
          placeholders(en[key as keyof typeof en]),
        );
      }
    }
  });

  it('picks the first supported browser language, else English', () => {
    expect(detectLanguage(['fr-CA', 'en-US'])).toBe('fr');
    expect(detectLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(detectLanguage(['de-DE'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('fills placeholders and switches language', () => {
    expect(t('toast.docked', { name: 'Saltmere' })).toBe('Docked at Saltmere');
    setLanguage('fr');
    expect(t('toast.docked', { name: 'Saltmere' })).toBe(
      fr['toast.docked'].replace('{name}', 'Saltmere'),
    );
    expect(document.documentElement.lang).toBe('fr');
  });

  it('ignores an unknown saved language', () => {
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ language: 'xx' }));
    expect(loadSettings().language).toBeNull();
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ language: 'fr' }));
    expect(loadSettings().language).toBe('fr');
    localStorage.clear();
  });

  it('translates the static menu, help and dialogs', () => {
    document.body.innerHTML = body();
    new Hud(createWorld(PHASE1_MAP, SLOOP), { seen: true, markSeen: () => {} });
    setLanguage('fr');
    translateDom();
    const noop = () => {};
    const title = new TitleScreen({
      play: noop,
      newVoyage: noop,
      freeSailing: noop,
      settings: noop,
      help: noop,
      lessons: noop,
      transfer: noop,
      setLanguage: noop,
    }).screen.root;
    expect(title.querySelector('#menu-settings .ui-row-label')!.textContent).toBe(
      fr['menu.settings'],
    );
    expect(title.querySelector('.title-tagline')!.textContent).toContain('Lisez le vent');
    expect(document.getElementById('chart')!.getAttribute('aria-label')).toBe(fr['chart.title']);
    expect(document.getElementById('sail-full')!.textContent!.trim()).toBe(fr['hud.sailFull']);
    expect(document.getElementById('sail-lever')!.getAttribute('aria-label')).toBe(fr['hud.sails']);
    expect(document.getElementById('help')!.textContent).toContain(fr['help.windCopy']);
    // The wind compass letters follow the language: W is O in French.
    expect(
      document.querySelector('#wind-help-trigger text[data-i18n="compass.W"]')!.textContent,
    ).toBe('O');
  });

  it('runs the harbour, kids mode, chart and tutorial in French', () => {
    document.body.innerHTML = body();
    setLanguage('fr');
    const world = createWorld(PHASE1_MAP, SLOOP);
    world.trade.dockedAt = 'saltmere';
    world.trade.captain.cargo.fish = 2;
    const panel = new TradePanel(document.getElementById('trade-panel')!, world);
    panel.open('market');
    const market = document.getElementById('trade-panel')!.textContent!;
    expect(market).toContain(fr['trade.undock']);
    expect(market).toContain(fr['good.fish']);
    expect(market).not.toContain('Return to Sea');
    panel.open('shipyard');
    expect(document.getElementById('trade-panel')!.textContent).toContain(fr['upg.sails']);
    // Ship speeds are quoted in knots, French style (decision 0075).
    const yard = document.getElementById('trade-panel')!.textContent!;
    expect(yard).toContain('Vitesse max\u00a0: 8,7\u00a0nd');
    expect(yard).not.toContain('du sloop');
    panel.uiMode = 'kids';
    panel.open('market');
    expect(document.getElementById('trade-panel')!.textContent).toContain(fr['kids.undock']);

    const chart = new SeaChart(document.getElementById('chart') as HTMLDialogElement, world, {});
    chart.open();
    expect(document.getElementById('chart-prices')!.textContent).toContain(fr['chart.colBuy']);
    expect(document.getElementById('chart-wind')!.textContent).toContain('nd');
    expect(document.getElementById('chart-compass')!.getAttribute('aria-label')).toContain(
      'Vent du',
    );
    chart.close();

    const quests = new QuestBook(world, QUESTS);
    quests.ask('first-voyage');
    expect(lessonFor(quests, {})!.title).toBe(fr['lesson.sails.title']);
  });

  it('keeps French punctuation on its word with a no-break space (decision 0091)', () => {
    for (const [key, text] of Object.entries(fr)) expect(text, `fr ${key}`).not.toMatch(/ [!?:;%]/);
  });

  it('gives every good and ship its in-sentence forms (decision 0091)', () => {
    for (const lang of LANGUAGES) {
      for (const g of GOODS) {
        expect(lang.messages, g).toHaveProperty(`goodThe.${g}`);
        expect(lang.messages, g).toHaveProperty(`goodSome.${g}`);
      }
      for (const id of Object.keys(SHIP_CLASSES))
        expect(lang.messages, id).toHaveProperty(`shipThe.${id}`);
    }
  });

  it('builds grammatical French sentences around goods and ships (decision 0091)', () => {
    setLanguage('fr');
    expect(t('lesson.deliver.title', { cargo: goodThe('fish'), delivery: 'Saltmere' })).toBe(
      'Portez le poisson à Saltmere',
    );
    expect(t('lesson.buy.copy', { origin: 'Port Calda', originMakes: goodSome('lampOil') })).toBe(
      'Port Calda produit de l’huile à lampe\u00a0: c’est bon marché ici. Achetez un lot.',
    );
    expect(t('fleet.switchTo', { ship: shipThe(SHIP_CLASSES.schooner!) })).toBe(
      'Prendre la goélette',
    );
    setLanguage('en');
    expect(t('lesson.deliver.title', { cargo: goodThe('fish'), delivery: 'Saltmere' })).toBe(
      'Carry the fish to Saltmere',
    );
  });
});
