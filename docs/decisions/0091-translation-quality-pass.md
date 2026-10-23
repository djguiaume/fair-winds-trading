# 0091. Translation quality pass: French grammar forms and sailor's vocabulary

**Status:** Implemented for review · 2026-10-23

## Context

Guillaume, a native French speaker, found parts of the French UI weird and asked for a review of
every translation, then for all fixes (review in
[docs/i18n/2026-10-23-translation-review.md](../i18n/2026-10-23-translation-review.md)). Keys were
complete (513 in both languages, placeholders matching); the problems were quality:

- Sentences built from pieces dropped bare names into French templates, which needs articles,
  plurals and agreement: "Portez Poisson à Saltmere", "2 Poisson fumé par-dessus bord",
  "Tempête au O !", "venus de une île lointaine". Colons ("produit : {good}") hid the gap and made
  lines robotic.
- Some sailing and trade words were wrong or landlubber: _fumerie_ (an opium den) for the
  smokehouse, _boussole_ for the wind indicator, _zigzaguez_ for tacking, Schooner and Fluyt left in
  English, _Cargo_ for the hauler line.
- Word-for-word calques of the English and inconsistent terms (_quai_ / _ponton_, _or_ / _pièces_,
  _nd_ / _nœuds_, _bateau_ / _navire_), and half the spaces before `! ? : ; %` were plain spaces.
- English had Title Case leftovers, two dev-speak lines in the difficulty picker, and "Headwind"
  for _in irons_.

## Decision

1. **In-sentence forms for goods and ships.** Each good gets `goodThe.*` ("le poisson" / "the
   fish") and `goodSome.*` ("du poisson" / "fish"), each ship class `shipThe.*` ("la goélette" /
   "the schooner"), and the compass gets `compassLong.*` ("à l'ouest" / "to the west"). Helpers
   `goodThe`, `goodSome` and `shipThe` in `src/i18n/index.ts` pick them. Templates that put a good
   or ship inside a sentence (tutorial, shipyard buttons, workshop and storm toasts) use them; lists,
   price boards and signs keep the plain name. Workshop names carry their own article ("un fumoir",
   "une scierie") so their gender never breaks the sentence. Strings that would need agreement with
   a capitalised level name are rephrased ("Nouveau rang pour Saltmere : Village !").
2. **Real French marine vocabulary**, since the audience is sailors first: _rose des vents_, _tirer
   des bords_, _abattez_, _vent debout_, _à l'abri_, _instruments de bord_, _réduire la toile_,
   _Goélette_, _Flûte_, _Transport_ / _Navire de guerre_ lines, _fumoir_, _atelier de taille de
   pierre_, _huile à lampe_, and Beaufort names for the wind force (petite brise, jolie brise,
   bonne brise, vent frais, matching the 7 / 11 / 15 / 19 kn thresholds). One word per thing:
   _quai_, _or_ (pièces stays in Kids mode), _nd_, _navire_ in Captain mode, _zone de vent debout_.
3. **French typography**: a no-break space (U+00A0) before `! ? : ; %`, enforced by a test.
4. **English**: sentence case everywhere (Kids mode included), "In irons", "Drying bank",
   "Standard" difficulty wording, "Need {n} more" instead of "Need {n}g".

Taste calls made without asking, easy to revert one string at a time: tagline "Jouez avec le
vent. Livrez la marchandise.", _rose des vents_ rather than _girouette_, _Heu_ kept for the hoy,
_Vaisseau des Indes_ kept for the indiaman.

## Consequences

- A new language must also fill the in-sentence keys; the i18n test checks every good and ship has
  them. Plurals are still avoided by writing quantities as "{good} × {n}" in French.
- New French strings must use U+00A0 before high punctuation or the test fails.
- Players see different French wording on screens they know; saves are unaffected.
