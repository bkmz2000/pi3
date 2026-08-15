import type { CSSProperties } from 'react';
import type { Theme } from '../../state/useTheme';

export const inputStyle = (theme: Theme): CSSProperties => ({
  width: '100%', boxSizing: 'border-box',
  background: theme.surface, border: `1px solid ${theme.panelBorder}`,
  borderRadius: 6, padding: '8px 10px',
  color: theme.panelTxt, fontSize: 13,
  fontFamily: theme.fontUI,
  outline: 'none',
});

export const btnPrimary = (theme: Theme, acting = false): CSSProperties => ({
  all: 'unset', cursor: 'pointer',
  padding: '7px 16px', borderRadius: 6,
  background: theme.primaryBg, color: theme.primaryTxt,
  fontSize: 13, fontWeight: 600,
  opacity: acting ? 0.6 : 1,
});

export const btnSecondary = (theme: Theme, acting = false): CSSProperties => ({
  all: 'unset', cursor: 'pointer',
  padding: '7px 14px', borderRadius: 6,
  background: theme.railActiveBg, color: theme.panelTxt,
  fontSize: 13,
  opacity: acting ? 0.6 : 1,
});
