import { describe, expect, it } from 'vitest';
import { shiftMonthId } from './month';

describe('shiftMonthId', () => {
  it('moves forward within the same year', () => {
    expect(shiftMonthId('2026-03', 1)).toBe('2026-04');
  });

  it('moves backward within the same year', () => {
    expect(shiftMonthId('2026-03', -1)).toBe('2026-02');
  });

  it('rolls over into the next year', () => {
    expect(shiftMonthId('2026-12', 1)).toBe('2027-01');
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonthId('2026-01', -1)).toBe('2025-12');
  });

  it('is a no-op for a zero delta', () => {
    expect(shiftMonthId('2026-06', 0)).toBe('2026-06');
  });
});
