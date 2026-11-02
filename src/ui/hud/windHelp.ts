import { t } from '../../i18n';
import { Dialog } from '../components';
import { el } from '../components/dom';
import { tackDiagram } from '../screens/helpArt';
import '../screens/help.css';

/** The sailing tips the wind dial opens: how to tack, drawn, on a paper dialog. */
export function windHelpDialog(): Dialog<void> {
  const body = el('div', 'wind-help-body');
  body.innerHTML = tackDiagram(
    t('wind.diagramTitle'),
    t('wind.diagramDesc'),
    t('wind.diagramWind'),
    t('wind.diagramZigzag'),
  );
  body.append(el('p', 'wind-help-note', t('wind.helpNote')));
  const dialog = new Dialog<void>({
    title: t('wind.helpTitle'),
    text: t('wind.helpCopy'),
    body,
    choices: [{ label: t('wind.helpClose'), value: undefined, variant: 'primary' }],
    cancel: undefined,
  });
  dialog.root.id = 'wind-help';
  dialog.buttons[0]!.id = 'close-wind-help';
  return dialog;
}
