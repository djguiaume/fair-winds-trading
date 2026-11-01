// The four mockup screens. The markup is shared; each direction's stylesheet gives it its identity.
// mock.html?d=chart|club|harbour&s=title|hud|harbour|chart&z=desktop|phone&t=night|day|storm
(() => {
  const q = new URLSearchParams(location.search);
  const d = q.get('d') || 'chart', s = q.get('s') || 'title', z = q.get('z') || 'desktop';
  const t = q.get('t') || (s === 'hud' ? 'night' : 'day');
  const A = window.ART, size = z === 'phone' ? 'landscape' : 'desktop';
  document.body.className = `d-${d} s-${s} z-${z} t-${t}`;
  document.getElementById('dircss').href = `${d}.css`;

  const BG = {
    title: `bg/t-c-${size}.jpg`,
    hud: { night: `bg/n-a-${size}.jpg`, day: `bg/s-day-${size}.jpg`, storm: `bg/s-storm-${size}.jpg` }[t],
    harbour: z === 'phone' ? 'bg/h-e-landscape.jpg' : 'bg/h-a-desktop.jpg',
    chart: '',
  };

  const stat = (ic, v, label) => `<div class="stat">${A.icon(ic)}<b>${v}</b><span class="stat-l">${label}</span></div>`;
  const padbar = (items) => `<div class="padbar">${items.map(([k, l]) => `<span class="pb">${A.pad(k)}${l}</span>`).join('')}</div>`;

  const title = () => `
    <div class="grade"></div>
    <div class="t-brand">${A.logo(d)}</div>
    <nav class="t-menu">
      <button class="btn primary big focus"><span class="b-l">Continue</span><span class="b-sub">Saltmere, day 12, 150 gold</span></button>
      <button class="btn">New voyage</button>
      <button class="btn">Free Sailing</button>
      <button class="btn">Settings</button>
    </nav>
    <div class="t-second"><a>How to play</a><a>Learn to sail</a><a>Move your voyage</a><span class="lang"><b>EN</b><i>FR</i></span></div>
    <div class="t-version">Version 1.6</div>
    ${padbar([['A', 'Select'], ['Y', 'Language']])}`;

  const hud = () => `
    <div class="h-status">
      <div class="h-stats">${stat('coin', '150', 'gold')}${stat('hold', '0/10', 'hold')}${stat('hull', '100%', 'hull')}</div>
      <div class="h-quest">${A.icon('flag')}<div><b>Find the diving gulls</b><span>Kit Marlow, step 1 of 3</span></div></div>
    </div>
    <div class="h-strip">${A.tape(z === 'phone' ? 300 : 420, 120, 96)}<div class="h-dest">${A.icon('anchor')}<b>Saltmere</b><span>37 m</span></div></div>
    ${{
      night: '<div class="h-toast">A foghorn sounds to the west</div>',
      day: '<div class="h-arrive"><b>Saltmere</b><span>Home port</span></div>',
      storm: `<div class="h-toast warn">${A.icon('flag')}The Stormbreak: reef your sails</div>`,
    }[t]}
    <div class="h-actions">
      <button class="hbtn">${A.icon('map')}<span>Map</span>${A.pad('X')}</button>
      <button class="hbtn">${A.icon('cargo')}<span>Cargo</span>${A.pad('Y')}</button>
      <button class="hbtn">${A.icon('menu')}<span>Menu</span>${A.pad('≡')}</button>
    </div>
    <div class="h-instr">
      <div class="i-speed"><b>3.5</b><span class="i-unit">kn</span></div>
      <div class="i-pos">Beam reach</div>
      <div class="i-row">${A.windDial(-75)}<div class="i-wind"><b>Breeze</b><span>NE, 12 kn</span><span>Heading 120°</span></div></div>
      <div class="i-sails"><span class="sl-k">${A.pad('LT')}</span><span class="sl">Down</span><span class="sl">Half</span><span class="sl on">Full</span><span class="sl-k">${A.pad('RT')}</span></div>
    </div>`;

  const GOODS = [
    { id: 'fish', name: 'Fish', note: 'Made here', hold: 0, buy: 4, sell: 2, best: 'Port Calda pays 13', trend: [5, 5, 4, 4, 3, 4, 4] },
    { id: 'grain', name: 'Grain', note: 'Wanted, order 7', hold: 0, buy: 23, sell: 17, best: 'Stonehaven pays 16', trend: [14, 15, 16, 18, 19, 21, 23], on: true },
    { id: 'timber', name: 'Timber', note: 'Wanted', hold: 0, buy: 39, sell: 28, best: 'Stonehaven pays 27', trend: [33, 34, 36, 35, 37, 38, 39] },
    { id: 'stone', name: 'Stone', note: '', hold: 0, buy: 22, sell: 17, best: 'Port Calda pays 34', trend: [24, 23, 23, 22, 22, 21, 22] },
  ];
  const spark = (v) => {
    const lo = Math.min(...v), hi = Math.max(...v), w = 120, h = 34;
    const pts = v.map((p, i) => `${(i / (v.length - 1)) * w},${h - 3 - ((p - lo) / (hi - lo || 1)) * (h - 8)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/><circle cx="${w}" cy="${pts.split(' ').pop().split(',')[1]}" r="3.4"/></svg>`;
  };
  const row = (g) => `<div class="g-row${g.on ? ' on' : ''}">
      <span class="g-art">${A.good(g.id)}</span>
      <span class="g-name"><b>${g.name}</b><i>${g.note}</i></span>
      <span class="g-hold"><b>${g.hold}</b><i>hold</i></span>
      <span class="g-buy">${A.icon('coin')}${g.buy}</span>
      <span class="g-sell">${A.icon('coin')}${g.sell}</span>
    </div>`;
  const g = GOODS[1];
  const harbour = () => `
    <header class="p-head">
      <div class="p-title"><h1>Saltmere</h1><p>Home port. Makes fish, wants grain and timber.</p></div>
      <nav class="tabs">${A.pad('LB')}<a class="on">Market</a><a>Orders<i>4</i></a><a>Quay<i>1</i></a><a>Shipyard</a>${A.pad('RB')}</nav>
      <div class="p-wallet">${stat('coin', '150', 'gold')}${stat('hold', '0/10', 'hold')}</div>
    </header>
    <section class="pane market">
      <div class="goods">
        <div class="g-head"><span>Goods</span><span>Hold</span><span>Buy</span><span>Sell</span></div>
        ${GOODS.map(row).join('')}
      </div>
      <div class="detail">
        <div class="d-top"><span class="d-art">${A.good(g.id)}</span><div><h2>Grain</h2><p>Wanted here, order 7</p></div></div>
        <div class="d-trend">${spark(g.trend)}<span>${A.icon('trend')}Up 9 in 6 days. ${g.best}.</span></div>
        <div class="d-qty"><span>Lot</span><b class="on">1</b><b>5</b><b>10</b></div>
        <div class="d-act"><button class="btn primary">${A.pad('A')}Buy<span class="pr">${A.icon('coin')}23</span></button><button class="btn">${A.pad('X')}Sell<span class="pr">${A.icon('coin')}17</span></button></div>
        <div class="d-order">${A.icon('flag')}<span><b>Order here:</b> 7 grain for 165 gold. You need 7 more.</span></div>
      </div>
    </section>
    <aside class="pane people">
      <div class="person">${A.face('rook')}<div><b>Rook</b><i>Harbourmaster</i><p>"Boats in, boats out, and the nets come home empty. It's all in the book."</p></div></div>
      <div class="person ask">${A.face('kit')}<div><b>Kit Marlow</b><p>Would like a word on the quay.</p></div>${A.pad('RB')}</div>
      <div class="village"><span>Village</span><span class="bar"><i style="width:8%"></i></span><b>0%</b></div>
    </aside>
    <footer class="p-foot">${padbar([['A', 'Buy'], ['X', 'Sell'], ['B', 'Close']])}<button class="btn primary sail">${A.icon('sail')}Set sail${A.pad('Y')}</button></footer>`;

  const chart = () => `
    <div class="c-map">${ASSETS.chart}</div>
    <div class="c-title"><h1>The Windward Ring</h1><p>Charted by your own hand</p></div>
    <nav class="c-tabs"><a class="on">${A.icon('map')}Chart</a><a>${A.icon('flag')}Journal</a><a>${A.icon('cargo')}Cargo</a><a>${A.icon('trend')}Prices</a></nav>
    <div class="c-key"><span><i class="k-course"></i>Your course</span><span><i class="k-quest"></i>Quest step</span><span><i class="k-reef"></i>Reef</span></div>
    <div class="c-zoom"><button>${A.icon('plus')}</button><button>${A.icon('minus')}</button></div>
    ${padbar([['LS', 'Pan'], ['LT', 'Zoom'], ['LB', 'Tabs'], ['B', 'Back']])}`;

  const ID = {
    chart: { name: '1. The chart table', idea: 'Ink on paper: an engraved rose, a drawn serif, torn chart pages. Sage is the signature.',
      colours: [['Paper', '#efe6d1'], ['Paper at night', '#dccfb1'], ['Ink', '#23303a'], ['Sage, signature', '#557a4b'], ['Sage wash', '#cfdcbc']],
      type: ['IM Fell English', 'Alegreya Sans'], motif: 'Compass rose and banderole; torn paper edge' },
    club: { name: '2. The sailing club', idea: 'Sportive and bold: slate and sailcloth, condensed type, big numbers, slanted tiles. Burgee pink is the signature.',
      colours: [['Slate', '#161e25'], ['Slate 2', '#24303a'], ['Sailcloth', '#f2f4ef'], ['Burgee pink, signature', '#ff5a8f'], ['Muted', '#8f9ea9']],
      type: ['Saira Condensed', 'Barlow'], motif: 'The club burgee and the slant' },
    harbour: { name: '3. The painted harbour', idea: 'Cosy and illustrated: painted wood and sailcloth, a hand-lettered sign, colour-coded goods. Bottle green is the signature.',
      colours: [['Painted wood', '#3e2b20'], ['Sailcloth', '#f3ead6'], ['Ink', '#2c211a'], ['Bottle green, signature', '#2f6d4f'], ['Goods: fish, grain, timber, stone', 'goods']],
      type: ['Caprasimo', 'Nunito Sans'], motif: 'The harbour sign; brushed paint edges' },
  };
  const identity = () => {
    const i = ID[d];
    const sw = i.colours.map(([n, h]) => h === 'goods'
      ? `<div class="sw"><span class="chip goods"><i style="background:#4f86ad"></i><i style="background:#d29a2e"></i><i style="background:#9c6236"></i><i style="background:#858d94"></i></span><b>${n}</b><code>#4f86ad #d29a2e #9c6236 #858d94</code></div>`
      : `<div class="sw"><span class="chip" style="background:${h}"></span><b>${n}</b><code>${h}</code></div>`).join('');
    return `<div class="id-logo">${A.logo(d)}</div>
      <div class="id-text"><h2>${i.name}</h2><p>${i.idea}</p>
        <div class="id-sw">${sw}</div>
        <div class="id-type"><span class="ty-d">Saltmere wants timber</span><span class="ty-b">Buy 5 grain for 115 gold. Beam reach, 3.5 kn.</span><code>${i.type[0]} + ${i.type[1]}. Motif: ${i.motif}.</code></div>
        <div class="id-parts"><button class="btn primary">Set sail</button><button class="btn">Not now</button>${A.pad('A')}${A.pad('B')}${A.pad('LB')}<span class="stat">${A.icon('coin')}<b>150</b></span><span class="stat">${A.icon('hold')}<b>6/10</b></span></div>
      </div>`;
  };

  const app = document.getElementById('app');
  app.innerHTML = `<div class="scr ${s}">${BG[s] ? `<div class="bg" style="background-image:url(${BG[s]})"></div>` : ''}${{ title, hud, harbour, chart, identity }[s]()}</div>`;
  if (s === 'chart') document.getElementById('ovl').innerHTML = A.chartOverlay(d);
})();
