/**
 * `?perf` test aids (decision 0148), also on for `?bench`: `scale=0.7` draws fewer pixels,
 * `fps=30` caps the frame rate, `tilt=45` holds the turnable camera at that tilt to measure a
 * tilt limit (decision 0223; 0 leaves it free), `aa=1` multisamples the picture on every level
 * to measure what antialiasing costs on Low and Medium (decision 0154).
 */
export function perfOptions(search: string, benchMode: boolean) {
  const params = new URLSearchParams(search);
  const perfMode = params.has('perf') || benchMode;
  return {
    perfMode,
    perfScale: perfMode ? Math.min(1, Math.max(0.3, Number(params.get('scale')) || 1)) : 1,
    frameCap: perfMode ? Math.max(0, Number(params.get('fps')) || 0) : 0,
    tilt: perfMode ? Math.max(0, Number(params.get('tilt')) || 0) : 0,
    antialias: perfMode && params.get('aa') === '1',
  };
}
