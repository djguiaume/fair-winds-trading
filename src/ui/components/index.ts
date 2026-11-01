import './components.css';

/**
 * The v1.5 UI components (decision 0269): every screen builds from these, so none keeps its own
 * button, tab or card style. They read only the theme's `--ui-*` tokens (src/data/ui/theme.json).
 */
export {
  BUTTON_VARIANTS,
  type ButtonOptions,
  type ButtonVariant,
  button,
  setDisabled,
} from './button';
export { type CardOptions, card } from './card';
export { Dialog, type DialogChoice, type DialogOptions } from './dialog';
export { setSelected } from './dom';
export { type ListRowOptions, listRow } from './listRow';
export { type PanelEdge, type PanelNight, type PanelOptions, panel, panelClasses } from './panel';
export {
  type HeaderExit,
  type ScreenHeader,
  type ScreenHeaderOptions,
  screenHeader,
} from './screenHeader';
export { type Tab, TabBar, type TabBarOptions } from './tabBar';
export { TOAST_MS, type ToastKind, type ToastOptions, Toaster } from './toast';
