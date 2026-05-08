# Duplicate & Conflicting Code

## 1. Two `IconButton` components

| File | Props |
|------|-------|
| `src/IconButton.tsx` | `label, icon, onClick, active, disabled` |
| `src/components/IconButton.tsx` | `label, icon, onClick, active, disabled, expanded, controls, spin` |

`SideMenu.tsx` imports from `src/components/IconButton.tsx`. The old `src/IconButton.tsx` is unused and should be deleted. Having both will inevitably cause confusion.

## 2. Two `NewProjectDialog` components — completely different

| File | Used by | Storage target | Styling |
|------|---------|---------------|---------|
| `src/components/dialogs/NewProjectDialog.tsx` | `SideMenu.tsx` | IndexedDB | Dark (cyan) theme |
| `src/components/projects/NewProjectDialog.tsx` | `ProjectsPage.tsx` | REST API | Light theme + dark mode |

These do the same thing but connect to different backends and look different. If both are needed (offline vs online), they should at least share a common base or have consistent styling.

## 3. Asset data URL conversion in 3 places

The pattern of reading Blob → data URL via `FileReader` exists in:
- `storage.ts:exportProjectToZip` / `downloadProjectZip` (asset → blob conversion)
- `zip.ts:dataURLToBlob()` (data URL → blob for zip)
- `IdeState.ts:importProjectFromFile` (uploaded file → data URL)

This should be a shared utility.

## 4. `IdleState.assets` vs `Project.assets`

The `IdeState` type has its own `assets: Record<string, Blob>` field (line 204) completely separate from `project.assets: Record<string, string>`. The `IdeState.assets` field is initialized as `{}` and never used anywhere.
