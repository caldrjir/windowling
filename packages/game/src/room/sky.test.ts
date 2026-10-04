import { describe, expect, it } from 'vitest';
import { daylight, skyColor } from './sky.ts';

describe('sky', () => {
	it('is dark at 3 AM and bright at noon', () => {
		expect(daylight(3)).toBeLessThan(0.2);
		expect(daylight(12)).toBeGreaterThan(0.8);
	});

	it('wraps around midnight', () => {
		expect(skyColor(24)).toEqual(skyColor(0));
		expect(skyColor(-1)).toEqual(skyColor(23));
	});

	it('returns channels in range', () => {
		for (let h = 0; h < 24; h += 0.5) {
			for (const c of skyColor(h)) {
				expect(c).toBeGreaterThanOrEqual(0);
				expect(c).toBeLessThanOrEqual(1);
			}
		}
	});
});
