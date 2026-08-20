import { lazy, Suspense } from "react";
import type { TilemapData } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";

const TileEditor = lazy(() => import("./TileEditor"));
const KidSheetEditor = lazy(() => import("./KidSheetEditor"));

export type AssetEditorMode = 'tilemap' | 'sheet';

export type AssetEditorProps = {
  open: boolean;
  mode: AssetEditorMode | null;
  onClose: () => void;
  tilemapInitial?: { name: string };
  onSaveTilemap?: (name: string, data: TilemapData) => void;
  sheetInitialSprite?: string;
};

export default function AssetEditor({
  open, mode, onClose,
  tilemapInitial, onSaveTilemap,
  sheetInitialSprite,
}: AssetEditorProps) {
  const theme = useThemeStore((s) => s.theme);
  if (!open || !mode) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(1200px, 96vw)',
        height: 'min(720px, 92vh)',
        background: theme.surface,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 8,
        boxShadow: theme.shadowWindow,
        overflow: 'hidden',
        display: 'flex',
      }}>
        <ErrorBoundary
          label={mode === 'sheet' ? 'Sprite editor' : 'Tilemap editor'}
          resetKey={`${mode}:${tilemapInitial?.name ?? ''}:${sheetInitialSprite ?? ''}`}
        >
          <Suspense fallback={null}>
            {mode === 'sheet' && (
              <KidSheetEditor onClose={onClose} initialSprite={sheetInitialSprite} />
            )}
            {mode === 'tilemap' && (
              <TileEditor
                embedded
                open
                initialName={tilemapInitial?.name ?? ''}
                onClose={onClose}
                onSave={(name, data) => onSaveTilemap?.(name, data)}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
