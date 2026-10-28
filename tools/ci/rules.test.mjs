/* global Buffer */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findProblems, imageWidth } from './rules.mjs';

const rules = {
  maxLines: 400,
  lineCheckedExtensions: ['.ts'],
  maxJsonKB: 200,
  maxImageKB: 500,
  maxImageWidth: 1920,
  ignore: ['docs/art/'],
  issueLink: '(fixes|closes|resolves|refs)\\s+#\\d+',
};
const ok = 'Fixes #12';

test('a small change with an issue link passes', () => {
  assert.deepEqual(
    findProblems([{ path: 'src/a.ts', bytes: 10, lines: 50, linesBefore: 40 }], ok, rules),
    [],
  );
});
test('missing issue link is flagged', () => {
  assert.equal(findProblems([], 'no link', rules).length, 1);
});
test('a long file is flagged only when it grew', () => {
  const grew = { path: 'src/a.ts', bytes: 1, lines: 450, linesBefore: 440 };
  const shrank = { path: 'src/b.ts', bytes: 1, lines: 450, linesBefore: 500 };
  assert.equal(findProblems([grew, shrank], ok, rules).length, 1);
});
test('big json, big and wide images, ignored folders', () => {
  const files = [
    { path: 'src/data/x.json', bytes: 300 * 1024 },
    { path: 'docs/shot.png', bytes: 600 * 1024, width: 2400 },
    { path: 'docs/art/big.png', bytes: 600 * 1024, width: 2400 },
  ];
  assert.equal(findProblems(files, ok, rules).length, 3);
});
test('image width from PNG and JPEG headers', () => {
  const png = Buffer.alloc(32);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(1280, 16);
  const jpg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 3, 32, 4, 0, 3, 1, 0x22, 0, 2, 0x11, 1,
  ]);
  jpg.writeUInt16BE(1024, 7);
  assert.equal(imageWidth(png), 1280);
  assert.equal(imageWidth(jpg), 1024);
});
