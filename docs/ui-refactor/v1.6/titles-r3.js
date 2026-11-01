// Round 4: four title screens in the chart table style (round 3 D), each staged differently.
// mock.html?r=3&s=title&k=1..4&z=desktop|phone. 1 ledger under painted key art, 2 the chart table,
// 3 a logbook page over painted key art, 4 the live harbour with a row of tiles. The key art is the
// README cover (generated in the game's style), not a game frame; 4 is the real game.
(() => {
  const A = window.ART, S = window.SCR;
  const menu = () => `
    <nav class="tt-menu">
      <button class="tt-row on"><span class="tt-l">Continue</span><span class="tt-sub">Saltmere, day 12, 150 gold</span>${A.pad('A')}</button>
      <button class="tt-row"><span class="tt-l">New voyage</span></button>
      <button class="tt-row"><span class="tt-l">Free Sailing</span></button>
      <button class="tt-row"><span class="tt-l">Settings</span></button>
    </nav>`;
  const links = () => `<div class="tt-links"><a>How to play</a><a>Learn to sail</a><a>Move your voyage</a><span class="lang"><b>EN</b><i>FR</i></span></div>`;
  const common = () => `${links()}<div class="tt-ver">Version 1.6</div>${S.padbar([['A', 'Select'], ['Y', 'Language']])}`;
  const brand = (cls) => `<div class="tt-brand ${cls}">${A.logo('chart')}</div>`;

  window.R3_TITLES = {
    1: () => `<div class="ledger"></div>${brand('')}<p class="tt-tag">Read the wind, carry the cargo, find a home.</p>${menu()}${common()}`,
    2: () => `<div class="c-map">${window.ASSETS.chart}</div>${brand('tt-cart')}${menu()}${common()}`,
    3: () => `<div class="tt-page"></div>${brand('tt-stack')}${menu()}${common()}`,
    4: () => `${brand('tt-cart')}${menu()}${common()}`,
    // 3 on the art director's terms: the cover graded to the game, a straight inked edge, a tagline
    // (a placeholder until the storyteller confirms it). It shares 3's layout, so it takes its class too.
    5: () => {
      document.body.classList.add('tk-3');
      return `<div class="tt-page"></div>${brand('tt-stack')}<p class="tt-tag">Read the wind, carry the cargo, find a home.</p>${menu()}${common()}`;
    },
  };
  window.R3_TITLE_BG = { 1: 'bg/cover.jpg', 2: '', 3: 'bg/cover.jpg', 4: (size) => `bg/tt-d-${size}.jpg`, 5: 'bg/cover-graded.jpg' };
})();
