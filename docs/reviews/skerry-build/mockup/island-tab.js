/* global fwt, window, document */
// Mockup: Skerry's harbour screen with the Island tab (after Maren's arc: plot 2 given, plots 1, 3, 4 to come).
// window.mkHalf: the plot is chosen, the screen at half height beside it.
(async () => {
  const { effectLine, buildingName } = await import('/src/ui/homePanel.ts');
  const { BUILDINGS } = await import('/src/sim/home.ts');
  const { buildingPerks } = await import('/src/sim/perks.ts');
  const { t } = await import('/src/i18n/index.ts');
  const { icon, COIN } = await import('/src/ui/icons.ts');
  const trade = fwt.world.trade;
  const kind = (b) => t(`hook.${buildingPerks(b.id)[0]?.hook ?? 'repairPrice'}`);
  const pair = (p) => BUILDINGS.filter((b) => b.pair === p);
  const choice = (b) => `<div class="mk-choice"><span class="mk-kind">${kind(b)}</span><b>${buildingName(b)}</b><p>${effectLine(b)}</p>
      <button class="port-btn brass">${icon('anchor')}Build · free</button></div>`;
  const plots = [
    { n: 2, title: "Maren's plot", tag: 'Staked · free', sub: 'From Maren at Westholm, for the mill. Pick one; the other can come later on a spare plot.', open: true, pair: 'stores' },
    { n: 1, title: 'Plot 1', sub: 'Inès at Port Calda will stake this one: a workshop or a rigging loft.' },
    { n: 3, title: 'Plot 3', sub: 'Kit at Saltmere will stake this one: a lookout or a pilot house.' },
    { n: 4, title: 'Plot 4', sub: 'Ada at Stonehaven will stake this one: a weather glass or a boathouse.' },
  ];
  const half = !!window.mkHalf;
  const shown = half ? plots.slice(0, 1) : plots;
  const rows = shown
    .map((p) => `<article class="mk-plot ${p.open ? 'is-open' : 'is-locked'}"><span class="mk-num">${p.n}</span>
        <h3>${p.title}${p.tag ? `<small>${p.tag}</small>` : ''}</h3><p class="mk-sub">${p.sub}</p>
        ${p.open && half ? `<div class="mk-choices">${pair(p.pair).map(choice).join('')}</div>` : ''}
        ${p.open && !half ? `<button class="port-btn brass mk-see" style="grid-column:1/-1">Choose · see it on the island →</button>` : ''}</article>`)
    .join('');
  const root = document.createElement('div');
  root.id = 'mk-island';
  root.className = 'trade-panel-overlay' + (half ? ' is-half' : '');
  root.innerHTML = `<div class="trade-modal port-screen captain-view">
    <header class="trade-header"><div class="port-title-area"><h2 class="port-name">Skerry</h2>
      <div class="port-roles-summary"><span class="role-tag home">${icon('anchor')}Your island</span><span class="role-tag">1 plot to build</span></div></div>
      <div class="header-controls"><span class="port-chip">${COIN}<b>${trade.captain.gold}</b></span>
      <button class="close-btn" aria-label="Close">✕</button></div></header>
    <nav class="trade-tabs"><button class="tab-btn active" aria-pressed="true">Island <span class="tab-badge is-quay">1</span></button>
      <button class="tab-btn">Warehouse</button></nav>
    <main class="trade-content">${half ? '' : ''}<div class="mk-plots">${rows}</div></main>
    <footer class="trade-footer">${half ? '<button class="port-btn mk-back">← All plots</button>' : ''}<span class="footer-gap"></span>
      <button class="port-btn brass undock-btn">${icon('anchor')}Set sail</button></footer></div>`;
  document.body.append(root);
  document.body.classList.toggle('mk-half', half);
})();
