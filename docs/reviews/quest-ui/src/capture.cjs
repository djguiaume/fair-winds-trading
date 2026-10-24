// Quest UI proposal mockups: the live game (French), docked at Saltmere, with mock HTML injected.
const { chromium } = require('playwright');
const VP = { desktop: [1280, 720], landscape: [915, 412], portrait: [412, 915] };
const OUT = process.env.OUT || 'mock';

const CSS = `
.mk-tag{display:inline-block;padding:3px 8px;border-radius:6px;background:var(--brass);color:#14202a;font:700 13px/1 var(--display);letter-spacing:.06em;text-transform:uppercase}
.mk-tag.done{background:var(--green);}
.mk-tag.next{background:#7fc8ff;}
.mk-btn{appearance:none;border:1.5px solid var(--brass-line);background:rgba(18,50,70,.9);color:var(--ink);border-radius:9px;padding:9px 14px;font:700 16px/1 var(--display);letter-spacing:.05em;text-transform:uppercase}
.mk-btn.brass{background:linear-gradient(#f3d37e,#e0b552);color:#1d2328;border-color:#b08a2c;box-shadow:0 3px 0 #b08a2c}
.mk-btn.ghost{background:none;border-color:transparent;color:var(--ink-dim);padding-left:6px;padding-right:6px}
.mk-x{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:8px;border:1px solid rgba(238,243,244,.25);background:none;color:var(--ink-dim);font:700 16px/1 var(--body)}
.mk-face svg{display:block}
.mk-who b{display:block;font:700 20px/1.05 var(--display);text-transform:uppercase;letter-spacing:.03em}
.mk-who small{color:var(--brass);font:700 13px/1.2 var(--display);text-transform:uppercase;letter-spacing:.04em}
.mk-todo{display:flex;gap:8px;align-items:flex-start;margin:8px 0 4px;padding:8px 10px;border-radius:8px;background:rgba(232,196,106,.12);border:1px solid var(--brass-line);font:600 15px/1.25 var(--body)}
.mk-todo i{font-style:normal;color:var(--ink-dim);font-weight:400}
.mk-reward{display:flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--ink-dim);font:600 14px/1.2 var(--body);margin:6px 0}
.mk-reward b{color:var(--brass)}
.mk-coin{display:inline-block;width:14px;height:14px;border-radius:50%;background:#f5c542;border:2px solid #b8861b;box-sizing:border-box}
.mk-pin{display:inline-flex;width:18px;height:18px;flex:none;border-radius:50%;background:var(--brass);color:#14202a;align-items:center;justify-content:center;font:700 12px/1 var(--display)}
/* A: a word at the quay, inside the port screen */
.mk-quay{position:relative;border:1.5px solid var(--brass);border-radius:12px;padding:12px 14px;background:linear-gradient(180deg,rgba(232,196,106,.14),rgba(9,28,41,.6));box-shadow:0 0 0 3px rgba(232,196,106,.12)}
.mk-quay .mk-row{display:flex;gap:10px;align-items:center;margin:8px 0 2px}
.mk-quay p{margin:6px 0;font:400 15px/1.3 var(--body);color:var(--ink)}
.mk-quay .mk-btns{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.mk-convo{display:grid;grid-template-columns:auto 1fr;gap:6px 22px;padding:18px 26px;align-content:start;overflow:auto}
.mk-convo .mk-back{grid-column:1/-1;justify-self:start}
.mk-convo p{margin:4px 0 6px;font:400 18px/1.4 var(--body)}
.mk-convo .mk-btns{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center}
.mk-convo .mk-steps{display:flex;gap:6px;align-items:center;color:var(--ink-dim);font:700 13px/1 var(--display);letter-spacing:.05em;text-transform:uppercase;margin-top:6px}
.mk-convo .mk-steps i{display:inline-block;width:26px;height:6px;border-radius:3px;background:rgba(238,243,244,.25)}
.mk-convo .mk-steps i.on{background:var(--brass)}
.mk-seanote{position:fixed;z-index:50;display:flex;gap:10px;align-items:center;max-width:360px;padding:8px 14px 8px 8px;border-radius:12px;background:var(--navy);border:1.5px solid var(--brass-line);box-shadow:0 6px 16px rgba(0,0,0,.35);color:var(--ink)}
.mk-seanote b{display:block;font:700 15px/1.1 var(--display);text-transform:uppercase;letter-spacing:.04em;color:var(--brass)}
.mk-seanote span{font:500 15px/1.25 var(--body)}
.mk-seanote small{display:block;color:var(--ink-dim);font:600 13px/1.2 var(--body);margin-top:2px}
.mk-tabdot{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;margin-left:8px;border-radius:11px;background:var(--brass);color:#14202a;font:700 14px/1 var(--display);box-shadow:0 0 0 4px rgba(232,196,106,.25)}
.mk-hint{display:flex;align-items:center;gap:10px;margin-right:auto;color:var(--ink);font:600 15px/1.2 var(--body)}
.mk-hint b{color:var(--brass)}
.mk-people{display:flex;flex-direction:column;gap:12px;padding:16px 22px;overflow:auto}
.mk-person{position:relative;display:grid;grid-template-columns:auto 1fr;gap:4px 16px;padding:12px 16px;border:1.5px solid var(--brass-line);border-radius:12px;background:rgba(18,50,70,.55)}
.mk-person.new{border-color:var(--brass)}
.mk-person p{margin:2px 0;font:400 15px/1.3 var(--body)}
.mk-person .mk-btns{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
/* C: arrival card before the port screen */
.mk-arrive{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;background:radial-gradient(ellipse at center,rgba(6,20,28,.8),rgba(6,20,28,.94));color:var(--ink)}
.mk-arrive h1{margin:0;font:700 34px/1 var(--display);letter-spacing:.06em;text-transform:uppercase}
.mk-arrive h1 small{display:block;text-align:center;font:700 15px/1.3 var(--display);color:var(--brass);letter-spacing:.08em}
.mk-acard{position:relative;display:grid;grid-template-columns:auto 1fr;gap:4px 20px;width:min(760px,100%);box-sizing:border-box;padding:18px 22px;border:1.5px solid var(--brass-line);border-radius:14px;background:rgba(9,28,41,.97);box-shadow:0 10px 30px rgba(0,0,0,.45)}
.mk-acard p{margin:6px 0;font:400 17px/1.4 var(--body)}
.mk-acard .mk-btns{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center}
.mk-skip{color:var(--ink-dim);font:700 15px/1 var(--display);letter-spacing:.06em;text-transform:uppercase}
@media (orientation:portrait){
  .mk-convo{grid-template-columns:1fr;padding:14px 16px}
  .mk-convo .mk-face{justify-self:center}
  .mk-acard{grid-template-columns:1fr;padding:16px}
  .mk-acard .mk-face{justify-self:center}
  .mk-acard .mk-btns .mk-btn{flex:1 1 100%}
  .mk-arrive h1{font-size:28px}
  .mk-people{padding:12px}
  .mk-person{padding:10px 12px;gap:4px 10px}
}
@media (max-height:450px){
  .mk-convo{padding:10px 20px}
  .mk-convo p{font-size:15px;line-height:1.3}
  .mk-acard{padding:12px 18px;gap:2px 14px}
  .mk-acard p{font-size:15px;margin:3px 0}
  .mk-arrive{gap:6px}
  .mk-arrive h1{font-size:24px}
  .mk-people{padding:10px 16px;gap:8px}
}
`;

