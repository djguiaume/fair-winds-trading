/* Injected into the running game to draw the menu + coach-mark mockups over real screens. */
(() => {
  const fr = document.documentElement.lang === 'fr' || (window.MOCK_LANG === 'fr');
  const T = fr ? {
    the: 'LA', title: 'Fair Winds<br>Trading Co.', tag: 'Lisez le vent. Livrez la marchandise.',
    play: 'Prendre la mer', resume: 'Reprendre', learn: 'Apprendre', learnN: '9 étapes courtes', learnCont: 'Continuer le tutoriel', learnStep: 'Étape 3/9',
    help: 'Comment jouer', settings: 'Réglages', paused: 'EN PAUSE', fs: 'Plein écran', phase: 'Commerce et chantier · Phase 1',
    gfx: 'Graphismes', now: 'Actuellement : bas', auto: 'Auto', low: 'Bas', med: 'Moyen', high: 'Haut', music: 'Musique', lang: 'Langue',
    log: 'Loch à la mer', logN: 'Vitesse, cap et allure', fps: 'Afficher les IPS', fpsN: 'Images par seconde', voyage: 'Voyage', back: 'Retour au départ', backN: 'Bloqué ? Le bateau revient au port.', newGame: 'Nouvelle partie', display: 'Affichage', sound: 'Son',
    wind: 'Le vent', windP: 'Impossible de remonter dans la zone rouge. On va le plus vite vent de travers (bande verte).',
    tack: 'Louvoyer', tackP: 'Pour remonter au vent, zigzaguez à environ 50° du vent, d’un bord puis de l’autre.',
    trade: 'Commercer', tradeP: 'Achetez ce qu’un port produit, vendez là où on le demande. Les commandes paient mieux.',
    touch: 'Tactile', touchC: 'Glisser pour barrer · levier de voile · toucher un port', keys: 'Clavier', keysC: ['← →', 'barrer', '↑ ↓', 'voiles', 'M', 'carte', 'Échap', 'menu'],
    offerT: 'Votre premier voyage', offerP: 'Des conseils courts, posés sur ce qu’il faut toucher. Votre vraie partie, rien n’est remis à zéro.',
    s1: 'Carte', s2: 'Voiles', s3: 'Vent', s4: 'Accoster', s5: 'Livrer', startT: 'Commencer', free: 'Navigation libre',
    skip: 'Passer',
  } : {
    the: 'THE', title: 'Fair Winds<br>Trading Co.', tag: 'Read the wind. Deliver the goods.',
    play: 'Set sail', resume: 'Resume', learn: 'Learn to sail & trade', learnN: '9 short steps', learnCont: 'Continue tutorial', learnStep: 'Step 3/9',
    help: 'How to play', settings: 'Settings', paused: 'PAUSED', fs: 'Fullscreen', phase: 'Trading & Shipyard · Phase 1',
    gfx: 'Graphics', now: 'Now using: Low', auto: 'Auto', low: 'Low', med: 'Medium', high: 'High', music: 'Music', lang: 'Language',
    log: 'Speed log at sea', logN: 'Speed, heading, point of sail', fps: 'Show FPS', fpsN: 'Frames per second', voyage: 'Voyage', back: 'Back to start', backN: 'Stuck? Brings the boat back to port.', newGame: 'New game', display: 'Display', sound: 'Sound',
    wind: 'The wind', windP: 'You can’t sail into the red zone. You are fastest with the wind across the boat (green band).',
    tack: 'Tacking', tackP: 'To go upwind, zigzag about 50° off the wind, first on one side, then the other.',
    trade: 'Trading', tradeP: 'Buy what a port makes, sell where it is wanted. Delivery orders pay extra.',
    touch: 'Touch', touchC: 'Drag to steer · sail lever · tap a port', keys: 'Keyboard', keysC: ['← →', 'steer', '↑ ↓', 'sails', 'M', 'map', 'Esc', 'menu'],
    offerT: 'Your first voyage', offerP: 'Short hints, pinned to what you need to tap. Your real game: nothing is reset.',
    s1: 'Chart', s2: 'Sails', s3: 'Wind', s4: 'Dock', s5: 'Deliver', startT: 'Start tutorial', free: 'Free sailing',
    skip: 'Skip',
  };
  const I = {
    sail: '<path d="M12 3v15M12 4l7 12h-7M11 6L5 16h6M3 19c3 2 15 2 18 0"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    book: '<path d="M4 5c3-1.5 6-1.5 8 0v14c-2-1.5-5-1.5-8 0zM20 5c-3-1.5-6-1.5-8 0v14c2-1.5 5-1.5 8 0z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M8 10h8M4 13c0 4 4 7 8 7s8-3 8-7"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
  };
  const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24">${I[n]}</svg>`;
  const emblem = (cls = 'emblem') => `<svg class="${cls}" viewBox="-50 -50 100 100">
    <circle r="46" fill="#123246" stroke="#e8c46a" stroke-width="3"/>
    <circle r="38" fill="none" stroke="rgba(232,196,106,.45)" stroke-width="1.5"/>
    ${[0, 90, 180, 270].map(a => `<path transform="rotate(${a})" d="M0 -40 L7 -7 L0 0 Z" fill="#f3d37e"/><path transform="rotate(${a})" d="M0 -40 L-7 -7 L0 0 Z" fill="#b08a2c"/>`).join('')}
    ${[45, 135, 225, 315].map(a => `<path transform="rotate(${a})" d="M0 -26 L4 -4 L0 0 L-4 -4 Z" fill="#eef3f4" opacity=".75"/>`).join('')}
    <circle r="5" fill="#e8c46a" stroke="#06141c" stroke-width="2"/>
    <text y="-41" text-anchor="middle" font-size="10" font-weight="700" fill="#06141c" font-family="Barlow Condensed" dy="3.5">N</text>
  </svg>`;
  const ver = () => (document.getElementById('app-version')?.textContent || 'v0.8') ;
  const root = () => {
    let m = document.getElementById('mock');
    if (!m) { m = document.createElement('div'); m.id = 'mock'; document.body.append(m); }
    const host = document.querySelector("dialog[open]") || document.body; if (m.parentElement !== host) host.append(m);
    return m;
  };
  const langSeg = `<div class="seg"><span class="${fr ? '' : 'on'}">EN</span><span class="${fr ? 'on' : ''}">FR</span></div>`;
  const portrait = () => document.body.classList.contains('portrait');

  window.mock = {
    clear() { root().innerHTML = ''; },
    menu(pause = false) {
      const brand = `<div class="brand">${emblem()}<div><small>${T.the}</small><h1>${T.title}</h1>${pause ? '' : `<p>${T.tag}</p>`}</div></div>`;
      const top = portrait() && !pause ? `<div class="brand-top">${emblem()}<small>${T.the}</small><h1>${T.title}</h1><p>${T.tag}</p></div>` : '';
      root().innerHTML = `<div class="scrim ${pause ? '' : 'light'}"></div>${top}
      <section class="menu">
        ${portrait() && !pause ? '' : brand}
        ${pause ? `<div class="voyage"><span class="paused">${T.paused}</span><span><svg viewBox="0 0 24 24"><use href="#i-coin"/></svg>150</span><span><svg viewBox="0 0 24 24"><use href="#i-hull"/></svg>3/10</span></div>` : ''}
        ${portrait() && !pause ? '' : '<div class="rule"></div>'}
        <div class="btn brass big">${ic(pause ? 'play' : 'sail')}${pause ? T.resume : T.play}</div>
        <div class="list">
          <div class="mrow tut">${ic('compass')}${pause ? T.learnCont : T.learn}<small>${pause ? T.learnStep : T.learnN}</small></div>
          <div class="mrow">${ic('book')}${T.help}</div>
          <div class="mrow">${ic('gear')}${T.settings}</div>
        </div>
        <footer><div class="btn sq" title="${T.fs}">${ic('fs')}</div>${langSeg}<div class="ver">${T.phase}<br><b>${ver()}</b></div></footer>
      </section>`;
    },
    settings() {
      const seg = (opts, on) => `<div class="seg">${opts.map((o, i) => `<span class="${i === on ? 'on' : ''}">${o}</span>`).join('')}</div>`;
      root().innerHTML = `<section class="sheet"><header class="sheet-head">${ic('gear')}<h2>${T.settings}</h2><span class="sp"></span><div class="btn red close">${ic('x')}</div></header>
      <div class="sheet-body set-cols">
        <div class="group">
          <span class="lbl">${T.display}</span>
          <div class="set"><span class="name">${T.gfx}<small>${T.now}</small></span><span class="ctl">${seg([T.auto, T.low, T.med, T.high], 0)}</span></div>
          <div class="set"><span class="name">${T.log}<small>${T.logN}</small></span><span class="ctl"><span class="toggle on"></span></span></div>
          <div class="set"><span class="name">${T.fps}<small>${T.fpsN}</small></span><span class="ctl"><span class="toggle"></span></span></div>
        </div>
        <div class="group">
          <span class="lbl">${T.sound} · ${T.lang}</span>
          <div class="set"><span class="name">${T.music}</span><span class="ctl"><span class="slider"><i></i><b></b></span><span class="pct">60%</span></span></div>
          <div class="set"><span class="name">${T.lang}</span><span class="ctl"><div class="seg"><span class="${fr ? '' : 'on'}">English</span><span class="${fr ? 'on' : ''}">Français</span></div></span></div>
          <span class="lbl" style="margin-top:6px">${T.voyage}</span>
          <div class="danger-zone"><div class="btn">${ic('anchor')}${T.back}</div><div class="btn red">${T.newGame}</div></div>
          <div class="note">${T.backN}</div>
        </div>
      </div></section>`;
    },
    help() {
      const wind = `<svg class="art" viewBox="-60 -50 120 100"><circle r="40" fill="none" stroke="rgba(238,243,244,.35)" stroke-width="2"/>
        <path d="M0 0 L-21 -34 A40 40 0 0 1 21 -34 Z" fill="rgba(255,106,85,.55)"/>
        <path d="M-37.6 -13.7 A40 40 0 0 0 -13.7 37.6" fill="none" stroke="#59d36b" stroke-width="6"/><path d="M37.6 -13.7 A40 40 0 0 1 13.7 37.6" fill="none" stroke="#59d36b" stroke-width="6"/>
        <path d="M0 -48 V-22" stroke="#9fe7ff" stroke-width="4"/><path d="M-6 -28 L0 -20 L6 -28" fill="none" stroke="#9fe7ff" stroke-width="4"/>
        <path d="M0 -14 C7 -6 7 8 4 14 H-4 C-7 8 -7 -6 0 -14Z" fill="#f4f0e2" stroke="#06141c" stroke-width="1.5" transform="rotate(90)"/></svg>`;
      const tack = `<svg class="art" viewBox="0 0 200 130"><path d="M25 10 V40 M45 10 V40" stroke="#9fe7ff" stroke-width="3"/><path d="M20 34 L25 42 L30 34 M40 34 L45 42 L50 34" fill="none" stroke="#9fe7ff" stroke-width="3"/>
        <path d="M130 122 L80 92 L130 62 L80 32 L112 14" fill="none" stroke="#e8c46a" stroke-width="4" stroke-linejoin="round" stroke-dasharray="1 0"/><circle cx="112" cy="12" r="6" fill="#e8c46a"/>
        <path d="M128 112 L138 126 L124 122 L120 126 Z" fill="#f4f0e2"/></svg>`;
      const trade = `<svg class="art" viewBox="0 0 200 100"><use href="#i-fish" x="10" y="26" width="48" height="48"/><path d="M66 50 H128" stroke="#e8c46a" stroke-width="4" stroke-dasharray="7 6"/><path d="M122 42 L134 50 L122 58" fill="none" stroke="#e8c46a" stroke-width="4"/><use href="#i-coin" x="142" y="28" width="44" height="44"/>
        <text x="34" y="92" text-anchor="middle" fill="#8fe3a4" font-family="Barlow Condensed" font-weight="700" font-size="16">6</text><text x="164" y="92" text-anchor="middle" fill="#8fe3a4" font-family="Barlow Condensed" font-weight="700" font-size="16">14</text></svg>`;
      const k = T.keysC;
      root().innerHTML = `<section class="sheet"><header class="sheet-head">${ic('book')}<h2>${T.help}</h2><span class="sp"></span><div class="btn red close">${ic('x')}</div></header>
      <div class="sheet-body htp">
        <div class="card">${wind}<h3>${T.wind}</h3><p>${T.windP}</p></div>
        <div class="card">${tack}<h3>${T.tack}</h3><p>${T.tackP}</p></div>
        <div class="card">${trade}<h3>${T.trade}</h3><p>${T.tradeP}</p></div>
        <div class="controls"><span><b>${T.touch}</b>${T.touchC}</span>${portrait() ? '' : `<span><b>${T.keys}</b><kbd>${k[0]}</kbd> ${k[1]} · <kbd>${k[2]}</kbd> ${k[3]} · <kbd>${k[4]}</kbd> ${k[5]} · <kbd>${k[6]}</kbd> ${k[7]}</span>`}</div>
      </div></section>`;
    },
    offer() {
      const st = [['map', T.s1], ['sail', T.s2], ['compass', T.s3], ['anchor', T.s4], ['play', T.s5]];
      root().innerHTML = `<div class="scrim"></div><section class="offer panel-d">
        <div class="top">${emblem()}<h2>${T.offerT}</h2></div>
        <p>${T.offerP}</p>
        <div class="steps">${st.map(([i, s]) => `<span>${ic(i)}${s}</span>`).join('')}</div>
        <div class="acts"><div class="btn brass">${T.startT}</div><div class="btn">${T.free}</div></div>
      </section>`;
    },
    coach({ target, pad = 6, step, title, text, act, prefer }) {
      const el = typeof target === 'string' ? document.querySelector(target) : null;
      const r0 = el ? el.getBoundingClientRect() : target;
      const r = { left: r0.left - pad, top: r0.top - pad, width: r0.width + 2 * pad, height: r0.height + 2 * pad };
      r.right = r.left + r.width; r.bottom = r.top + r.height;
      const m = root();
      m.innerHTML = `<div class="cm-ring" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></div>
        <div class="cm"><span class="arrow"></span><div class="head"><span class="dots">${Array.from({ length: 9 }, (_, i) => `<i class="${i < step ? 'done' : ''}"></i>`).join('')}</span><b>${title}</b><span class="x">${T.skip}${ic('x')}</span></div><p>${text}</p>${act ? `<div class="acts">${act}</div>` : ''}</div>`;
      const cm = m.querySelector('.cm'); const ar = m.querySelector('.arrow');
      const W = innerWidth, H = innerHeight, g = 14;
      const b = cm.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
      const fits = {
        top: r.top - g - b.height > 8, bottom: r.bottom + g + b.height < H - 8,
        left: r.left - g - b.width > 8, right: r.right + g + b.width < W - 8,
      };
      const side = [prefer, 'top', 'right', 'left', 'bottom'].find(s => s && fits[s]) || 'top';
      let x, y;
      if (side === 'top' || side === 'bottom') {
        x = clamp(cx - b.width / 2, 10, W - b.width - 10); y = side === 'top' ? r.top - g - b.height : r.bottom + g;
        ar.style.left = `${clamp(cx - x - 7, 12, b.width - 26)}px`; ar.style[side === 'top' ? 'bottom' : 'top'] = '-8px';
        ar.style.borderWidth = side === 'top' ? '0 1.5px 1.5px 0' : '1.5px 0 0 1.5px';
      } else {
        y = clamp(cy - b.height / 2, 10, H - b.height - 10); x = side === 'left' ? r.left - g - b.width : r.right + g;
        ar.style.top = `${clamp(cy - y - 7, 12, b.height - 26)}px`; ar.style[side === 'left' ? 'right' : 'left'] = '-8px';
        ar.style.borderWidth = side === 'left' ? '1.5px 1.5px 0 0' : '0 0 1.5px 1.5px';
      }
      cm.style.left = `${x}px`; cm.style.top = `${y}px`;
    },
  };
})();
