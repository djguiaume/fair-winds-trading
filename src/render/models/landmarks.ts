import * as THREE from 'three';
import type { LandmarkKind } from '../../sim/map';
import { glowing, paint } from './geometry';

type Parts = THREE.BufferGeometry[];
const cream = '#f4ede0',
  rock = '#c2ad8c',
  wood = '#9b6b3d',
  dark = '#6b4a2a';

/** Small recognisable silhouettes, built from the same matte low-poly palette as B2 islands. */
export function landmarkParts(kind: LandmarkKind, scale = 1, variant = 0): Parts {
  const out: Parts = [];
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    rot = 0,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d).rotateY(rot).translate(x, y, z);
    out.push(paint(g, color));
  };
  const cylinder = (rt: number, rb: number, h: number, y: number, color: string, n = 8) => {
    out.push(paint(new THREE.CylinderGeometry(rt, rb, h, n).translate(0, y, 0), color));
  };
  if (kind === 'lighthouse') {
    cylinder(1.3, 1.65, 0.5, 0.25, rock);
    cylinder(0.85, 1.05, 3.6, 2.3, cream);
    cylinder(0.89, 0.94, 0.6, 2.5, '#c8603e');
    cylinder(1.15, 1.15, 0.25, 4.25, dark);
    for (const x of [-0.65, 0.65])
      for (const z of [-0.65, 0.65]) box(0.13, 1, 0.13, x, 4.8, z, wood);
    box(0.6, 0.7, 0.6, 0, 4.8, 0, '#ffe3a0');
    glowing(out[out.length - 1]!); // the lamp room lights up at night
    cylinder(0, 1.3, 0.9, 5.75, '#3f74a8');
    box(0.45, 0.9, 0.12, 0, 0.95, 1.0, dark);
  } else if (kind === 'ruins') {
    box(4.4, 0.35, 3.2, 0, 0.175, 0, rock);
    for (const x of [-1.5, 1.5]) {
      out.push(paint(new THREE.CylinderGeometry(0.4, 0.5, 2.8, 6).translate(x, 1.6, 0), cream));
      box(1, 0.3, 1, x, 3.1, 0, rock);
    }
    box(3.9, 0.6, 0.95, 0, 3.55, 0, cream);
    box(0.6, 1.2, 2.5, -1.8, 0.9, -0.8, rock);
    box(1.2, 0.55, 0.8, 0.8, 0.6, -1.0, '#d6c4a4', 0.5);
    box(0.9, 0.4, 0.7, 1.9, 0.4, 1.0, rock, -0.5);
  } else if (kind === 'wreck') {
    // Broken hull ribs, a remaining keel and a snapped leaning mast; no intact sailing ship.
    box(0.45, 0.35, 6.0, 0, 0.35, 0, dark);
    for (let i = 0; i < 6; i++) {
      const z = -2.4 + i * 0.85;
      const w = 1.1 + Math.sin(((i + 1) / 7) * Math.PI) * 0.5;
      for (const side of [-1, 1]) {
        const rib = new THREE.BoxGeometry(0.22, 1.3, 0.25)
          .rotateZ(side * -0.45)
          .translate(side * w, 0.85, z);
        out.push(paint(rib, wood));
      }
    }
    box(0.24, 0.3, 5.5, 1.25, 1, 0, wood, 0.08);
    box(0.24, 0.3, 3.4, -1.2, 0.9, -0.6, wood, -0.1);
    const mast = new THREE.CylinderGeometry(0.14, 0.2, 3.4, 6)
      .rotateZ(0.7)
      .translate(-0.6, 1.5, 0.8);
    out.push(paint(mast, dark));
    box(1.8, 0.18, 0.5, 2.2, 0.2, 1.2, wood, 0.8);
  } else {
    // Variant (decision 0121): 2 a red lateral mark with a can top, 3 a green one with a cone.
    const mark = variant === 2 ? '#c23a2c' : variant === 3 ? '#3f8f5a' : '#c8603e';
    cylinder(1.1, 1.5, 0.45, 0.225, rock, 6);
    cylinder(0.25, 0.35, 3.7, 2.2, cream, 6);
    cylinder(0.28, 0.3, 0.65, 3.1, mark, 6);
    if (variant === 2) cylinder(0.62, 0.62, 1, 4.5, mark, 8);
    else cylinder(0, 0.8, 1, 4.5, mark, 6);
    box(1.9, 0.22, 0.2, 0, 3.4, 0, dark);
  }
  if (scale !== 1) for (const g of out) g.scale(scale, scale, scale);
  return out;
}