const ASK = 'Le poisson est parti au-delà du récif de l’Est. Guettez les mouettes qui plongent, et gare aux rochers.';
const FULL =
  'Mes bateaux rentrent vides, capitaine. Le poisson est parti au-delà du récif de l’Est. Rook l’a cherché aussi, et il a trouvé le récif. Guettez les mouettes qui plongent, et gare aux rochers.';
const TODO = '<div class="mk-todo"><span class="mk-pin">!</span><div>Trouvez les mouettes qui plongent <i>· 3 endroits, repérés sur la carte</i></div></div>';
const REWARD = '<div class="mk-reward">Récompense : <b>100</b> <span class="mk-coin"></span> · puis 2 étapes de plus</div>';

async function setup(b, name, w, h) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    hasTouch: name !== 'desktop',
    isMobile: name !== 'desktop',
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5199/?debug');
  await p.waitForTimeout(1500);
  await p.click('#menu-play');
  await p.waitForTimeout(500);
  const ss = await p.$('#set-sail');
  if (ss) {
    await ss.click();
    await p.waitForTimeout(500);
  }
  await p.click('#tutorial-free');
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const f = window.fwt;
    const h = f.view.harbours.saltmere;
    Object.assign(f.world.boat, { x: h.x, y: h.y, speedKn: 0 });
    f.world.boat.sailStep = 0;
  });
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ css }) => {
    const d = document.getElementById('quest-card');
    if (d.open) d.close();
    const st = document.createElement('style');
    st.textContent = css;
    document.head.append(st);
    const m = await import('/src/ui/portraits.ts');
    window.mkFace = (id, size, mood) => m.portraitSvg(m.character(id), { size, mood });
  }, { css: CSS });
  await p.waitForTimeout(300);
  return { p, ctx };
}

