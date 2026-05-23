import { formatHandle, userLabel } from '../../src/utils/userDisplay';

describe('userDisplay', () => {
  describe('formatHandle', () => {
    it('prefixes with @ when handle present', () => {
      expect(formatHandle('redfox42')).toBe('@redfox42');
    });

    it('returns null when handle is null/undefined/empty', () => {
      expect(formatHandle(null)).toBeNull();
      expect(formatHandle(undefined)).toBeNull();
      expect(formatHandle('')).toBeNull();
    });
  });

  describe('userLabel', () => {
    it('prefers @handle over name when both present', () => {
      expect(userLabel('Alice Smith', 'alice42')).toBe('@alice42');
    });

    it('falls back to name when handle is null', () => {
      expect(userLabel('Alice Smith', null)).toBe('Alice Smith');
    });

    it('falls back to name when handle is undefined', () => {
      expect(userLabel('Alice Smith', undefined)).toBe('Alice Smith');
    });

    it('falls back to name when handle is empty string', () => {
      expect(userLabel('Alice Smith', '')).toBe('Alice Smith');
    });
  });
});
