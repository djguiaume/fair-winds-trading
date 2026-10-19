# 0036. Port needs on the chart and a market overview

**Status:** Implementation for review · 2026-10-19

## Context

Players said they could not tell what each port needs, so they did not know where to sail.
The static "Wants X, Y" sign only shows when you are close to a port, and the harbour only shows
its own prices. Two options were on the table: show each port's top need next to its name on the
map, or add a market overview listing the buy and sell price of one good at every known port.

## Decision

Do both, in the sea chart (the at-sea planning screen from decision 0024), plus one hint in the
harbour:

1. **Top need under each port name on the chart:** "wants 🪨 28🪙", the good the port pays most for
   right now relative to that good's fair price, and its next-unit sale price. It is live: once you
   flood a port with its need, the price drops and its other wanted good takes over. Labels scale
   with the chart so they stay readable on a phone.
2. **Market prices board on the chart:** pick a good (Fish, Grain, Timber, Stone; it opens on what
   you carry most of) and see every port's next-unit buy and sell price, with the cheapest buy and
   the best sale highlighted, any open delivery order for that good, and "you are here". Tapping a
   port name sets a bearing to it.
3. **Harbour hint:** each good's card shows "Best sale elsewhere: Westholm 11 🪙" (Kids mode:
   "Sells best at Westholm"), so you know where to take what you just bought.

The top need answers "where should I go?" at a glance; the board answers "where do I buy and sell
this?" when planning a run. Both read the same live prices the harbour charges (`topNeed` and
`quoteAcross` in `src/sim/market.ts`).

## Consequences

- Every port counts as charted for now, so the board lists them all. When discovery lands (the
  locked shipwright ports of decisions 0030/0031), filter the list to discovered ports and consider
  showing prices as of your last visit instead of live ones, so scouting has value.
- Players have perfect price knowledge. That suits the short, friendly sandbox; if routes become too
  obvious, the "last visit" variant above is the lever.
- No save changes, no new render loop: the chart is still built only when opened.
