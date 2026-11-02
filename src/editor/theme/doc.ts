import { formatJson } from '../../data/jsonFormat';
import { themeProblems } from '../../ui/theme/checks';
import { SHIPPED_THEME, type Theme } from '../../ui/theme/model';

/**
 * The UI theme as the editors' Theme page and `npm run theme` edit it (decisions 0153, 0269).
 * Pure, so the page, the command and the tests share the same tokens, edits, checks and file.
 * A token is named by its path in `theme.json`: `colour.sage`, `duration.base`,
 * `legacy.root.brass`, `edges.torn.path`.
 */

export const THEME_FILE = 'src/data/ui/theme.json';
/** Where the page keeps its working copy in this browser. */
export const EDITED_THEME_KEY = 'fwt-editor-theme';

export type TokenKind = 'colour' | 'number' | 'text';
export interface Token {
  path: string;
  value: string | number;
  kind: TokenKind;
}

const HEX = /^#[0-9a-f]{6}$/i;

export const shippedTheme = (): Theme => structuredClone(SHIPPED_THEME);
export const themeText = (theme: Theme) => formatJson(theme);
export { themeProblems };

type Tree = { [key: string]: Tree | string | number };
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v);

function kindOf(value: string | number): TokenKind {
  if (typeof value === 'number') return 'number';
  return HEX.test(value) ? 'colour' : 'text';
}

/** Every token of the theme, in file order (the `about` line is not one). */
export function tokens(theme: Theme): Token[] {
  const out: Token[] = [];
  const walk = (tree: Tree, at: string) => {
    for (const [key, value] of Object.entries(tree)) {
      const path = at ? `${at}.${key}` : key;
      if (isTree(value)) walk(value, path);
      else if (path !== 'about') out.push({ path, value, kind: kindOf(value) });
    }
  };
  walk(theme as unknown as Tree, '');
  return out;
}

/** The token groups as the page lists them: `colour`, `type`… and `legacy.root`, `edges.torn`. */
export function groupOf(path: string): string {
  const parts = path.split('.');
  return parts.length > 2 ? parts.slice(0, 2).join('.') : parts[0]!;
}

export const findToken = (theme: Theme, path: string) => tokens(theme).find((t) => t.path === path);

/** Sets one token from typed text; a problem (and no change) when the text does not fit it. */
export function setToken(theme: Theme, path: string, text: string): string | null {
  const token = findToken(theme, path);
  if (!token) return `no token ${path} (npm run theme -- list)`;
  const value = text.trim();
  let next: string | number = value;
  if (token.kind === 'number') {
    next = Number(value);
    if (!value || !Number.isFinite(next)) return `${path} takes a number, not "${text}"`;
  } else if (/^(colour|chart)\./.test(path) && !HEX.test(value))
    return `${path} takes a #rrggbb colour, not "${text}"`;
  else if (!value) return `${path} cannot be empty`;
  const parts = path.split('.');
  const leaf = parts.pop()!;
  let tree = theme as unknown as Tree;
  for (const p of parts) tree = tree[p] as Tree;
  tree[leaf] = next;
  return null;
}

/**
 * A theme file read back (an export of the page, a file given to `import`): every group and
 * token of the shipped theme, each of the same kind. A problem when it is not one.
 */
export function parseTheme(text: string): Theme | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return `not JSON: ${(e as Error).message}`;
  }
  if (!isTree(data)) return 'not a theme: the file is not an object';
  for (const t of tokens(SHIPPED_THEME)) {
    let v: unknown = data;
    for (const p of t.path.split('.')) v = isTree(v) ? v[p] : undefined;
    if (typeof v !== typeof t.value) return `${t.path} is missing or not a ${typeof t.value}`;
  }
  return data as unknown as Theme;
}

/** Whether two themes write the same file. */
export const sameTheme = (a: Theme, b: Theme) => themeText(a) === themeText(b);
