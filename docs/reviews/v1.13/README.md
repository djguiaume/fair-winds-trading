# v1.13 "Soft and rich": final review

One review at the end (Guillaume, 2026-11-16, validated "ok"; released as v1.13.466 in PR #640). Merge rule as v1.10 to v1.12.

Sheets: [surface detail](surface-detail/) (final-town.jpg, final-sail.jpg, variants, cost table), [boat up close and spray](boat-up-close/README.md), [boat previews](boat-previews/), [Free Sailing setup](630-free-setup-desktop-fr.jpg) (phone: [FR](630-free-setup-phone-fr.jpg), [EN](630-free-setup-phone-en.jpg), [before](630-free-setup-phone-before.jpg)), wind icon on phone ([before](wind-compass-before-phone.jpg), [after](wind-compass-after-phone.jpg)).

To listen to: follow cam sound (#555), desktop and phone (not judged by ear yet).

| Part | Issues | PRs |
|---|---|---|
| 1 Softness, detail, texture (ADR 0327) | #572 | #637 |
| 2 Boat up close and spray (option A, helmsman alone) | #553, #554 | #636 |
| 3 Real sea and sky in boat previews (ADR 0328) | #629 | #638 |
| 4 Free Sailing setup layout | #630 | #634 |
| 5 Follow cam sound (ADR 0325) | #555 | #635 |
| 6 Bug: wind icon over the compass on phone | #631 | #633 |

Budget: High dockingChase draw calls 58 to 61 (argued in PR #636); Medium and High sailingChase now at their limits. Open: #377 device round (add `?bench&quality=high` against `&off=surface`), #545, #531, #492.
