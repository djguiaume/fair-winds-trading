#!/usr/bin/env bash
# Reads a CI log on stdin, prints only the lines that say what failed (at most 40), without
# colours or timestamps, so a thread reads a few lines instead of the whole log.
sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g; s/^[0-9T:.Z-]+ //' \
  | grep -E 'FAIL|AssertionError|Error:|error TS[0-9]+|✗|×|^\s*[0-9]+:[0-9]+\s+error|\[warn\]|::error|expected .* to' \
  | grep -vE 'npm (warn|notice)|Node.js v[0-9]' \
  | awk '!seen[$0]++' | head -40
