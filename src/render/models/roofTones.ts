import * as THREE from 'three';
import { PALETTE } from '../../data/props';

const lightness = (hex: string) =>
  new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).l;

/** A lean-to roof: a step darker than the main roof, a step lighter when that one is dark. */
export function leanToTone(mainRoof: string): string {
  const { leanToShift, leanToDarkUnder } = PALETTE.roofTones;
  const hsl = new THREE.Color(mainRoof).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  const step = hsl.l < leanToDarkUnder ? leanToShift : -leanToShift;
  return `#${new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l + step, THREE.SRGBColorSpace).getHexString()}`;
}

/** The first chimney cap tone that stands out from the roof, else the one that stands out most. */
export function chimneyCapTone(roof: string): string {
  const { capContrast } = PALETTE.roofTones;
  const roofL = lightness(roof);
  const caps = ['chimneyCap', 'chimneyCapStone', 'chimneyCapMid'].map((name) => {
    const hex = PALETTE.colors[name] as string;
    return { hex, contrast: Math.abs(lightness(hex) - roofL) };
  });
  const clear = caps.find((cap) => cap.contrast >= capContrast);
  return (clear ?? caps.reduce((best, cap) => (cap.contrast > best.contrast ? cap : best))).hex;
}
