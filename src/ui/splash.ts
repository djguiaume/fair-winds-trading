/** Fades the start view out once the menu is up (issue #396), then removes it. */
export function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('is-done');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  // No transition runs when the tab is hidden or motion is cut: remove it anyway.
  setTimeout(() => splash.remove(), 800);
}
