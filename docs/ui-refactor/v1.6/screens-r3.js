// Round 3: direction 1 (the chart table) only, as the mix Guillaume picked: minimal at sea and on the
// title, paper in the harbour, Boat looks and the chart. &w=c|d is how much the harbour panes cover:
// c = about 65% with the boat and the quay on the right, d = a ledger across with the port as a strip.
// mock.html?r=3&w=c|d&s=title|hud|market|quay|shipyard|looks|chart&z=desktop|phone&t=day|night
(() => {
  const q = new URLSearchParams(location.search);
  if (q.get('r') !== '3') return;
  const A = window.ART, S = window.SCR;
  const s = q.get('s') || 'title', z = q.get('z') || 'desktop', w = q.get('w') || 'c';
  const t = q.get('t') || 'day', size = z === 'phone' ? 'landscape' : 'desktop';
  const port = ['market', 'quay', 'shipyard'].includes(s);
  const v = s === 'title' || s === 'hud' ? 'minimal' : 'framed';
  document.body.className = `d-chart s-${port ? `harbour p-${s}` : s} z-${z} t-${t} r2 r3 w-${w} v-${v}`;
  document.getElementById('dircss').href = 'chart-r2.css';
  document.getElementById('r3css').href = 'chart-r3.css';
  document.getElementById('r3css2').href = 'chart-r3-port.css';

  const night = t === 'night' ? 'n' : '';
  const harbourBg = w === 'c' ? (z === 'phone' ? 'i-landscape' : 'l-desktop') : z === 'phone' ? 'e-landscape' : 'a-desktop';
  const BG = {
    title: `bg/t-c-${size}.jpg`,
    hud: t === 'night' ? `bg/n-a-${size}.jpg` : `bg/s-day-${size}.jpg`,
    looks: `bg/lk-${size}.jpg`,
    chart: '',
  }[port ? 'port' : s] ?? `bg/h${night}-${harbourBg}.jpg`;

  const hud = () => `
    <div class="h-status">
      <div class="h-stats">${S.stat('coin', '150', 'gold')}${S.stat('hold', '0/10', 'hold')}${S.stat('hull', '100%', 'hull')}</div>
      <div class="h-quest">${A.icon('flag')}<div><b>Find the diving gulls</b><span>Kit Marlow, step 1 of 3</span></div></div>
    </div>
    <div class="h-strip">${A.tape(z === 'phone' ? 280 : 420, 120, 96)}<div class="h-dest">${A.icon('anchor')}<b>Saltmere</b><span>37 m</span></div></div>
    ${t === 'night' ? '<div class="h-toast">A foghorn sounds to the west</div>' : '<div class="h-arrive"><b>Saltmere</b><span>Home port</span></div>'}
    <div class="h-wind"><div class="hw-t"><b class="hw-pos">Beam reach</b><span>Breeze NE, 12 kn</span></div>${A.windCompass(120, 45, 45, 18, 24)}</div>
    <div class="h-actions">
      <button class="hbtn">${A.icon('map')}<span>Map</span>${A.pad('X')}</button>
      <button class="hbtn">${A.icon('cargo')}<span>Cargo</span>${A.pad('Y')}</button>
      <button class="hbtn">${A.icon('menu')}<span>Menu</span>${A.pad('≡')}</button>
    </div>
    <div class="h-instr">
      <div class="i-speed"><b>3.5</b><span class="i-unit">kn</span></div>
      <div class="i-head">Heading 120°</div>
      <div class="i-sails"><span class="sl-k">${A.pad('LT')}</span><span class="sl">Down</span><span class="sl">Half</span><span class="sl on">Full</span><span class="sl-k">${A.pad('RT')}</span></div>
    </div>`;

  // The harbour frame: the port's name, the tabs and the wallet; the footer with the quay hint and Set sail.
  const TABS = [['market', 'Market'], ['orders', 'Orders', 4], ['quay', 'Quay', 1], ['shipyard', 'Shipyard']];
  const head = () => `
    <header class="p-head">
      <div class="p-title"><h1>Saltmere</h1><p>Home port. Makes fish, wants grain and timber.</p></div>
      <nav class="tabs">${A.pad('LB')}${TABS.map(([id, n, k]) => `<a${id === s ? ' class="on"' : ''}>${n}${k ? `<i>${k}</i>` : ''}</a>`).join('')}${A.pad('RB')}</nav>
      <div class="p-wallet">${S.stat('coin', '150', 'gold')}${S.stat('hold', '0/10', 'hold')}</div>
    </header>`;
  const foot = (keys, hint = true) => `
    <footer class="p-foot">${hint ? `<span class="f-hint">${A.face('kit')}<span><b>Kit Marlow</b> would like a word</span><a>Quay</a></span>` : ''}
      ${S.padbar(keys)}<button class="btn primary sail">${A.icon('sail')}Set sail${A.pad('Y')}</button></footer>`;
  const frame = (body, keys, hint) => `${w === 'd' ? '<div class="ledger"></div>' : ''}${head()}${body}${foot(keys, hint)}`;

  // Market: the C list is the round 2 list; the D ledger adds each good's trend and best price elsewhere.
  const best = (g) => g.best.replace(' pays ', ' ');
  const goodRow = (g) => `<div class="g-row${g.on ? ' on' : ''}">
      <span class="g-art">${A.good(g.id)}</span>
      <span class="g-name"><b>${g.name}</b><i>${g.note}</i></span>
      <span class="g-hold"><b>${g.hold}</b><i>hold</i></span>
      <span class="g-buy">${A.icon('coin')}${g.buy}</span>
      <span class="g-sell">${A.icon('coin')}${g.sell}</span>
      <span class="g-trend">${S.spark(g.trend)}</span>
      <span class="g-best">${best(g)}</span>
    </div>`;
  const g = S.GOODS[1];
  const market = () => frame(`
    <section class="pane market">
      <div class="goods">
        <div class="g-head"><span>Goods</span><span>Hold</span><span>Buy</span><span>Sell</span><span class="g-trend">Last 7 days</span><span class="g-best">Best elsewhere</span></div>
        ${S.GOODS.map(goodRow).join('')}
      </div>
      <div class="detail">
        <div class="d-top"><span class="d-art">${A.good(g.id)}</span><div><h2>Grain</h2><p>Wanted here, order 7</p></div></div>
        <div class="d-trend">${S.spark(g.trend)}<span>${A.icon('trend')}Up 9 in 6 days. ${g.best}.</span></div>
        <div class="d-qty"><span>Lot</span><b class="on">1</b><b>5</b><b>10</b></div>
        <div class="d-act"><button class="btn primary">${A.pad('A')}Buy<span class="pr">${A.icon('coin')}23</span></button><button class="btn">${A.pad('X')}Sell<span class="pr">${A.icon('coin')}17</span></button></div>
        <div class="d-order">${A.icon('flag')}<span><b>Order here:</b> 7 grain for 165 gold. You need 7 more.</span></div>
      </div>
    </section>`, [['A', 'Buy'], ['X', 'Sell'], ['B', 'Close']]);

  // Quay: who is on the quay, and the open quest card (the quest engine's card, on paper).
  const PEOPLE = [
    { id: 'kit', name: 'Kit Marlow', role: 'Fisher', line: 'Has a job for you', on: true, isNew: true },
    { id: 'rook', name: 'Rook', role: 'Harbourmaster', line: 'Rook’s thanks, step 2 of 3' },
  ];
  const pips = (n, of) => `<span class="pips">${Array.from({ length: of }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('')}</span>`;
  const quay = () => frame(`
    <section class="pane quay">
      <div class="q-list">
        <h3>On the quay</h3>
        ${PEOPLE.map((p) => `<div class="q-person${p.on ? ' on' : ''}">${A.face(p.id)}<div><b>${p.name}${p.isNew ? '<em class="new">New</em>' : ''}</b><i>${p.role}</i><span>${p.line}</span></div></div>`).join('')}
        <div class="village"><span>Village</span><span class="bar"><i style="width:8%"></i></span><b>0%</b></div>
      </div>
      <article class="q-card">
        <div class="qc-top">${A.face('kit')}<div><h2>Kit Marlow</h2><p>Fisher, Saltmere</p><span class="qc-step">Where the shoals went, step 1 of 3 ${pips(1, 3)}</span></div></div>
        <p class="qc-copy">My boats come home empty, captain. The fish went out past the East Reef. Rook went looking too, and found the reef. Watch for diving gulls, and keep off the rocks.</p>
        <div class="qc-goal">${A.icon('flag')}<span><b>Find the diving gulls</b> past the East Reef</span></div>
        <div class="qc-act"><button class="btn primary">${A.pad('A')}${A.icon('anchor')}Take the job</button><button class="btn">${A.pad('B')}Not now</button></div>
      </article>
    </section>`, [['A', 'Take the job'], ['LS', 'People'], ['B', 'Close']], false);

  // Shipyard: upgrades and the fleet, and a real reserved area for the 3D model preview (no fake render).
  const UPG = [
    ['sail', 'Sails and rigging', 'Now 8.7 kn top speed', 'Next: 9.4 kn, faster to speed'],
    ['hold', 'Hold', 'Now 10 units', 'Next: 16 units, deck crates'],
    ['hull', 'Hull', 'Now 100 durability', 'Next: 150 durability, 8.9 kn'],
  ];
  const FLEET = [
    ['Sloop', 'Starter', '10', '45°', '8.7', 'Sailing'],
    ['Cutter', 'Swift, tier 1', '16', '40°', '9.2', '1,500', true],
    ['Schooner', 'Swift, tier 2', '30', '38°', '10.9', 'Built off the chart'],
    ['Clipper', 'Swift, tier 3', '50', '40°', '12.6', 'Built off the chart'],
  ];
  const shipyard = () => frame(`
    <section class="pane yard">
      <div class="y-main">
        <h3>Upgrades for your sloop</h3>
        <div class="y-upgrades">${UPG.map(([ic, n, now, next]) => `<div class="y-up">${A.icon(ic)}<div class="yu-t"><b>${n}${pips(1, 3)}</b><span>${now}</span><span class="yu-next">${next}</span></div><button class="btn yu-buy"><span>${A.icon('coin')}300</span><i>Need 150 more</i></button></div>`).join('')}</div>
        <h3>Fleet</h3>
        <div class="y-fleet"><div class="yf-row yf-head"><span>Ship</span><span>Hold</span><span>Points</span><span>Top</span><span></span></div>
        ${FLEET.map(([n, k, hold, pts, top, price, on]) => `<div class="yf-row${on ? ' on' : ''}"><span class="yf-n"><b>${n}</b><i>${k}</i></span><span>${hold}</span><span>${pts}</span><span>${top} kn</span><span class="yf-p">${/^\d/.test(price) ? `${A.icon('coin')}${price}` : price}</span></div>`).join('')}</div>
      </div>
      <div class="y-side">
        <div class="y-preview"><span class="yp-l">3D preview: the cutter</span><span class="yp-s">Reserved for the model viewer</span><span class="yp-turn">${A.pad('RS')}Turn</span></div>
        <div class="y-ship"><h2>Cutter</h2><p>Swift, tier 1. Hold 16 (yours 10), points 40° off the wind (yours 45°), 9.2 kn.</p></div>
        <button class="btn primary y-buy">${A.pad('A')}Buy the cutter<span class="pr">${A.icon('coin')}1,500</span></button>
        <p class="y-need">You need 1,350 more.</p>
        <button class="btn y-looks">${A.pad('X')}Boat looks</button>
      </div>
    </section>`, [['A', 'Buy'], ['X', 'Boat looks'], ['B', 'Close']]);

  // Boat looks (#299, the Wardrobe layout) absorbed as paper: slots, the real turntable, the items.
  const SLOTS = [['Colours', 'Canvas', true], ['Patterns', 'Plain'], ['Logos', 'None'], ['Hull', 'Stock'], ['Figurehead', 'None'], ['Flag', 'The ship’s own'], ['Wake', 'Plain']];
  const SAILS = [['Canvas', '#fbf6e8', 'In use'], ['Linen', '#e9e1d4'], ['Sand', '#efdba6'], ['Peach', '#f3d6c6'], ['Sky', '#a9d4ee', 'on'], ['Mint', '#a8dfc0'], ['Lavender', '#cdbff0'], ['Harbour grey', '#c4ccd4']];
  const sail = (hex) => `<svg class="lk-sail" viewBox="0 0 40 40" aria-hidden="true"><path class="lk-mast" d="M19 3h2v33h-2z"/><path d="M22 5c9 7 13 17 13 28H22z" style="fill:${hex}"/><path d="M18 9 7 33h11z" style="fill:${hex}"/></svg>`;
  const looks = () => `
    <aside class="pane lk-slots">
      <h2>Boat looks</h2>
      <div class="lk-ships">${A.pad('LB')}<a class="on">Sloop</a><a class="off">Cutter</a>${A.pad('RB')}</div>
      ${SLOTS.map(([n, now, on]) => `<div class="lk-slot${on ? ' on' : ''}"><b>${n}</b><span>${now}</span></div>`).join('')}
      <button class="btn lk-stock">${A.pad('Y')}Back to stock</button>
    </aside>
    <div class="lk-stage">
      <div class="lk-line"><b>Your sloop</b><span>Sails 1, hold 1, hull 1</span></div>
      <div class="lk-compare">${['Stock', 'Yours', 'All upgrades'].map((c, i) => `<a${i === 1 ? ' class="on"' : ''}>${c}</a>`).join('')}</div>
      <div class="lk-view"><button>${A.pad('LS')}Turn</button><button>${A.pad('RS')}Night light</button></div>
    </div>
    <aside class="pane lk-items">
      <h3>Sail colours</h3>
      <div class="lk-grid">${SAILS.map(([n, hex, st]) => `<div class="lk-item${st === 'on' ? ' on' : ''}">${sail(hex)}<b>${n}</b>${st === 'In use' ? '<i>In use</i>' : ''}</div>`).join('')}</div>
      <div class="lk-detail"><b>Sky</b><span>Free. Now: Canvas.</span></div>
      <button class="btn primary lk-use">${A.pad('X')}Use on the sloop</button>
    </aside>
    <footer class="p-foot">${S.padbar([['A', 'Try on'], ['X', 'Use'], ['Y', 'Back to stock'], ['B', 'Close']])}</footer>`;

  const BUILD = { title: S.title, hud, market, quay, shipyard, looks, chart: S.chart };
  document.getElementById('app').innerHTML = `<div class="scr scr-${s}">${BG ? `<div class="bg" style="background-image:url(${BG})"></div>` : ''}${BUILD[s]()}</div>`;
  if (s === 'chart') document.getElementById('ovl').innerHTML = A.chartOverlay('chart');
})();
