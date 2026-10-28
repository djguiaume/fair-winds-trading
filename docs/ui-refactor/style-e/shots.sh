#!/bin/sh
# usage: sh shots.sh <theme> <sizes>   -> /tmp/claude-0/s/<theme>/ (day set) and /tmp/claude-0/s/<theme>-night/
t=$1; sizes=${2:-desktop}
st="docs/ui-refactor/style-e/css/fonts.css,docs/ui-refactor/style-e/css/$t.css"
day=/tmp/claude-0/s/$t.json; night=/tmp/claude-0/s/$t-night.json
nightcss=night-dim; case $t in e-*) nightcss=e-night;; esac
nst="$st,docs/ui-refactor/style-e/css/$nightcss.css"
cat > $day <<J
[
 {"name":"1-menu","menu":true,"style":"$st"},
 {"name":"2-level","menu":true,"click":"#menu-play","style":"$st"},
 {"name":"3-settings","menu":true,"click":"#menu-settings","style":"$st"},
 {"name":"4-sea","sail":true,"style":"$st"},
 {"name":"5-market","port":"saltmere","style":"$st"},
 {"name":"6-quay","port":"saltmere","tab":"quay","style":"$st"},
 {"name":"7-chart","chart":true,"style":"$st"},
 {"name":"8-pad","port":"saltmere","pad":"down:150,down:150","style":"$st"},
 {"name":"9-quest","quest":"saltmere-letter:chart","cards":true,"style":"$st"}
]
J
cat > $night <<J
[
 {"name":"4-sea","sail":true,"night":true,"style":"$nst"},
 {"name":"5-market","port":"saltmere","night":true,"style":"$nst"}
]
J
cd /home/user/fair-winds-trading
npm run -s shots -- --list $day --sizes $sizes --out /tmp/claude-0/s/$t 2>&1 | tail -3
npm run -s shots -- --list $night --sizes $sizes --out /tmp/claude-0/s/$t-night 2>&1 | tail -3
