// Mockup: the controller's button hints, bottom centre, and (with ?pointer) the pointer of mockup C.
(() => {
  const fr = document.documentElement.lang === 'fr';
  const words = fr
    ? { a: 'Choisir', b: 'Retour', tabs: 'Onglets' }
    : { a: 'Choose', b: 'Back', tabs: 'Tabs' };
  const css = document.createElement('style');
  css.textContent = `
  .pad-hints { position: fixed; z-index: 2147483000; left: 50%; bottom: max(10px, env(safe-area-inset-bottom));
    transform: translateX(-50%); display: flex; gap: 14px; align-items: center; padding: 6px 14px;
    border: 1px solid rgba(232,196,106,.55); border-radius: 999px; background: rgba(9,28,41,.9);
    color: #eef3f4; font: 700 15px/1 'Barlow Condensed', sans-serif; letter-spacing: .06em;
    text-transform: uppercase; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
  .pad-hints span { display: inline-flex; align-items: center; gap: 6px; }
  .pad-key { display: inline-grid; place-items: center; min-width: 22px; height: 22px; border-radius: 50%;
    font: 800 13px/1 'Barlow', sans-serif; color: #08141b; }
  .pad-key.a { background: #59d36b; } .pad-key.b { background: #ff6a55; }
  .pad-key.bumper { border-radius: 6px; min-width: 28px; height: 18px; font-size: 11px; background: #c9d6da; }
  @media (max-width: 600px), (max-height: 450px) { .pad-hints { font-size: 13px; gap: 10px; padding: 5px 10px; } }`;
  document.head.append(css);
  const bar = document.createElement('div');
  bar.className = 'pad-hints';
  const tabs = window.__padTabs
    ? `<span><i class="pad-key bumper">LB</i><i class="pad-key bumper">RB</i>${words.tabs}</span>`
    : '';
  bar.innerHTML = `<span><i class="pad-key a">A</i>${words.a}</span><span><i class="pad-key b">B</i>${words.b}</span>${tabs}`;
  document.body.append(bar);
  if (window.__padPointer) {
    requestAnimationFrame(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return;
      const r = el.getBoundingClientRect();
      const p = document.createElement('div');
      p.className = 'pad-pointer';
      p.innerHTML =
        '<svg viewBox="0 0 22 26" width="22" height="26"><path d="M2 2 L20 13 L2 24 L7 13 Z" fill="#f3d37e" stroke="#06141c" stroke-width="2" stroke-linejoin="round"/></svg>';
      const left = r.left - 30;
      p.style.left = `${left < 2 ? r.right + 6 : left}px`;
      if (left < 2) p.style.transform = 'scaleX(-1)';
      p.style.top = `${r.top + r.height / 2 - 13}px`;
      document.body.append(p);
    });
  }
})();
