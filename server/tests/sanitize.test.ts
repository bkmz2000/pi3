import { describe, it, expect } from '@jest/globals';
import { sanitizeText, InputTooLongError } from '../utils/sanitize.js';

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(undefined, { maxLen: 10, field: 'x' })).toBe('');
    expect(sanitizeText(null, { maxLen: 10, field: 'x' })).toBe('');
    expect(sanitizeText(42, { maxLen: 10, field: 'x' })).toBe('');
    expect(sanitizeText({}, { maxLen: 10, field: 'x' })).toBe('');
  });

  it('strips control chars but preserves \\t \\n \\r', () => {
    const raw = 'a\x00b\x01c\x1fd';
    expect(sanitizeText(raw, { maxLen: 100, field: 'x' })).toBe('abcd');
    const withWs = 'line1\nline2\ttab\rreturn';
    // Whitespace collapse turns all runs into single space, then trim.
    expect(sanitizeText(withWs, { maxLen: 100, field: 'x' })).toBe('line1 line2 tab return');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(sanitizeText('   hello   world   ', { maxLen: 100, field: 'x' })).toBe('hello world');
    expect(sanitizeText('a\n\n\nb', { maxLen: 100, field: 'x' })).toBe('a b');
  });

  it('throws InputTooLongError when the sanitized value exceeds maxLen', () => {
    expect(() => sanitizeText('x'.repeat(11), { maxLen: 10, field: 'name' }))
      .toThrow(InputTooLongError);
    try {
      sanitizeText('x'.repeat(11), { maxLen: 10, field: 'name' });
    } catch (e) {
      expect(e).toBeInstanceOf(InputTooLongError);
      expect((e as InputTooLongError).field).toBe('name');
      expect((e as InputTooLongError).maxLen).toBe(10);
      expect((e as InputTooLongError).message).toContain('name too long (max 10)');
    }
  });

  it('accepts input exactly at the boundary', () => {
    expect(sanitizeText('x'.repeat(10), { maxLen: 10, field: 'x' })).toBe('x'.repeat(10));
  });
});
