// Drawn parts shared by the three directions: icons, goods, instruments, logos, chart overlay.
// Every colour comes from the direction's stylesheet (CSS classes and variables), never from here.
(() => {
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;

  // One weight, filled icons (24 grid).
  const ICONS = {
    coin: '<circle class="i1" cx="12" cy="12" r="9"/><circle class="i2" cx="12" cy="12" r="5.6"/><path class="i1" d="M11 8.6h2v6.8h-2z"/>',
    hold: '<path class="i1" d="M3 6.5 12 3l9 3.5v11L12 21l-9-3.5z"/><path class="i2" d="M12 10.2 3 6.5v11L12 21z"/>',
    hull: '<path class="i1" d="M2 10h20l-3.2 8.2c-.4 1-1.3 1.8-2.4 1.8H7.6c-1.1 0-2-.8-2.4-1.8z"/><path class="i2" d="M11 3h2v7h-2z"/><path class="i1" d="M13 3.6l6 4.4h-6z"/>',
    map: '<path class="i1" d="M3 5.5 8.5 3.5l7 2.5 5.5-2v14.5l-5.5 2-7-2.5L3 20z"/><path class="i2" d="M8.5 3.5v14.5l7 2.5V6z"/>',
    cargo: '<rect class="i1" x="4" y="3" width="16" height="18" rx="4"/><path class="i2" d="M4 9h16v2.2H4zM4 13h16v2.2H4z"/>',
    menu: '<rect class="i1" x="3" y="5" width="18" height="2.8" rx="1.4"/><rect class="i1" x="3" y="10.6" width="18" height="2.8" rx="1.4"/><rect class="i1" x="3" y="16.2" width="18" height="2.8" rx="1.4"/>',
    flag: '<path class="i2" d="M5 2.5h2v19H5z"/><path class="i1" d="M7 3.5h12l-3 4.5 3 4.5H7z"/>',
    anchor: '<circle class="i1" cx="12" cy="4.8" r="2.6"/><path class="i1" d="M11 7h2v12.6c2.8-.4 4.8-2.2 5.4-4.8l-1.8.2 2.9-3.6 1.5 4.4-1.4-.6C18.9 18.7 15.8 21.5 12 21.5S5.1 18.7 4.4 15.2l-1.4.6 1.5-4.4 2.9 3.6-1.8-.2c.6 2.6 2.6 4.4 5.4 4.8z"/>',
    sail: '<path class="i2" d="M11 2h1.8v17H11z"/><path class="i1" d="M13.6 3.5c4 3.6 6 8.4 6 13.5h-6z"/><path class="i1" d="M10.2 6 4.4 17h5.8z"/><path class="i1" d="M3 19.5h18l-1.6 2.5H4.6z"/>',
    gear: '<path class="i1" d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><circle class="i2" cx="12" cy="12" r="3.4"/>',
    trend: '<path class="i1" d="M3 17.5 9 11l4 3.5 6.2-7.2-2.2-.3L21 4l.2 5-1.6-1.6-6.4 7.6-4-3.5-4.8 5.2z"/>',
    plus: '<path class="i1" d="M10.6 4h2.8v6.6H20v2.8h-6.6V20h-2.8v-6.6H4v-2.8h6.6z"/>',
    minus: '<path class="i1" d="M4 10.6h16v2.8H4z"/>',
    back: '<path class="i1" d="M10 4 2.5 12 10 20v-5c5.2 0 8.6 1.4 11.5 5-1-6.2-4.8-10.4-11.5-11z"/>',
  };
  const icon = (n, cls = '') => svg('0 0 24 24', ICONS[n], `ic ic-${n} ${cls}`);

  // Goods: one drawing each, painted by the direction (fill .ga main, .gb second, .gs shade, .gl line).
  const GOODS = {
    fish: '<path class="ga" d="M5 33c8-11 22-15 34-11 6 2 10 5 13 9-3 4-7 8-13 10-12 4-26 1-34-8z"/><path class="gb" d="M49 31.5 61 21c-1.6 7-1.6 14 0 21z"/><path class="gs" d="M8 36.5c10 6 22 8 33 4 4.6-1.6 8-4.4 11-8.2-3 4-7 8-13 10-11.6 4-24 1-31-5.8z"/><path class="gb" d="M26 22.5c3-4 8-6 12-5.5l-2 5.4z"/><circle class="ge" cx="15" cy="30.5" r="2.4"/><path class="gl" d="M5 33c8-11 22-15 34-11 6 2 10 5 13 9-3 4-7 8-13 10-12 4-26 1-34-8zM23 24.5c2.6 5 2.6 11 0 16M49 31.5 61 21c-1.6 7-1.6 14 0 21z"/>',
    grain: '<path class="gb" d="M31 30 22 60h3.2l7.6-29zM33 30l2 30h3.2l-3.6-30zM32 30l-16 28h3.4l14-27zM33.5 30l12 28h-3.4l-10-27z"/><g class="ga"><ellipse cx="32" cy="9" rx="4" ry="7"/><ellipse cx="24" cy="15" rx="3.6" ry="6.6" transform="rotate(-24 24 15)"/><ellipse cx="40" cy="15" rx="3.6" ry="6.6" transform="rotate(24 40 15)"/><ellipse cx="19" cy="24" rx="3.4" ry="6" transform="rotate(-40 19 24)"/><ellipse cx="45" cy="24" rx="3.4" ry="6" transform="rotate(40 45 24)"/><ellipse cx="32" cy="21" rx="3.8" ry="6.6"/></g><path class="gs" d="M20 36h24l-1.4 5H21.4z"/><path class="gl" d="M32 2v26M24 9.5l7 19M40 9.5l-7 19M17 19l14 10.5M47 19 33 29.5M20 36h24l-1.4 5H21.4z"/>',
    timber: '<path class="ga" d="M8 40h40v14H8zM16 26h40v14H16z"/><path class="gs" d="M8 50h40v4H8zM16 36h40v4H16z"/><ellipse class="gb" cx="8" cy="47" rx="6" ry="7"/><ellipse class="gb" cx="16" cy="33" rx="6" ry="7"/><ellipse class="gb" cx="48" cy="47" rx="0" ry="0"/><path class="gl" d="M8 40h40M8 54h40M16 26h40M16 40h32M3.4 47a2.6 3 0 1 0 9.2 0 2.6 3 0 1 0-9.2 0M11.4 33a2.6 3 0 1 0 9.2 0 2.6 3 0 1 0-9.2 0"/><ellipse class="gl" cx="8" cy="47" rx="6" ry="7"/><ellipse class="gl" cx="16" cy="33" rx="6" ry="7"/>',
    stone: '<path class="ga" d="M10 46 16 24l16-8 18 6 5 22-14 8H19z"/><path class="gs" d="M32 16l18 6 5 22-14 8 -3-20z"/><path class="gb" d="M16 24l16-8 6 16-22-8z"/><path class="gl" d="M10 46 16 24l16-8 18 6 5 22-14 8H19zM16 24l22 8 3 20M38 32l12-10"/>',
  };
  const good = (n) => svg('0 0 64 64', GOODS[n], `good good-${n}`);

  // A face from the game's portrait code, framed by the direction's CSS.
  const face = (id) => `<span class="face face-${id}">${svg('-2 -2 204 204', ASSETS.faces[id], 'face-svg')}</span>`;

  // Pad glyph: buttons get one neutral colour rule (not the reserved red and yellow).
  const pad = (k) => `<span class="pad pad-${k.length > 1 ? 'wide' : 'round'}">${k}</span>`;

  // Heading tape: compass ticks round the boat's heading, a marker for the destination.
  function tape(width, heading, dest) {
    const span = 70, ppd = width / (span * 2);
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let s = '';
    for (let d = Math.ceil((heading - span) / 5) * 5; d <= heading + span; d += 5) {
      const x = width / 2 + (d - heading) * ppd, b = ((d % 360) + 360) % 360;
      const major = b % 45 === 0, mid = b % 15 === 0;
      const tick = `d="M${x} ${major ? 20 : mid ? 24 : 27}V32"`;
      s = `<path class="t-under${major ? ' major' : ''}" ${tick}/>` + s + `<path class="t-tick${major ? ' major' : ''}" ${tick}/>`;
      if (major) s += `<text class="t-card" x="${x}" y="15">${names[b]}</text>`;
      else if (mid) s += `<text class="t-num" x="${x}" y="17">${b}</text>`;
    }
    const dx = width / 2 + (dest - heading) * ppd;
    s += `<path class="t-dest" d="M${dx - 7} 32h14l-7-9z"/>`;
    s += `<path class="t-lubber" d="M${width / 2 - 8} 0h16l-8 9z"/>`;
    return svg(`0 0 ${width} 34`, s, 'tape');
  }

  // Wind dial: the boat from above, the wind arrow from the relative wind angle, the sail arc.
  function windDial(rel) {
    const a = (rel - 90) * Math.PI / 180, r = 40;
    const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
    const x2 = 50 + Math.cos(a) * 20, y2 = 50 + Math.sin(a) * 20;
    let ticks = '';
    for (let d = 0; d < 360; d += 30) {
      const t = (d - 90) * Math.PI / 180;
      ticks += `<path class="w-tick" d="M${50 + Math.cos(t) * 44} ${50 + Math.sin(t) * 44}L${50 + Math.cos(t) * 47} ${50 + Math.sin(t) * 47}"/>`;
    }
    return svg('0 0 100 100', `<circle class="w-face" cx="50" cy="50" r="48"/>${ticks}
      <path class="w-boat" d="M50 26c6 6 8 14 8 22v18c0 4-3 7-8 7s-8-3-8-7V48c0-8 2-16 8-22z"/>
      <path class="w-sail" d="M50 38c-7 6-11 14-12 22l12 1z"/>
      <path class="w-arrow" d="M${x} ${y}L${x2} ${y2}"/>
      <circle class="w-arrow-tail" cx="${x}" cy="${y}" r="4"/>
      <path class="w-arrow-head" d="M${x2} ${y2}l${Math.cos(a + 2.6) * 9} ${Math.sin(a + 2.6) * 9}l${Math.cos(a - 2.6) * 9 - Math.cos(a + 2.6) * 9} ${Math.sin(a - 2.6) * 9 - Math.sin(a + 2.6) * 9}z"/>`, 'wind-dial');
  }

  // Wind compass, its own dial (Guillaume, round 2): boat up, the card turns with the heading,
  // the wind arrow from where the wind blows, and the no-go zone (no sail can point there) shaded.
  // Round 3: a bigger arrow head and the no-go zone hatched (`headLen`, `.wc-hatch`).
  function windCompass(heading, windFrom, noGo = 45, headLen = 10, tip = 30) {
    const rel = windFrom - heading, P = (deg, r) => {
      const t = (deg - 90) * Math.PI / 180;
      return [60 + Math.cos(t) * r, 60 + Math.sin(t) * r];
    };
    const arc = (a0, a1, r) => {
      const [x0, y0] = P(a0, r), [x1, y1] = P(a1, r);
      return `M60 60L${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}z`;
    };
    let ticks = '', letters = '';
    for (let b = 0; b < 360; b += 10) {
      const [x0, y0] = P(b - heading, 54), [x1, y1] = P(b - heading, b % 90 === 0 ? 46 : b % 30 === 0 ? 49 : 51);
      ticks += `<path class="wc-tick${b % 90 === 0 ? ' major' : ''}" d="M${x0} ${y0}L${x1} ${y1}"/>`;
    }
    for (const [b, n] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
      const [x, y] = P(b - heading, 38);
      letters += `<text class="wc-card" x="${x}" y="${y + 4.5}">${n}</text>`;
    }
    const [ax, ay] = P(rel, 57), [bx, by] = P(rel, tip);
    const head = (() => {
      const t = (rel - 90) * Math.PI / 180, ux = -Math.cos(t), uy = -Math.sin(t);
      const w = headLen * 0.6;
      return `M${bx + ux * -2} ${by + uy * -2}L${bx - ux * headLen - uy * w} ${by - uy * headLen + ux * w}L${bx - ux * headLen + uy * w} ${by - uy * headLen - ux * w}z`;
    })();
    const hatch = '<defs><pattern id="wc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="wc-hatch-line" d="M0 0V5"/></pattern></defs>';
    return svg('0 0 120 120', `${hatch}<circle class="wc-face" cx="60" cy="60" r="56"/>
      <path class="wc-nogo" d="${arc(rel - noGo, rel + noGo, 54)}"/><path class="wc-hatch" d="${arc(rel - noGo, rel + noGo, 54)}"/>
      ${ticks}${letters}
      <path class="wc-lubber" d="M60 2l4 7h-8z"/>
      <path class="wc-boat-under" d="M60 40c5 5 7 12 7 19v15c0 3-3 6-7 6s-7-3-7-6V59c0-7 2-14 7-19z"/>
      <path class="wc-boat" d="M60 40c5 5 7 12 7 19v15c0 3-3 6-7 6s-7-3-7-6V59c0-7 2-14 7-19z"/>
      <path class="wc-arrow-under" d="M${ax} ${ay}L${bx} ${by}"/>
      <path class="wc-arrow" d="M${ax} ${ay}L${bx} ${by}"/><path class="wc-head" d="${head}"/>`, 'wind-compass');
  }

  // Compass rose for the chart: 32 points, half the points filled (the classic engraved rose).
  function rose(size = 200) {
    let s = '<circle class="r-ring" cx="100" cy="100" r="96"/><circle class="r-ring2" cx="100" cy="100" r="84"/>';
    for (let d = 0; d < 360; d += 5) {
      const t = (d - 90) * Math.PI / 180, l = d % 45 === 0 ? 10 : d % 15 === 0 ? 6 : 3;
      s += `<path class="r-tick" d="M${100 + Math.cos(t) * 96} ${100 + Math.sin(t) * 96}L${100 + Math.cos(t) * (96 - l)} ${100 + Math.sin(t) * (96 - l)}"/>`;
    }
    const point = (deg, len, w) => {
      const t = (deg - 90) * Math.PI / 180, n = (deg) * Math.PI / 180;
      const tx = 100 + Math.cos(t) * len, ty = 100 + Math.sin(t) * len;
      const lx = 100 + Math.cos(n) * w, ly = 100 + Math.sin(n) * w;
      const rx = 100 - Math.cos(n) * w, ry = 100 - Math.sin(n) * w;
      return `<path class="r-dark" d="M100 100L${tx} ${ty}L${lx} ${ly}z"/><path class="r-light" d="M100 100L${tx} ${ty}L${rx} ${ry}z"/>`;
    };
    for (let d = 22.5; d < 360; d += 45) s += point(d, 52, 6);
    for (let d = 45; d < 360; d += 90) s += point(d, 66, 9);
    for (let d = 0; d < 360; d += 90) s += point(d, 86, 12);
    s += '<circle class="r-hub" cx="100" cy="100" r="5"/><text class="r-n" x="100" y="-6">N</text>';
    return `<svg class="rose" viewBox="0 -24 200 224" width="${size}" height="${size * 1.12}" aria-hidden="true">${s}</svg>`;
  }

  // The chart overlay in the chart's own map units (svg y = -map y): course, boat, quest mark, rose.
  function chartOverlay(d) {
    const course = 'M246 128 C 220 60, 236 -10, 214 -80 S 190 -200, 176 -246';
    const boat = '<path class="o-boat" d="M0 -11c4 3 5 9 5 13v6c0 2-2 4-5 4s-5-2-5-4V2c0-4 1-10 5-13z" transform="translate(246 128) rotate(-20)"/>';
    const quest = `<g class="o-quest" transform="translate(372 -32)"><circle r="17" class="o-quest-ring"/><path class="o-quest-flag" d="M-4 8V-12h2v20zM-2 -12h13l-3.5 5 3.5 5H-2z"/></g>`;
    const done = '<g class="o-done" transform="translate(-306 -108)"><circle r="6"/></g><g class="o-done" transform="translate(-160 300)"><circle r="6"/></g>';
    const legs = '<path class="o-past" d="M-300 -100 C -200 -40, -40 60, 60 100 S 200 140, 246 128"/>';
    const shipLabel = `<text class="o-label" x="262" y="164">Your sloop</text><text class="o-label o-dest" x="186" y="-262">Port Calda, 1 day</text>`;
    const r = `<g transform="translate(-380 230) scale(.95)">${rose(200).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
    return `${r}${legs}<path class="o-course" d="${course}"/>${done}${quest}${boat}${shipLabel}`;
  }

  // Logos, one per direction.
  const LOGOS = {
    // The chart table: an engraved compass star over a drawn serif wordmark, a banderole underneath.
    chart: () => `<div class="logo logo-chart">
        ${svg('0 0 120 120', `<circle class="l-ring" cx="60" cy="60" r="54"/><circle class="l-ring2" cx="60" cy="60" r="46"/>
          ${[0, 90, 180, 270].map((d) => `<g transform="rotate(${d} 60 60)"><path class="l-dark" d="M60 60 60 8 66 54z"/><path class="l-light" d="M60 60 60 8 54 54z"/></g>`).join('')}
          ${[45, 135, 225, 315].map((d) => `<g transform="rotate(${d} 60 60)"><path class="l-dark" d="M60 60 60 26 64 56z"/><path class="l-light" d="M60 60 60 26 56 56z"/></g>`).join('')}
          <circle class="l-hub" cx="60" cy="60" r="4"/>
          <path class="l-sig" d="M60 8c10 -2 22 -6 30 -2l-6 6 8 4c-10 2-22 0-32 -2z"/>`, 'l-emblem')}
        <div class="l-words"><span class="l-fair">Fair Winds</span>
        <span class="l-band">${svg('0 0 300 40', '<path class="l-ribbon" d="M14 6h272l-12 14 12 14H14l12-14z"/>', 'l-ribbon-svg')}<em>Trading Company</em></span></div>
      </div>`,
    // The sailing club: a pink burgee with a wind cut-out, a heavy slanted condensed wordmark.
    club: () => `<div class="logo logo-club">
        ${svg('0 0 120 90', `<path class="l-staff" d="M8 4h6v84H8z"/><path class="l-burgee" d="M14 8h98L14 62z"/><path class="l-cut" d="M24 20h44l-6 7H24zM24 32h28l-6 7H24z"/>`, 'l-emblem')}
        <div class="l-words"><span class="l-fair">Fair Winds</span><span class="l-sub">Trading Co.</span></div>
      </div>`,
    // The painted harbour: a hand-lettered name arched over a little painted boat, on a hanging board.
    harbour: () => `<div class="logo logo-harbour">
        ${svg('0 0 520 250', `<path class="l-rope" d="M120 0v40M400 0v40"/>
          <path class="l-board" d="M40 44h440c14 0 24 10 24 24v110c0 14-10 24-24 24H40c-14 0-24-10-24-24V68c0-14 10-24 24-24z"/>
          <path class="l-board-in" d="M48 54h424c10 0 16 6 16 16v104c0 10-6 16-16 16H48c-10 0-16-6-16-16V70c0-10 6-16 16-16z"/>
          <path id="arc" d="M66 142 Q260 58 454 142" fill="none"/>
          <text class="l-fair-shadow"><textPath href="#arc" startOffset="50%" text-anchor="middle">Fair Winds</textPath></text>
          <text class="l-fair"><textPath href="#arc" startOffset="50%" text-anchor="middle">Fair Winds</textPath></text>
          <path class="l-wave" d="M206 186c10-5 18-5 27 0s18 5 27 0 18-5 27 0 18 5 27 0v8H206z"/>
          <path class="l-hull" d="M226 176h70l-9 11h-52z"/><path class="l-mast" d="M259 140h3v36h-3z"/><path class="l-sail" d="M263 142c11 9 14 19 14 32h-14z"/><path class="l-sail2" d="M257 148l-17 26h17z"/>
          <path class="l-ribbon" d="M150 206h220l-10 14 10 14H150l10-14z"/>
          <text class="l-sub" x="260" y="226" text-anchor="middle">Trading Company</text>`, 'l-sign')}
      </div>`,
  };

  window.ART = { windCompass, icon, good, face, pad, tape, windDial, rose, chartOverlay, logo: (d) => LOGOS[d]() };
})();
