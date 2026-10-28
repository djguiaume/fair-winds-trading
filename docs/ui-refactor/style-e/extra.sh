#!/bin/sh
# Extra review shots for the refined direction: component strip, rules sheet, pennant New voyage.
base=docs/ui-refactor/style-e
st="$base/css/fonts.css,$base/css/e-refined.css"
pst="$base/css/fonts.css,$base/css/e-refined-pennants.css"
cat > /tmp/claude-0/s/extra.json <<J
[
 {"name":"strip","menu":true,"style":"$st","script":"$base/js/strip.js"},
 {"name":"rules","menu":true,"style":"$st","script":"$base/js/rules.js"},
 {"name":"2-level-pennants","menu":true,"click":"#menu-play","style":"$pst"}
]
J
cd /home/user/fair-winds-trading
npm run -s shots -- --list /tmp/claude-0/s/extra.json --sizes desktop,portrait --out /tmp/claude-0/s/e-extra 2>&1 | tail -2
