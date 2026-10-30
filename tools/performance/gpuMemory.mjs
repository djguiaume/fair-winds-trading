/* global window, WebGL2RenderingContext */
// Graphics memory a page allocates through WebGL 2 (decision 0246): every texture, renderbuffer
// and buffer it keeps, plus the canvas's own buffers. Browsers do not report it, and the Xbox's
// Edge crashed once Ultra went past its share, so `npm run perf` counts it from the calls.

/** Runs in the page before the game (`page.addInitScript`): wraps the calls that allocate. */
export function countGpuMemory() {
  const P = WebGL2RenderingContext.prototype;
  // Bytes per texel of the sized formats three.js uses; unsized RGBA/RGB go by their type.
  const SIZED = {
    0x8058: 4, // RGBA8
    0x8c43: 4, // SRGB8_ALPHA8
    0x881a: 8, // RGBA16F
    0x8814: 16, // RGBA32F
    0x8229: 1, // R8
    0x822b: 2, // RG8
    0x822d: 2, // R16F
    0x822f: 4, // RG16F
    0x822e: 4, // R32F
    0x8230: 8, // RG32F
    0x81a5: 2, // DEPTH_COMPONENT16
    0x81a6: 4, // DEPTH_COMPONENT24
    0x8cac: 4, // DEPTH_COMPONENT32F
    0x88f0: 4, // DEPTH24_STENCIL8
    0x1903: 1, // RED
    0x1909: 1, // LUMINANCE
    0x190a: 2, // LUMINANCE_ALPHA
  };
  const TYPE_BYTES = { 0x1406: 4, 0x140b: 2, 0x8d61: 2 }; // FLOAT, HALF_FLOAT, HALF_FLOAT_OES
  const texel = (format, type) =>
    (format === 0x1908 || format === 0x1907) && TYPE_BYTES[type]
      ? 4 * TYPE_BYTES[type]
      : (SIZED[format] ?? 4);
  const CUBE = 0x8513;
  const face = (target) => (target >= 0x8515 && target <= 0x851a ? CUBE : target);
  const memory = (window.__gpuMemory = {
    textures: new Map(),
    renderbuffers: new Map(),
    buffers: new Map(),
  });
  const bound = { unit: 0, textures: new Map(), renderbuffer: null, buffers: new Map() };
  const before = (name, spy) => {
    const original = P[name];
    P[name] = function (...args) {
      spy(...args);
      return original.apply(this, args);
    };
  };
  const setTexture = (target, part, bytes) => {
    const texture = bound.textures.get(`${bound.unit}:${face(target)}`);
    if (!texture) return;
    if (!memory.textures.has(texture)) memory.textures.set(texture, new Map());
    memory.textures.get(texture).set(part, bytes);
  };
  before('activeTexture', (unit) => (bound.unit = unit));
  before('bindTexture', (target, texture) =>
    bound.textures.set(`${bound.unit}:${target}`, texture),
  );
  before('bindRenderbuffer', (_, renderbuffer) => (bound.renderbuffer = renderbuffer));
  before('bindBuffer', (target, buffer) => bound.buffers.set(target, buffer));
  before('texImage2D', (target, level, format, a, b, c, d, type) => {
    // (target, level, format, width, height, border, format, type, …) or (…, format, type, image)
    const sized = typeof a === 'number' && typeof c === 'number';
    const [w, h, t] = sized ? [a, b, type] : [c?.width ?? 0, c?.height ?? 0, b];
    setTexture(target, `${target}:${level}`, w * h * texel(format, t));
  });
  before('texStorage2D', (target, levels, format, width, height) => {
    let bytes = 0;
    for (
      let l = 0, w = width, h = height;
      l < levels;
      l++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)
    )
      bytes += w * h * texel(format);
    setTexture(target, 'storage', bytes * (target === CUBE ? 6 : 1));
  });
  before('texStorage3D', (target, levels, format, w, h, depth) =>
    setTexture(target, 'storage', w * h * depth * texel(format)),
  );
  before('texImage3D', (target, level, format, w, h, depth, border, f, type) =>
    setTexture(target, `${target}:${level}`, w * h * depth * texel(format, type)),
  );
  before('deleteTexture', (texture) => memory.textures.delete(texture));
  const storage = (samples, format, w, h) =>
    bound.renderbuffer &&
    memory.renderbuffers.set(bound.renderbuffer, w * h * texel(format) * Math.max(1, samples));
  before('renderbufferStorage', (_, format, w, h) => storage(1, format, w, h));
  before('renderbufferStorageMultisample', (_, samples, format, w, h) =>
    storage(samples, format, w, h),
  );
  before('deleteRenderbuffer', (renderbuffer) => memory.renderbuffers.delete(renderbuffer));
  before('bufferData', (target, data) => {
    const buffer = bound.buffers.get(target);
    if (buffer)
      memory.buffers.set(buffer, typeof data === 'number' ? data : (data?.byteLength ?? 0));
  });
  before('deleteBuffer', (buffer) => memory.buffers.delete(buffer));
}

/** Runs in the page (`page.evaluate`): what is held now, in MB, with the canvas's buffers. */
export function readGpuMemory() {
  const { textures, renderbuffers, buffers } = window.__gpuMemory;
  const gl = window.fwt.view.renderer.getContext();
  const pixels = gl.drawingBufferWidth * gl.drawingBufferHeight;
  const { antialias } = gl.getContextAttributes();
  // Colour and depth, 4 bytes each, per sample; a multisampled canvas also keeps a resolved copy.
  const canvas = antialias ? pixels * 8 * 4 + pixels * 4 : pixels * 8;
  const sum = (values) => [...values].reduce((a, b) => a + b, 0);
  const texture = sum([...textures.values()].map((parts) => sum(parts.values())));
  const renderbuffer = sum(renderbuffers.values());
  const buffer = sum(buffers.values());
  const mb = (bytes) => Math.round(bytes / 1048576);
  return {
    totalMB: mb(canvas + texture + renderbuffer + buffer),
    canvasMB: mb(canvas),
    texturesMB: mb(texture),
    renderbuffersMB: mb(renderbuffer),
    buffersMB: mb(buffer),
  };
}
