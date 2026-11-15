// Mockup helper: keeps the quest card and its stamp out of the picture, so the HUD is judged
// alone (cards never cover the quest line, compass or lever, art bible 11).
const hideCards = () => {
  for (const el of document.querySelectorAll('.moment-stamp, #toaster *')) el.style.display = 'none';
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length || !/Kit Marlow · /.test(el.textContent || '')) continue;
    let p = el;
    while (p.parentElement && p.parentElement.id !== 'hud' && p.parentElement !== document.body)
      p = p.parentElement;
    p.style.display = 'none';
  }
};
hideCards();
setInterval(hideCards, 100);
