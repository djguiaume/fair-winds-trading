/** Which test sea the page sails (`?map=…`, the map editor's Play, a quest test). */
export interface TestSea {
  stressTest: boolean;
  ringAlone: boolean;
  questTest: boolean;
  editedPhase4: boolean;
}

/**
 * Names a test sea in the tab title and in a small badge at the bottom that links back to its
 * editor page (decisions 0095, 0115, 0161), so it is never taken for the voyage.
 */
export function showTestSeaBadge({ stressTest, ringAlone, questTest, editedPhase4 }: TestSea) {
  document.title = `${stressTest ? 'Stress test' : ringAlone ? 'Ring alone' : questTest ? 'Quest test' : editedPhase4 ? 'Edited Phase 4 sea' : 'Edited map'} · ${document.title}`;
  const badge = document.createElement('a');
  badge.href = editedPhase4 ? './editor.html?sea=phase4' : './editor.html?sea=ring';
  badge.textContent = stressTest
    ? 'Stress test sea'
    : ringAlone
      ? 'The Windward Ring alone (test)'
      : editedPhase4
        ? 'Edited Phase 4 sea · back to editor'
        : 'Edited map · back to editor';
  badge.style.cssText =
    'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:50;padding:3px 10px;' +
    'border-radius:10px;background:#123246e6;color:#f3d37e;font:600 12px sans-serif;' +
    'text-decoration:none;';
  // A label only: the stress sea and the ring alone have no editor page to go back to.
  if (stressTest || ringAlone) {
    badge.removeAttribute('href');
    badge.style.pointerEvents = 'none';
  }
  // The quest test bar says it all (and links back) instead.
  if (!questTest) document.body.append(badge);
}