const shot = (p, file) => p.screenshot({ path: `${OUT}/${file}.png` });

async function optionA(p, name) {
  // A1: the person waits in the port screen's side column (portrait: above the market).
  await p.evaluate(({ name, ASK, TODO, REWARD }) => {
    const small = name !== 'desktop';
    const card = document.createElement('section');
    card.className = 'mk-quay side-card';
    card.innerHTML = `<span class="mk-tag">Nouvelle mission</span><button class="mk-x" title="Ignorer cette mission">✕</button>
      <div class="mk-row"><span class="mk-face">${mkFace('kit', small ? 48 : 60, 'worried')}</span><div class="mk-who"><b>Kit Marlow</b><small>Pêcheur · sur le quai</small></div></div>
      ${name === 'landscape' ? '' : `<p>« ${ASK} »</p>`}${TODO}${name === 'landscape' ? '' : REWARD}
      <div class="mk-btns"><button class="mk-btn brass">Écouter Kit</button><button class="mk-btn">Plus tard</button></div>`;
    const side = document.querySelector('.port-side');
    side.prepend(card);
    side.querySelectorAll('.side-card:not(.mk-quay)')[1]?.remove();
    if (name === 'landscape') side.querySelector('.side-card:not(.mk-quay)')?.remove();
    if (name === 'portrait') {
      side.querySelector('.side-card:not(.mk-quay)')?.remove();
      card.style.gridColumn = '1 / -1';
    }
  }, { name, ASK, TODO, REWARD });
  await p.waitForTimeout(200);
  await shot(p, `A1-quay-${name}`);
  // A2: "Listen" opens the conversation inside the port screen, in place of the market.
  await p.evaluate(({ FULL, TODO, REWARD, name }) => {
    document.querySelector('.mk-quay')?.remove();
    const main = document.querySelector('.trade-content');
    const small = name === 'landscape';
    main.innerHTML = `<div class="mk-convo">
      ${small ? '' : '<button class="mk-btn ghost mk-back">← Marché</button>'}
      <span class="mk-face">${mkFace('kit', small ? 80 : 150, 'worried')}</span>
      <div>
        <span class="mk-tag">Nouvelle mission</span>
        <div class="mk-who" style="margin-top:8px"><b>Kit Marlow</b><small>Pêcheur · Saltmere · Où sont passés les bancs</small></div>
        ${small ? '' : `<p>${FULL}</p>`}${small ? '<p>« Le poisson est parti au-delà du récif de l’Est. »</p>' : ''}
        ${TODO}${small ? '' : REWARD}
        <div class="mk-btns"><button class="mk-btn brass">⚓ Je m’en charge</button><button class="mk-btn">Plus tard</button><button class="mk-btn ghost">Ne plus proposer</button></div>
      </div></div>`;
    document.querySelectorAll('.trade-tabs .tab-btn').forEach((t) => t.classList.remove('active'));
  }, { FULL, TODO, REWARD, name });
  await p.waitForTimeout(200);
  await shot(p, `A2-listen-${name}`);
}

