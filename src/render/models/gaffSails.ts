import * as THREE from 'three';
import type { BoatLook } from './boatLook';
import { mergeAll } from './geometry';
import { cloth, type ClothDress } from './sailCloth';
import { V, spar, type MastSpot, type RefinedRig } from './refinedRig';

/** One gaff sail on its pivot at the gooseneck, with the points its lift and sheet run to. */
export interface GaffSail {
  pivot: THREE.Group;
  sail: THREE.Mesh;
  peak: THREE.Vector3;
  clew: THREE.Vector3;
  mastTop: THREE.Vector3;
  sheetAnchor: THREE.Vector3;
}

/** One gaff mast's sail: names, spars and where it is set. */
export interface GaffPlan {
  name: string;
  /** Mast station and height. */
  z: number;
  height: number;
  /** The mast's foot height, its masthead, the gooseneck's height and the sheet's deck anchor. */
  base: number;
  gooseneck: number;
  sheetAnchor: THREE.Vector3;
  boom: number;
  gaff: number;
  /** Carries the sails-3 topsail. */
  topsail: boolean;
  /** The mesh name of its boom and gaff. */
  sparsName: string;
  sails: number;
  look: BoatLook;
  dress: ClothDress;
  /** The topsail's dress. */
  topDress: ClothDress;
}

/**
 * A gaff sail on its own gooseneck pivot, with its gaff lift and working sheet. The luff stays on
 * the mast; the pivot turns with the boom and scales down the mast to reef.
 */
export function buildGaffSail(
  plan: GaffPlan,
  mesh: (g: THREE.BufferGeometry, kind: 'wood' | 'canvas', name: string) => THREE.Mesh,
) {
  const pivot = new THREE.Group();
  pivot.name = `${plan.name}Pivot`;
  pivot.position.set(0, plan.gooseneck, plan.z);
  const throat = V(0, plan.height * 0.47, 0);
  const peak = V(0, plan.height * 0.69, -plan.gaff);
  const clew = V(0, 0, -plan.boom);
  pivot.add(mesh(mergeAll([spar(V(0, 0, 0), clew), spar(throat, peak)]), 'wood', plan.sparsName));
  const sails = [
    cloth(V(0, 0, 0), clew, throat, peak, plan.sails, 0.32, plan.look, 6, 6, plan.dress),
  ];
  const topsail = plan.topsail && plan.sails >= 3;
  if (topsail) {
    const top = V(0, plan.height - 0.85, 0);
    sails.push(cloth(throat, peak, top, top, plan.sails, 0.13, plan.look, 6, 6, plan.topDress));
  }
  const sail = mesh(mergeAll(sails), 'canvas', plan.name);
  pivot.add(sail);
  const gaff: GaffSail = {
    pivot,
    sail,
    peak,
    clew,
    mastTop: V(0, plan.base + plan.height, plan.z),
    sheetAnchor: plan.sheetAnchor,
  };
  return { gaff, topsail };
}

/** Where a ship's gaff masts stand, the decks they stand on, and how their sails are dressed. */
export interface GaffLayout {
  main: MastSpot;
  fore?: MastSpot;
  mizzen?: MastSpot;
  deckAt: (z: number) => number;
  standAt: (z: number) => number;
  sails: number;
  look: BoatLook;
  /** The mainsail's dress (her logo or racing number, her damage) and every other sail's. */
  mainDress: ClothDress;
  dress: ClothDress;
}

/**
 * The gaff sails of a class: the main (or the fluyt's lone mizzen), then a foresail and a mizzen
 * when she has those masts. The shorter foresail clears the taller aft mainmast.
 */
export function gaffPlans(rig: RefinedRig, ship: GaffLayout): GaffPlan[] {
  const { main, fore, mizzen, deckAt } = ship;
  const L = rig.length;
  const shared = { sails: ship.sails, look: ship.look, topDress: ship.dress };
  const anchorAt = (z: number) => V(0, ship.standAt(z) + 0.12, z);
  const gooseneck = (m: MastSpot) => m.base + (rig.gooseneck ?? 0.7);
  const plans: GaffPlan[] = [
    {
      ...shared,
      ...main,
      name: rig.mainName ?? 'Mainsail',
      sparsName: rig.mainName === 'Mizzen' ? 'MizzenBoomAndGaff' : 'BoomAndGaff',
      gooseneck: rig.sternLayout ? deckAt(main.z) + rig.sternLayout.foot : gooseneck(main),
      sheetAnchor: rig.sternLayout
        ? V(0, rig.sternLayout.sheet.y, rig.sternLayout.sheet.z)
        : anchorAt(rig.mizzen ? -2.2 : rig.castle ? -L * 0.47 : -L * 0.4),
      boom: rig.boom,
      gaff: rig.gaff,
      topsail: rig.mainTopsail ?? true,
      dress: ship.mainDress,
    },
  ];
  if (fore && rig.foremast)
    plans.push({
      ...shared,
      ...fore,
      name: 'Foresail',
      sparsName: 'ForeBoomAndGaff',
      gooseneck: gooseneck(fore),
      sheetAnchor: anchorAt(rig.mizzen ? 0.5 : -0.9),
      boom: rig.foremast.boom,
      gaff: rig.foremast.gaff,
      topsail: false,
      dress: ship.dress,
    });
  if (mizzen && rig.mizzen)
    plans.push({
      ...shared,
      ...mizzen,
      name: 'Mizzen',
      sparsName: 'MizzenBoomAndGaff',
      gooseneck: gooseneck(mizzen),
      sheetAnchor: anchorAt(-L * 0.46),
      boom: rig.mizzen.boom,
      gaff: rig.mizzen.gaff,
      topsail: true,
      dress: ship.dress,
    });
  return plans;
}
