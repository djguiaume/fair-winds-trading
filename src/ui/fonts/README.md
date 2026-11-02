# Fonts

Subset to Latin (with French accents, arrows and the degree sign) and converted to WOFF2 with
fontTools from the Google Fonts TTFs:

    pyftsubset <font>.ttf --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+25B2,U+25BC" \
      --flavor=woff2 --layout-features='kern,liga,tnum,lnum' --output-file=<name>.woff2

IM Fell English (regular and italic) by Igino Marini (https://iginomarini.com/fell/), SIL Open Font License 1.1,
copyright 2010 The IM FELL Types Project Authors. Only the regular weight exists (there is no 700);
the wordmark and titles use it as drawn, the italic is for the banderole and taglines. Used for titles, the wordmark and port names (`src/ui/fonts.css`).

Alegreya Sans (400, 500 and 700) by Juan Pablo del Peral, Huerta Tipográfica
(https://github.com/huertatipografica/Alegreya-Sans), SIL Open Font License 1.1, copyright 2013 The Alegreya Sans
Project Authors. The family has no 600, so 500 is the middle weight. Used for the UI and the numbers.
Same subset and command as above (`--layout-features='kern,liga,tnum,lnum'`), `font-display: swap`.

Barlow, Barlow Condensed and Fraunces (style E) were removed in v1.5 (decision 0268); the editors use system fonts.
