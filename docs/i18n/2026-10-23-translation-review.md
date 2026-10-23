# Translation quality review (2026-10-23)

Review of every UI string on `main` at 19ca863, asked for by Guillaume (native French speaker,
who found parts of the French weird). The full review with per-string tables was shared as a doc in
the project thread; this file keeps the findings in the repo. All fixes are applied in
[decision 0091](../decisions/0091-translation-quality-pass.md).

## Coverage

Two languages: English (`src/i18n/en.ts`, source) and French (`src/i18n/fr.ts`). Both had the same
513 keys, every `{placeholder}` matched, and no player text was hard-coded outside the dictionaries
(only place names, `Esc` and `N ↑`).

## French findings

1. **Sentences built from pieces broke grammar**: no articles before goods ("Portez Poisson à
   Saltmere"), no plurals ("2 Poisson fumé par-dessus bord"), "venus de une île lointaine",
   "Tempête au O !", "Accostez à le port choisi", agreement with feminine goods ("Huile de lampe,
   recherché"), and colon workarounds ("produit : {good}", "sa nouvelle scierie produit :
   Planches !").
2. **Wrong or landlubber sailing words**: _fumerie_ (opium den) → _fumoir_; _taillerie_ (gems) →
   _atelier de taille de pierre_; _boussole_ → _girouette_; _zigzaguez_ → _tirez des bords_;
   _écartez-vous du vent_ → _abattez_; _Face au vent_ → _Vent debout_; _angle mort_ → _zone de vent
   debout_; _abri_ → _à l'abri_; _Loch à la mer_ → _Instruments de bord_; Schooner → _Goélette_;
   Fluyt → _Flûte_; line _Cargo_ → _Transport_, _Guerre_ → _Navire de guerre_; _Huile de lampe_ →
   _Huile à lampe_; wind forces Léger/Brise/Frais/Fort → Beaufort names (petite brise, jolie brise,
   bonne brise, vent frais).
3. **Calques of the English**: "Lisez le vent ou payez-le", "Tel que conçu", "Prix et commandes tels
   que réglés", "De courts conseils, posés sur…", "Qui arrive", "Navigué", "Fabrique beaucoup de :",
   "Tourner le vent de 45°", "Vue entière".
4. **Inconsistent terms**: _quai_ / _ponton_, _or_ / _pièces_, _nd_ / _nœuds_, _bateau_ / _navire_,
   _bordés_ / _bois renforcé_.
5. **Typography**: 43 plain spaces before `! ? : ; %` next to 49 no-break ones.

## English findings

"Headwind" for _in irons_; "Points: 45° off wind"; "Exposed bank"; bare "lee"; dev-speak "as
tuned" / "As designed"; "Gales under full sail throw cargo"; capitalised goods mid-sentence;
"on every port"; "accel"; "Need {n}g"; Title Case leftovers (Captain's Gold, Vessel Lineup, most
Kids mode strings); "harbour" and "port" mixed in the tutorial; "Sell your your cargo" when the
tutorial had no good yet.
