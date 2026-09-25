import type { Project as ApiProject } from './api';
import { getProject } from './api';
import type { Project } from './projectTypes';
import { encodeSheet } from './sheetCodec';
import { projectStorage } from '../utils/storage';

/** Keep the device copy until a newly created server project is read back intact. */
export async function claimAnonymousDraft(
  draftId: string,
  project: Project,
  name: string,
  create: (name: string, project: Project, newName: string) => Promise<ApiProject>,
): Promise<ApiProject> {
  // The editor can contain changes newer than the last autosave. Persist those
  // first, so a failed create/read-back cannot strand the only copy in a tab.
  await projectStorage.saveAnonymousDraft({
    id: draftId,
    project,
    lastModified: Date.now(),
  });
  const created = await create(name, project, name);
  const verified = await getProject(created.id);
  const expected = {
    name,
    files: project.files,
    assets: project.assets,
    tilemaps: project.tilemaps,
    sounds: project.sounds || {},
    sheet: project.sheet ? encodeSheet(project.sheet) : undefined,
    currentFile: project.currentFile || 'main.py',
  };
  const actual = {
    name: verified.name,
    files: verified.files,
    assets: verified.assets,
    tilemaps: verified.tilemaps,
    sounds: verified.sounds || {},
    sheet: verified.sheet || undefined,
    currentFile: verified.current_file,
  };
  if (verified.id !== created.id || verified.role !== 'owner'
    || !Number.isInteger(created.version) || !Number.isInteger(verified.version)
    || created.version !== verified.version || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('draftClaimVerificationFailed');
  }
  await projectStorage.deleteAnonymousDraft(draftId);
  return verified;
}
