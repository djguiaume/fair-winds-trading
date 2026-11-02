import { t } from '../../i18n';
import { panel } from '../components';
import { el } from '../components/dom';
import './help.css';

/** A browser without WebGL2 gets this page instead of a blank one. */
export function showUnsupported() {
  const page = panel(
    { edge: 'torn' },
    el('h1', 'ui-header-title', t('game.title')),
    el('p', '', t('webgl.unsupported')),
  );
  page.classList.add('help-screen');
  document.body.append(page);
}
