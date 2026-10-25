import { describe, expect, it } from 'vitest';

declare const __APP_VERSION__: string;
declare const __BUILD_REVISION__: string;

describe('app version (decision 0042)', () => {
  it('is 0.<phase>.<merges on main>, or <major>.<update>.<merges> since 1.0 (decision 0219)', () => {
    expect(__APP_VERSION__).toMatch(/^(0\.[1-9]\d*|[1-9]\d*\.\d+)\.[1-9]\d*$/);
  });

  it('keeps the commit code beside it', () => {
    expect(__BUILD_REVISION__).toMatch(/^[0-9a-f]{7,}$/);
  });
});
