/**
 * The idle fade (issue #441): a cluster that has shown the same thing for a while steps back to a
 * fainter ink, and comes back at once when what it shows changes. Pure, so it is tested alone.
 */
export class IdleFade {
  private shown = '';
  private quietSec = 0;
  faded = false;

  /**
   * `shown` sums up what the cluster shows now; after `afterSec` without a change it fades.
   * Returns true when the faded state flipped, so the caller writes the DOM only then.
   */
  update(dt: number, shown: string, afterSec: number): boolean {
    if (shown !== this.shown) {
      this.shown = shown;
      this.quietSec = 0;
    } else this.quietSec += dt;
    const faded = this.quietSec >= afterSec;
    if (faded === this.faded) return false;
    this.faded = faded;
    return true;
  }

  /** Something worth seeing happened that `shown` does not carry (a big turn). */
  wake(): void {
    this.quietSec = 0;
  }
}
