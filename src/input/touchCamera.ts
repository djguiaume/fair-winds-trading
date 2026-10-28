interface Finger {
  x: number;
  y: number;
}

/**
 * Two fingers on the sea turn and tilt the camera, and a pinch zooms (decision 0223). One finger
 * steers (`input.ts`); once a second finger lands, the touch belongs to the camera until every
 * finger has lifted, so it never steers halfway through a gesture.
 */
export class TouchCamera {
  private readonly fingers = new Map<number, Finger>();
  /** The touch is a camera gesture: two fingers came down. */
  active = false;
  /** The fingers' middle moved by (dx, dy) CSS pixels. */
  onTurn: (dx: number, dy: number) => void = () => {};
  /** The fingers spread apart (< 1, closer) or pinched together (> 1), like the mouse wheel. */
  onPinch: (factor: number) => void = () => {};

  /** A finger comes down; true when the touch is now a camera gesture. */
  down(id: number, x: number, y: number): boolean {
    this.fingers.set(id, { x, y });
    if (this.fingers.size >= 2) this.active = true;
    return this.active;
  }

  move(id: number, x: number, y: number) {
    const finger = this.fingers.get(id);
    if (!finger) return;
    const pair = this.active ? this.pair() : null;
    if (!pair) {
      finger.x = x;
      finger.y = y;
      return;
    }
    const [a, b] = pair;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const spread = Math.hypot(a.x - b.x, a.y - b.y);
    finger.x = x;
    finger.y = y;
    // Only the first two fingers count; a third one moving changes nothing.
    if (finger !== a && finger !== b) return;
    this.onTurn((a.x + b.x) / 2 - midX, (a.y + b.y) / 2 - midY);
    const now = Math.hypot(a.x - b.x, a.y - b.y);
    if (spread > 0 && now > 0 && now !== spread) this.onPinch(spread / now);
  }

  up(id: number) {
    this.fingers.delete(id);
    if (this.fingers.size === 0) this.active = false;
  }

  clear() {
    this.fingers.clear();
    this.active = false;
  }

  /** The first two fingers down, or null with fewer. */
  private pair(): [Finger, Finger] | null {
    let first: Finger | null = null;
    for (const f of this.fingers.values()) {
      if (!first) first = f;
      else return [first, f];
    }
    return null;
  }
}
