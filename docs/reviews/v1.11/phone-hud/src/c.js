// C mirrors the corners; set inline so the page's own rules cannot win.
const put = (sel, side, other) => {
  const el = document.querySelector(sel);
  el.style.setProperty(side, '12px', 'important');
  el.style.setProperty(other, 'auto', 'important');
};
put('.hud-instr', 'left', 'right');
put('.hud-actions', 'right', 'left');
