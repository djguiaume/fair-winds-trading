import type { Music } from '../../audio/music';
import { wordCount } from '../../audio/babble';
import { t } from '../../i18n';
import type { QuestBook, QuestEvent } from '../../sim/quests';
import { questsDone } from '../../sim/settlement';
import type { World } from '../../sim/world';
import type { Input } from '../../input/input';
import type { GameView } from '../../render/view';
import type { Hud } from '../hud';
import type { QuestCard } from '../questCard';
import { flownPennant, raceResultCard, starterLine } from '../regattaView';
import type { MomentBanner } from './banner';

/** What a race's events touch of the game, passed in by `main.ts`. */
export interface RaceHost {
  world: World;
  quests: QuestBook;
  music: Pick<Music, 'effectNamed' | 'speak'>;
  hud: Pick<Hud, 'showToast' | 'hideToast'>;
  view: Pick<GameView, 'setPennant' | 'setQuestsDone'>;
  input: Pick<Input, 'releaseAll'>;
  questCard: Pick<QuestCard, 'show'>;
  /** The banner the retire is announced on (decision 0274). */
  banner: Pick<MomentBanner, 'show'>;
  /** The benchmark shows no cards. */
  bench: () => boolean;
  showHome(): void;
  autosave(): void;
  refreshPause(): void;
}

/**
 * A race's events (decision 0217): the starter's line at the start, the horn, the finish board at
 * once wherever she finishes, a give-up; no thanks card or note, the result card says it all.
 */
export function raceEvents(host: RaceHost): (e: QuestEvent) => void {
  const { world, quests, music, hud, view } = host;
  return (e) => {
    const quest = quests.quests.find((q) => q.id === e.quest)!;
    if (e.type === 'started') {
      const line = starterLine(quest);
      if (line) hud.showToast(line, 6);
    } else if (e.type === 'horn') {
      music.effectNamed('race-horn');
      hud.showToast(t('regatta.hornToast'), 3);
    } else if (e.type === 'retired') {
      host.banner.show(t('regatta.board.retired'), t('regatta.retired'), 4000);
    } else if (e.type === 'raced') {
      // The committee boat's horn as she crosses the line: a horn, never a gun (no weapons in
      // the game, the storyteller's rule for the regatta, decision 0217).
      music.effectNamed('finish-horn');
      view.setPennant(flownPennant(quests));
      const card = raceResultCard(quests, world.map, e);
      if (card && !host.bench()) {
        host.input.releaseAll();
        hud.hideToast();
        host.questCard.show(card);
        music.speak(card.giver?.voice, wordCount(card.speech), card.mood);
        host.refreshPause();
      }
    } else if (e.type === 'finished') {
      view.setQuestsDone(questsDone(world.trade));
      view.setPennant(flownPennant(quests));
      // The Cup on her pier once it is won (decision 0217).
      host.showHome();
    }
    if (e.type !== 'horn') host.autosave();
  };
}