async function optionB(p, name) {
  await p.evaluate(({ name }) => {
    const tabs = document.querySelector('.trade-tabs');
    const tab = document.createElement('button');
    tab.className = 'tab-btn';
    tab.innerHTML = `Quai<span class="mk-tabdot">1</span>`;
    tabs.insertBefore(tab, document.getElementById('tp-tab-shipyard'));
    const foot = document.querySelector('.trade-footer');
    const hint = document.createElement('div');
    hint.className = 'mk-hint';
    hint.innerHTML = `<span class="mk-face">${mkFace('kit', 40, 'worried')}</span><span><b>Kit Marlow</b> voudrait vous parler <span style="color:var(--brass)">→ Quai</span></span>`;
    if (name !== 'portrait') foot.prepend(hint);
    else {
      hint.style.margin = '0 0 8px';
      foot.style.flexWrap = 'wrap';
      foot.prepend(hint);
    }
    window.mkTab = tab;
  }, { name });
  await p.waitForTimeout(200);
  await shot(p, `B1-badge-${name}`);
  await p.evaluate(({ ASK, TODO, REWARD, name }) => {
    document.querySelectorAll('.trade-tabs .tab-btn').forEach((t) => t.classList.remove('active'));
    window.mkTab.classList.add('active');
    window.mkTab.querySelector('.mk-tabdot').remove();
    document.querySelector('.mk-hint')?.remove();
    const small = name === 'landscape';
    const main = document.querySelector('.trade-content');
    main.innerHTML = `<div class="mk-people">
      <article class="mk-person new"><span class="mk-face">${mkFace('kit', small ? 56 : name === 'portrait' ? 56 : 84, 'worried')}</span><div>
        <div class="mk-who"><b>Kit Marlow</b><small>Pêcheur</small></div><span class="mk-tag">Nouvelle mission</span>
        ${small ? '' : `<p>« ${ASK} »</p>`}${TODO}${small ? '' : REWARD}
        <div class="mk-btns"><button class="mk-btn brass">⚓ Je m’en charge</button><button class="mk-btn">Plus tard</button><button class="mk-btn ghost">Ne plus proposer</button></div></div></article>
      <article class="mk-person"><span class="mk-face">${mkFace('rook', small ? 56 : name === 'portrait' ? 56 : 84, 'pleased')}</span><div>
        <div class="mk-who"><b>Rook</b><small>Capitaine de port</small></div><span class="mk-tag done">Terminée</span>
        <p>« Skerry est à vous, capitaine. » <span style="color:var(--ink-dim)">Les remerciements de Rook · récompense : l’île de Skerry</span></p></div></article>
    </div>`;
  }, { ASK, TODO, REWARD, name });
  await p.waitForTimeout(200);
  await shot(p, `B2-people-${name}`);
}

async function optionC(p, name) {
  await p.evaluate(({ FULL, ASK, TODO, REWARD, name }) => {
    document.getElementById('tp-close')?.click();
  }, { FULL, ASK, TODO, REWARD, name });
  await p.waitForTimeout(600);
  await p.evaluate(({ FULL, ASK, TODO, REWARD, name }) => {
    const small = name === 'landscape';
    const el = document.createElement('div');
    el.className = 'mk-arrive';
    el.innerHTML = `<h1>Saltmere<small>À quai · quelqu’un vous attend</small></h1>
      <div class="mk-acard"><span class="mk-face">${mkFace('kit', small ? 84 : name === 'portrait' ? 96 : 140, 'worried')}</span><div>
        <span class="mk-tag">Nouvelle mission</span>
        <div class="mk-who" style="margin-top:8px"><b>Kit Marlow</b><small>Pêcheur · Où sont passés les bancs · 1 sur 3</small></div>
        <p>${small ? '« ' + ASK + ' »' : FULL}</p>${TODO}${small ? '' : REWARD}
        <div class="mk-btns"><button class="mk-btn brass">⚓ Je m’en charge</button><button class="mk-btn">Plus tard</button><button class="mk-btn ghost">Ne plus proposer</button></div>
      </div></div>
      <span class="mk-skip">Aller au marché →</span>`;
    document.body.append(el);
  }, { FULL, ASK, TODO, REWARD, name });
  await p.waitForTimeout(200);
  await shot(p, `C1-arrival-${name}`);
}

async function seaNote(p, name) {
  // At sea, a step moves on: a small note under the gold, no card (all options).
  await p.evaluate(({ name }) => {
    document.querySelector('.mk-arrive')?.remove();
    const f = window.fwt;
    Object.assign(f.world.boat, { x: 205, y: 30, speedKn: 0 });
    f.world.boat.heading = 4.6;
    f.world.boat.sailStep = 2;
    f.world.destination = null;
  }, { name });
  await p.waitForTimeout(1500);
  await p.evaluate(({ name }) => {
    const el = document.createElement('div');
    el.className = 'mk-seanote';
    el.style.left = '12px';
    el.style.top = name === 'portrait' ? '150px' : name === 'landscape' ? '64px' : '70px';
    el.innerHTML = `<span class="mk-face">${mkFace('kit', 52, 'pleased')}</span><div><b>Kit · 1 sur 3</b><span>« Les mouettes plongent ! »</span><small>Mission suivie · touchez pour le journal</small></div>`;
    document.body.append(el);
  }, { name });
  await p.waitForTimeout(300);
  await shot(p, `S-sea-note-${name}`);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [name, [w, h]] of Object.entries(VP)) {
    for (const opt of [optionA, optionB, optionC]) {
      const { p, ctx } = await setup(b, name, w, h);
      await opt(p, name);
      if (opt === optionC) await seaNote(p, name);
      await ctx.close();
    }
  }
  await b.close();
})();
