/** What `parseArgs` (lib.mjs) returns: flags by name, the rest in `_`. */
export type Args = Record<string, string | boolean | undefined> & { _: string[] };

export const num = (v: unknown) => (v === undefined || v === true ? undefined : Number(v));
/** "x,z x,z" or "x,z;x,z" (a third number per point for stairs). */
export const pointList = (v: unknown) =>
  typeof v === 'string'
    ? v
        .split(/[;\s]+/)
        .filter(Boolean)
        .map((p) => p.split(',').map(Number))
    : undefined;
export const pair = (v: unknown) => {
  const p = pointList(v)?.[0];
  return p ? ([p[0]!, p[1] ?? p[0]!] as [number, number]) : undefined;
};
