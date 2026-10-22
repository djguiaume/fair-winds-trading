/**
 * Reads a QR code from the device camera (decision 0066). Uses the browser's own
 * `BarcodeDetector` where there is one (Chrome on Android); elsewhere (Safari, Firefox) loads
 * jsQR only when a scan starts, so the game itself stays small.
 */
type Detect = (video: HTMLVideoElement) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
};

/** Frames are shrunk to at most this many pixels across before decoding: fast on old tablets. */
const MAX_FRAME = 720;
const SCAN_EVERY_MS = 160;

async function nativeDetector(): Promise<Detect | null> {
  const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
    if (!formats.includes('qr_code')) return null;
    const detector = new BD({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function jsqrDetector(): Promise<Detect> {
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (video) => {
    const scale = Math.min(1, MAX_FRAME / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export function canScan(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export class QrScanner {
  private stream: MediaStream | null = null;
  private timer = 0;
  private running = false;

  constructor(private readonly video: HTMLVideoElement) {}

  /**
   * Opens the back camera and calls `onText` with every code it reads until that returns
   * true (accepted) or `stop()` is called. Rejects when there is no camera or no permission.
   */
  async start(onText: (text: string) => boolean): Promise<void> {
    this.stop();
    this.running = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    });
    if (!this.running) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    const detect = (await nativeDetector()) ?? (await jsqrDetector());
    const loop = async () => {
      if (!this.running) return;
      let text: string | null = null;
      try {
        if (this.video.readyState >= 2) text = await detect(this.video);
      } catch {
        // A frame that could not be read: try the next one.
      }
      if (!this.running) return;
      if (text && onText(text)) {
        this.stop();
        return;
      }
      this.timer = window.setTimeout(() => void loop(), SCAN_EVERY_MS);
    };
    void loop();
  }

  get isRunning() {
    return this.running;
  }

  stop(): void {
    this.running = false;
    window.clearTimeout(this.timer);
    if (this.stream) for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
    this.video.srcObject = null;
  }
}
