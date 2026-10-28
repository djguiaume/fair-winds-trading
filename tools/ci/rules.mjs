/* global process, console, URL */
// PR rule checks (decision 0153 spirit: a workflow instead of a thread checking by hand):
// code files past ~400 lines that grew, big JSON, oversized images, and a missing "Fixes #N".
// Limits live in .github/rules.json. `node tools/ci/rules.mjs` reads BASE_SHA and PR_BODY.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const IMAGE_TYPES = ['.png', '.jpg', '.jpeg'];

/** Width in pixels of a PNG or JPEG, or null when the header is not understood. */
export function imageWidth(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return buf.readUInt32BE(16);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    // Start-of-frame markers (not DHT, JPG, DAC) hold the size.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return buf.readUInt16BE(i + 7);
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const countLines = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
const ignored = (path, rules) => rules.ignore.some((p) => path.startsWith(p));

/**
 * @param files changed files: { path, bytes, lines (text files), linesBefore, width (images) }
 * @returns {string[]} one message per problem
 */
export function findProblems(files, body, rules) {
  const problems = [];
  if (!new RegExp(rules.issueLink, 'i').test(body ?? ''))
    problems.push('PR body has no "Fixes #N" (or Closes/Resolves/Refs #N).');
  for (const f of files) {
    const ext = extname(f.path).toLowerCase();
    if (ignored(f.path, rules)) continue;
    if (
      rules.lineCheckedExtensions.includes(ext) &&
      f.lines > rules.maxLines &&
      f.lines > f.linesBefore
    )
      problems.push(
        `${f.path}: ${f.lines} lines (was ${f.linesBefore}); split it, limit ${rules.maxLines}.`,
      );
    if (ext === '.json' && f.bytes > rules.maxJsonKB * 1024)
      problems.push(
        `${f.path}: JSON of ${Math.round(f.bytes / 1024)} KB; split it, limit ${rules.maxJsonKB} KB.`,
      );
    if (IMAGE_TYPES.includes(ext) && f.bytes > rules.maxImageKB * 1024)
      problems.push(
        `${f.path}: image of ${Math.round(f.bytes / 1024)} KB, limit ${rules.maxImageKB} KB.`,
      );
    if (IMAGE_TYPES.includes(ext) && f.width > rules.maxImageWidth)
      problems.push(`${f.path}: image ${f.width}px wide, limit ${rules.maxImageWidth}px.`);
  }
  return problems;
}

const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

function describe(path, base) {
  const ext = extname(path).toLowerCase();
  const info = { path, bytes: statSync(path).size };
  if (IMAGE_TYPES.includes(ext)) info.width = imageWidth(readFileSync(path));
  else if (ext !== '.json') {
    info.lines = countLines(readFileSync(path, 'utf8'));
    try {
      info.linesBefore = countLines(git('show', `${base}:${path}`));
    } catch {
      info.linesBefore = 0;
    }
  }
  return info;
}

export function run() {
  const rules = JSON.parse(
    readFileSync(new URL('../../.github/rules.json', import.meta.url), 'utf8'),
  );
  const base = git('merge-base', process.env.BASE_SHA, 'HEAD').trim();
  const paths = git('diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`)
    .split('\n')
    .filter(Boolean);
  const problems = findProblems(
    paths.map((p) => describe(p, base)),
    process.env.PR_BODY,
    rules,
  );
  for (const p of problems) console.log(`::error::${p}`);
  console.log(problems.length ? `${problems.length} rule problem(s).` : 'PR rules: all good.');
  return problems.length ? 1 : 0;
}

if (process.argv[1]?.endsWith('rules.mjs')) process.exitCode = run();
