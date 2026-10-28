#!/bin/sh
# Writes css/fonts.css: Fraunces 700/900 inlined, so a mockup stylesheet works inside the game page.
src=../mockups/src/fonts
out=css/fonts.css
: > $out
for pair in 700:6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcUByjDg 900:6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib1603gg7S2nfgRYIcHhyjDg; do
  w=${pair%%:*}; f=${pair#*:}
  printf "@font-face{font-family:'Fraunces';font-weight:%s;src:url(data:font/ttf;base64,%s) format('truetype');}\n" "$w" "$(base64 -w0 $src/$f.ttf)" >> $out
done
