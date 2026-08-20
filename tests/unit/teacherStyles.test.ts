/**
 * teacher/styles.ts: shared style helpers for the teacher dashboard.
 * Pure functions — verify the theme tokens are wired and the acting
 * opacity flag is applied.
 */
import { inputStyle, btnPrimary, btnSecondary } from '../../src/components/teacher/styles';

const theme = {
  surface: '#111', panelBorder: '#333', panelTxt: '#eee', fontUI: 'sans-serif',
  primaryBg: '#0ea5e9', primaryTxt: '#fff', railActiveBg: '#222',
} as never;

describe('teacher styles', () => {
  test('inputStyle wires theme tokens', () => {
    const s = inputStyle(theme);
    expect(s.background).toBe('#111');
    expect(s.border).toContain('#333');
    expect(s.color).toBe('#eee');
    expect(s.width).toBe('100%');
  });

  test('btnPrimary applies acting opacity', () => {
    expect(btnPrimary(theme).opacity).toBe(1);
    expect(btnPrimary(theme, true).opacity).toBe(0.6);
    expect(btnPrimary(theme).background).toBe('#0ea5e9');
  });

  test('btnSecondary applies acting opacity', () => {
    expect(btnSecondary(theme).opacity).toBe(1);
    expect(btnSecondary(theme, true).opacity).toBe(0.6);
    expect(btnSecondary(theme).background).toBe('#222');
  });
});
