import { applyTheme, followLayout } from './apply';

// The game's tokens come from theme.json (decision 0269).
if (typeof document !== 'undefined') {
  applyTheme();
  followLayout();
}
