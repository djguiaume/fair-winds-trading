import { describe, expect, it } from 'vitest';
import { padLogHeader } from '../src/ui/padLog';

describe('?padlog header (#494)', () => {
  it('says whether TV mode is on, what Edge does with the pad and the platform', () => {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
    expect(padLogHeader(true, { userAgent, gamepadInputEmulation: 'gamepad' })).toBe(
      'tv on · emulation gamepad · Windows NT 10.0; Win64; x64; Xbox; Xbox Series X',
    );
    expect(padLogHeader(false, { userAgent: 'odd browser' })).toBe(
      'tv off · emulation none · odd browser',
    );
  });
});
