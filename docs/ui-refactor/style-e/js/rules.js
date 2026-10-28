/* Palette, type and material rules sheet for style E refined (drawn into the real game page). */
(() => {
  const sw = (name, hex, note, dark) =>
    `<div class="sw"><i style="background:${hex}"></i><b>${name}</b><code>${hex}</code><small>${note}</small></div>`;
  const css = `<style>
    #rules{position:fixed;inset:0;z-index:99999;background:var(--paper) repeating-linear-gradient(transparent 0 39px,var(--paper-rule) 39px 40px);color:var(--paper-ink);padding:22px 28px;display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:26px;font-family:Barlow,sans-serif;overflow:hidden}
    #rules h3{margin:0 0 8px;font:900 22px Fraunces;color:var(--teal-ink);border-bottom:2px solid var(--teal-ink);padding-bottom:3px}
    #rules .sw{display:grid;grid-template-columns:34px 1fr auto;gap:2px 8px;align-items:center;margin:5px 0}
    #rules .sw i{width:34px;height:26px;border-radius:4px;border:1.5px solid #0e2a33;grid-row:span 2}
    #rules .sw b{font:700 15px Barlow} #rules .sw code{font:600 13px 'Barlow Condensed';color:var(--paper-dim)}
    #rules .sw small{grid-column:2/4;font:italic 500 13px Fraunces;color:var(--paper-dim)}
    #rules p,#rules li{font:500 15px/1.35 Barlow;margin:4px 0} #rules ul{padding-left:18px;margin:4px 0}
    #rules .spec{margin:6px 0;display:flex;align-items:baseline;gap:12px}
    #rules .spec small{font:600 13px Barlow;color:var(--paper-dim);width:120px;flex:none}
    #rules .mat{display:flex;gap:10px;margin:6px 0;align-items:center}
    #rules .mat span{width:96px;height:46px;border-radius:5px;flex:none;border:2px solid #0e2a33;font:600 12px Barlow;display:flex;align-items:center;justify-content:center;text-align:center}
  </style>`;
  const el = document.createElement('div');
  el.id = 'rules';
  el.innerHTML = css + `
  <section><h3>Palette</h3>
    ${sw('Paint', '#1f4c58', 'structure, HUD plates, bands, footers: flat, no plank lines')}
    ${sw('Paint light', '#2b6272', 'tabs; deep #143742 for shadows and pressed bands')}
    ${sw('Brass', '#e8c46a', 'art bible HUD colour: compass ring, rims, focus halo, main action on paint')}
    ${sw('Brass deep', '#b08a2c', 'the single rim round a plate, screws')}
    ${sw('Paper', '#f1e6c8', 'records, people, menus. Cream, never pure white')}
    ${sw('Paper 2 (notes)', '#e6d7ae', 'side notes, harbourmaster, quay notices')}
    ${sw('Ink', '#2e2217', 'text on paper; dim #6a5a44')}
    ${sw('Teal ink / action', '#1f5a66', 'headings and main action on paper')}
    ${sw('Cream text on paint', '#f4ecd6', 'text on paint (warm, not white)')}
    ${sw('Moss', '#3f7a4a', 'on / good. Green stays semantic')}
    ${sw('Danger', '#8f2f1c', 'New game and errors only (red is reserved)')}
    ${sw('Night paper', '#dccba1', 'lamp-lit paper; night paint #1c4755, ink #231910')}
  </section>
  <section><h3>Type</h3>
    <div class="spec"><small>Fraunces 900</small><span style="font:900 30px Fraunces">Fair Winds Trading</span></div>
    <div class="spec"><small>Fraunces 700</small><span style="font:700 21px Fraunces">Buy, Sell, Set sail, tabs</span></div>
    <div class="spec"><small>Fraunces italic</small><span style="font:italic 500 16px Fraunces">made here, wanted, notes</span></div>
    <div class="spec"><small>Barlow 500/600</small><span style="font:500 17px Barlow">Port Calda pays 13. Body text and tags.</span></div>
    <div class="spec"><small>Barlow Condensed 700</small><span style="font:700 34px 'Barlow Condensed'">150 &nbsp;0/10 &nbsp;1.0 kn &nbsp;Buy 23</span></div>
    <ul><li>Sentence case everywhere. Tracking only on the compass points.</li><li>Fraunces carries names and actions; condensed carries every figure.</li><li>Body never below 15 px; French wraps, nothing is shrunk.</li><li>Fraunces 700/900 (OFL), TTFs are about 70 KB each, a WOFF2 latin subset is not measured yet; Barlow stays.</li></ul>
    <h3 style="margin-top:14px">Icons</h3>
    <ul><li>Goods stay full colour. UI icons become filled two-tone (ADR 0220): ink outline, one fill; brass on paint, teal on paper.</li><li>This mockup keeps today's outline icons; the redraw is a build step.</li></ul>
  </section>
  <section><h3>Materials and shapes</h3>
    <div class="mat"><span style="background:#1f4c58;color:#f4ecd6;border-color:#b08a2c">Paint plate</span><p>HUD, bands, footers. One brass rim, flat. Screws only on the speed log and compass mount.</p></div>
    <div class="mat"><span style="background:#f1e6c8;border-radius:0 6px 0 0">Paper page</span><p>Ledger, menu, settings. Ruled lines only where nothing else divides it.</p></div>
    <div class="mat"><span style="background:#e6d7ae;border-left:6px solid #1f4c58;border-radius:3px 8px 8px 3px">Note</span><p>A notice on the page: harbourmaster, orders, quay people.</p></div>
    <div class="mat"><span style="background:#efe4c6;border-radius:50%;border-color:#b08a2c;border-width:5px;width:46px">N</span><p>Enamel face in a brass ring: the compass, the one paper-on-paint exception.</p></div>
    <h3 style="margin-top:12px">One shape per job</h3>
    <ul><li><b>Pills</b> = actions (Buy, Sell, Set sail). <b>Bookmarks</b> = tabs. <b>Stamped squares</b> = amounts. <b>Luggage tags</b> = information. <b>Plates</b> = instruments.</li><li>Action rule: it contrasts with its surface: teal on paper, brass on paint.</li><li>Selected = filled. Focus = dark line with a brass halo. Pressed = drops 3 px.</li></ul>
  </section>`;
  document.body.appendChild(el);
})();
