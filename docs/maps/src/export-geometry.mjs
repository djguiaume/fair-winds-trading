import { registerHooks } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier, context.parentURL);
    if (!existsSync(fileURLToPath(url)) && existsSync(fileURLToPath(url)+'.ts')) return nextResolve(url.href+'.ts',context);
  }
  return nextResolve(specifier,context);
}});
const {buildHighlandIslands}=await import('../../../src/render/models/highlandIslands.ts');
const map=JSON.parse(readFileSync(new URL(`../../../src/data/${process.argv[3] ?? 'phase0-map.json'}`,import.meta.url),'utf8'));
const mesh=buildHighlandIslands(map,{shadows:false});
const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
writeFileSync(process.argv[2],JSON.stringify({map,positions:Array.from(geo.attributes.position.array),colors:Array.from(geo.attributes.color.array)}));
