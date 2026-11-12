/**
 * Work cut into steps (issue #516): a generator that yields wherever it may pause until the next
 * frame, and returns its result at the end. The game runs a few steps a frame (`FrameJobs`), so a
 * town's rebuild never stalls the sea; tools, tests and the editor run it to its end at once.
 */
export type Steps<T> = Generator<void, T, void>;

/** Runs the work to its end now. */
export function finish<T>(steps: Steps<T>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/** Rows of a grid worked between two pauses: a few milliseconds on a phone for a town's field. */
export const ROWS_PER_STEP = 16;
