# HUD fonts

Barlow and Barlow Condensed by Jeremy Tribby (https://github.com/jpt/barlow), licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org). Copyright 2017 The Barlow Project Authors.

Subset to Latin (with French accents, arrows and the degree sign) and converted to WOFF2 with
fontTools from the Google Fonts TTFs in `docs/ui-refactor/mockups/src/fonts/`:

    pyftsubset <font>.ttf --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+25B2,U+25BC" \
      --flavor=woff2 --layout-features='kern,liga,tnum,lnum' --output-file=<name>.woff2

Used by `src/ui/sea-hud.css` (decision 0049).

Fraunces (700 and 900) by Undercase Type (https://github.com/undercasetype/Fraunces), SIL Open Font License 1.1,
copyright 2020 The Fraunces Project Authors. Same subset and command as above.
Used by `src/ui/theme.css` for titles and buttons (decision 0220). Its figures are old-style, which is part of the look.
