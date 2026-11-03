import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneDisplay } from './index';

describe('phoneDisplay', () => {
  it('spaces an Indian mobile the Indian way however it was kept', () => {
    expect(phoneDisplay('+919876543210')).toBe('+91 98765 43210');
    expect(phoneDisplay('9876543210')).toBe('+91 98765 43210');
    expect(phoneDisplay('+91 98765-43210')).toBe('+91 98765 43210');
  });
  it('leaves anything else as typed', () => {
    expect(phoneDisplay('+44 7700 900123')).toBe('+44 7700 900123');
    expect(phoneDisplay('080 2345 6789')).toBe('080 2345 6789');
    expect(phoneDisplay('98765 43210 ext 4')).toBe('98765 43210 ext 4');
    expect(phoneDisplay('  ')).toBe('');
  });
  it('is for the eye only: storing still uses normalizePhone', () => {
    expect(normalizePhone(phoneDisplay('+919876543210'))).toBe('+919876543210');
  });
});
