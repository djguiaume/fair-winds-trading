/* Component strip for style E refined: real game classes, five states, on paper and on paint.
   Drawn into the real game page by `npm run shots --script` (decision 0163). */
(() => {
  const states = ['Normal', 'Pressed', 'Selected', 'Unavailable', 'Focused'];
  const attrs = (s, selectedAttr) =>
    s === 'Pressed' ? ' data-demo="pressed"' : s === 'Focused' ? ' data-demo="focus"' : s === 'Unavailable' ? ' disabled' : s === 'Selected' ? selectedAttr : '';
  const row = (label, make) =>
    `<div class="srow"><span class="slabel">${label}</span>${states.map((s) => `<span class="scell">${make(s)}</span>`).join('')}</div>`;
  const head = `<div class="srow shead"><span class="slabel"></span>${states.map((s) => `<span class="scell">${s}</span>`).join('')}</div>`;
  const paper = [
    row('Main action', (s) => `<button class="d-btn brass"${attrs(s, ' style="outline:0"')}>${s === 'Selected' ? 'Set sail ✓' : 'Set sail'}</button>`),
    row('Secondary', (s) => `<button class="d-btn"${attrs(s, ' style="background:#366d94!important;color:#f1e6c8!important"')}>Not now</button>`),
    row('Buy', (s) => `<span class="good-row" style="display:inline-flex;border:0;min-height:0"><button class="buy-btn"${attrs(s, '')} style="min-width:120px;min-height:44px;padding:0 14px">Buy <b>23</b></button></span>`),
    row('Sell', (s) => `<span class="good-row" style="display:inline-flex;border:0;min-height:0"><button class="sell-btn"${attrs(s, '')} style="min-width:120px;min-height:44px;padding:0 14px">Sell <b>17</b></button></span>`),
    row('Setting (segmented)', (s) => `<span class="seg"><button${s === 'Selected' ? ' aria-pressed="true"' : ''}${s === 'Pressed' ? ' data-demo="pressed"' : ''}${s === 'Focused' ? ' data-demo="focus"' : ''}${s === 'Unavailable' ? ' disabled style="opacity:.5"' : ''}>Captain</button></span>`),
  ].join('');
  const paint = [
    row('Tab', (s) => `<span class="port-screen" style="position:static;display:inline-block;width:auto;height:auto;background:none!important"><button class="tab-btn${s === 'Selected' ? ' active' : ''}"${attrs(s, '')} style="min-height:44px">Market</button></span>`),
    row('Amount', (s) => `<button class="lot-btn"${s === 'Selected' ? ' aria-pressed="true"' : ''}${s === 'Pressed' ? ' data-demo="pressed"' : ''}${s === 'Focused' ? ' data-demo="focus"' : ''}${s === 'Unavailable' ? ' disabled style="opacity:.45"' : ''} style="min-width:48px;min-height:44px">×5</button>`),
    row('Footer action', (s) => `<span class="trade-footer" style="display:inline-flex;position:static;background:none!important;border:0!important;padding:0;box-shadow:none!important"><button class="port-btn brass"${attrs(s, '')} style="min-height:46px;padding:0 16px">Set sail</button></span>`),
    row('Map button', (s) => `<button class="icon-btn map-btn"${attrs(s, '')} style="width:auto;min-height:46px;padding:0 14px">Map</button>`),
    row('Information tag', (s) => (s === 'Normal' ? `<span class="port-screen" style="position:static;display:inline-block;width:auto;height:auto;background:none!important"><span class="role-tag" style="white-space:nowrap">Home port</span></span>` : '<span class="snote">not interactive</span>')),
  ].join('');
  const css = `<style>
    #strip{position:fixed;inset:0;z-index:99999;display:grid;grid-template-rows:56% 44%;gap:0;font-family:Barlow,sans-serif}
    #strip .col{padding:14px 28px;overflow:hidden}
    #strip .paper{background:var(--paper)}
    #strip .paint{background:var(--paint)}
    #strip h3{margin:0 0 4px;font:900 24px var(--display)}
    #strip .paper h3{color:var(--teal-ink)} #strip .paint h3{color:var(--ink)}
    #strip .srow{display:grid;grid-template-columns:150px repeat(5,1fr);align-items:center;gap:8px;min-height:44px}
    #strip .shead{min-height:26px;font:italic 600 14px var(--display)}
    #strip .slabel{font:600 15px Barlow;opacity:.85}
    #strip .scell{display:flex;align-items:center}
    #strip .snote{font:italic 500 13px var(--display);opacity:.7}
    #strip .paper .shead,#strip .paper .slabel{color:var(--paper-dim)} #strip .paint .shead,#strip .paint .slabel{color:var(--ink-dim)}
  </style>`;
  const el = document.createElement('div');
  el.id = 'strip';
  el.innerHTML = css +
    `<div class="col paper sheet-body" style="margin:0;border-radius:0;box-shadow:none"><h3>On paper</h3>${head}${paper}</div>` +
    `<div class="col paint"><h3>On paint</h3>${head}${paint}</div>`;
  document.body.appendChild(el);
})();
