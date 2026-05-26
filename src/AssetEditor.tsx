/**
 * AssetEditor — single unified launch point for the pixel sprite editor,
 * animation editor, and tilemap editor.
 *
 * - For an existing asset, the caller passes a concrete `mode` and the matching
 *   `initial*` payload.
 * - For a brand-new asset, the caller passes `mode='new'` and AssetEditor
 *   shows a small type picker that resolves to one of the concrete modes.
 *
 * The editor bodies (PixelEditor, TileEditor) are rendered with `embedded`
 * so they skip their own backdrop and inherit AssetEditor's dark modal frame.
 */
import { useEffect, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import type { AnimationData, TilemapData } from "./state/IdeState";
import { useThemeStore, type Theme } from "./state/useTheme";

const PixelEditor = lazy(() => import("./PixelEditor"));
const TileEditor = lazy(() => import("./TileEditor"));
const SheetEditor = lazy(() => import("./SheetEditor"));

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Type-picker accent shades. The first two reuse theme tokens; purple is a
// neutral third color that contrasts in all themes.
function pickerColors(theme: Theme) {
  return {
    sprite:   theme.accent,
    anim:     theme.tabDirty,
    tilemap:  '#9b6dff',
  };
}

export type AssetEditorMode = 'new' | 'sprite' | 'sprite-anim' | 'tilemap' | 'sheet';

export type AssetEditorProps = {
  open: boolean;
  mode: AssetEditorMode | null;
  onClose: () => void;

  // Sprite (single PNG)
  spriteInitial?: { name: string; url?: string };
  onSaveSprite?: (name: string, dataUrl: string) => void;

  // Sprite animation (PNG frames)
  animationInitial?: { name: string; data?: AnimationData };
  onSaveAnimation?: (name: string, data: AnimationData) => void;

  // Tilemap
  tilemapInitial?: { name: string };
  onSaveTilemap?: (name: string, data: TilemapData) => void;
};

type PickerOption = {
  id: Exclude<AssetEditorMode, 'new'>;
  label: string;
  hint: string;
  colorKey: 'sprite' | 'anim' | 'tilemap';
  icon: ReactNode;
};

const PICKER_OPTIONS: PickerOption[] = [
  {
    id: 'sprite',
    label: 'Pixel sprite',
    hint: 'A static 16×16 or 32×32 PNG. Use for characters, props, icons.',
    colorKey: 'sprite',
    icon: (
      <svg width={28} height={28} viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1"/>
        <rect x="5" y="5" width="2" height="2" fill="currentColor"/>
        <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
        <path d="M5 10h6" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'sprite-anim',
    label: 'Animation',
    hint: 'Multi-frame pixel sprite with FPS. Use for walks, idles, effects.',
    colorKey: 'anim',
    icon: (
      <svg width={28} height={28} viewBox="0 0 16 16">
        <rect x="1" y="3" width="4" height="10" stroke="currentColor" strokeWidth="1.2" fill="none" rx="0.5"/>
        <rect x="6" y="3" width="4" height="10" stroke="currentColor" strokeWidth="1.2" fill="none" rx="0.5"/>
        <rect x="11" y="3" width="4" height="10" stroke="currentColor" strokeWidth="1.2" fill="none" rx="0.5"/>
      </svg>
    ),
  },
  {
    id: 'tilemap',
    label: 'Tilemap',
    hint: 'A level grid built from existing sprites. Layers + areas.',
    colorKey: 'tilemap',
    icon: (
      <svg width={28} height={28} viewBox="0 0 16 16">
        <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
];

function TypePicker({ onPick, onCancel }: { onPick: (m: PickerOption['id']) => void; onCancel: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = useMemo(() => pickerColors(theme), [theme]);
  return (
    <div style={{
      width: 'min(640px, 92vw)',
      background: theme.surfacePanel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 8,
      boxShadow: theme.shadowWindow,
      padding: 28,
      color: theme.panelTxt,
      fontFamily: theme.fontUI,
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: 800, fontSize: 16, color: theme.accent, letterSpacing: -0.5,
        }}>
          pi<sup style={{ fontSize: '0.6em', verticalAlign: '0.1em' }}>3</sup>
        </span>
        <button onClick={onCancel} style={{
          background: 'transparent', border: `1px solid ${theme.panelBorder}`,
          color: theme.panelTxtMute, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
        }}>Cancel</button>
      </div>
      <h2 style={{
        fontSize: 16, fontWeight: 600, color: theme.panelTxt, marginBottom: 4,
      }}>New asset</h2>
      <p style={{ fontSize: 11, color: theme.panelTxtMute, marginBottom: 18 }}>
        Pick what you want to make. You can change details after.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {PICKER_OPTIONS.map((opt) => {
          const c = colors[opt.colorKey];
          return (
            <button
              key={opt.id}
              onClick={() => onPick(opt.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                padding: 14, borderRadius: 8,
                background: theme.chip,
                border: `1px solid ${theme.panelBorder}`,
                color: theme.panelTxt,
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color .1s, background .1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = c;
                e.currentTarget.style.background = hexToRgba(c, 0.08);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.panelBorder;
                e.currentTarget.style.background = theme.chip;
              }}>
              <div style={{
                width: 44, height: 44, borderRadius: 8,
                background: hexToRgba(c, 0.11),
                border: `1px solid ${hexToRgba(c, 0.33)}`,
                color: c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {opt.icon}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.panelTxt }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: theme.panelTxtMute, lineHeight: 1.4 }}>{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AssetEditor(props: AssetEditorProps) {
  const {
    open, mode, onClose,
    spriteInitial, onSaveSprite,
    animationInitial, onSaveAnimation,
    tilemapInitial, onSaveTilemap,
  } = props;
  const theme = useThemeStore((s) => s.theme);

  // Tracks the resolved mode after the user picks from `mode='new'`.
  const [pickedMode, setPickedMode] = useState<PickerOption['id'] | null>(null);

  // Reset picker each time the dialog opens.
  useEffect(() => {
    if (!open) setPickedMode(null);
  }, [open]);

  if (!open || !mode) return null;

  const effectiveMode: AssetEditorMode = mode === 'new' ? (pickedMode ?? 'new') : mode;

  // ── Picker view ──────────────────────────────────────────────────────────
  if (effectiveMode === 'new') {
    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
      }}>
        <TypePicker onPick={setPickedMode} onCancel={onClose}/>
      </div>
    );
  }

  // ── Editor view ──────────────────────────────────────────────────────────
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1200px, 96vw)',
          height: 'min(720px, 92vh)',
          background: theme.surface,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 8,
          boxShadow: theme.shadowWindow,
          overflow: 'hidden',
          display: 'flex',
        }}>
        <Suspense fallback={null}>
          {effectiveMode === 'sheet' && (
            <SheetEditor onClose={onClose} />
          )}
          {(effectiveMode === 'sprite' || effectiveMode === 'sprite-anim') && (
            <PixelEditor
              embedded
              open
              size={32}
              initialName={
                effectiveMode === 'sprite'
                  ? spriteInitial?.name ?? ''
                  : animationInitial?.name ?? ''
              }
              initialDataUrl={effectiveMode === 'sprite' ? spriteInitial?.url : undefined}
              initialAnimation={effectiveMode === 'sprite-anim' ? animationInitial?.data : undefined}
              onClose={onClose}
              onSave={(name, dataUrl) => onSaveSprite?.(name, dataUrl)}
              onSaveAnimation={
                effectiveMode === 'sprite-anim'
                  ? (name, data) => onSaveAnimation?.(name, data)
                  : undefined
              }
            />
          )}
          {effectiveMode === 'tilemap' && (
            <TileEditor
              embedded
              open
              initialName={tilemapInitial?.name ?? ''}
              onClose={onClose}
              onSave={(name, data) => onSaveTilemap?.(name, data)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
