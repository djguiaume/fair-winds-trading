import './club.css';
import { t } from '../i18n';
import type { ClubBoard, ClubRow } from './clubBoard';
import { raceClock, seriesName } from './regattaView';

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const MEDAL_CLASS = ['none', 'bronze', 'silver', 'gold'];

function rowHtml(r: ClubRow, canRace: boolean): string {
  const medal = `<span class="race-medal" aria-hidden="true"></span>`;
  const time =
    r.best === undefined
      ? `<span class="muted">${esc(t('club.board.unsailed'))}</span>`
      : `<b>${esc(t('regatta.best', { time: raceClock(r.best) }))}</b>`;
  const again =
    r.best !== undefined && canRace
      ? `<button type="button" class="d-btn" data-act="again" data-quest="${esc(r.quest)}">${esc(t('regatta.again'))}</button>`
      : '';
  return `<li class="club-row"><span class="club-name">${esc(r.name)}</span><span class="club-time race-best is-${MEDAL_CLASS[r.medal]}">${r.best === undefined ? '' : medal}${time}</span><small>${esc(t('club.board.par', { time: raceClock(r.par) }))}</small>${again}</li>`;
}

/** The board's card body: title, how many medals, then each series with its races. */
export function clubBoardBody(b: ClubBoard): string {
  const groups = b.groups
    .map(
      (g) =>
        `<h3 class="club-series">${esc(seriesName(g.series))}</h3><ul class="club-rows">${g.rows
          .map((r) => rowHtml(r, b.again))
          .join('')}</ul>`,
    )
    .join('');
  return `<div class="club-head"><header class="quest-head"><h2>${esc(t('club.board.title'))}</h2><span class="quest-role">${esc(
    t('club.board.count', { won: b.won, all: b.all }),
  )}</span></header>
    <p class="quest-speech">${esc(t(b.pinned ? 'club.board.intro' : 'club.board.empty'))}</p></div><div class="race-card club-board">${groups}</div>`;
}
