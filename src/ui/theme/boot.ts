import '../theme.css';
import { applyTheme, followLayout } from './apply';

// The game's tokens come from theme.json (decision 0269); theme.css only paints with them.
if (typeof document !== 'undefined') {
  applyTheme();
  followLayout();
}
