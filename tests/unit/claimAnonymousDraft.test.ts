import type { Project as ApiProject } from '../../src/state/api';
import type { Project } from '../../src/state/projectTypes';

jest.mock('../../src/state/api', () => ({ getProject: jest.fn() }));
jest.mock('../../src/utils/storage', () => ({
  projectStorage: {
    saveAnonymousDraft: jest.fn(),
    deleteAnonymousDraft: jest.fn(),
  },
}));

import { claimAnonymousDraft } from '../../src/state/claimAnonymousDraft';
import { getProject } from '../../src/state/api';
import { projectStorage } from '../../src/utils/storage';

const project: Project = {
  files: { 'main.py': 'print(42)' }, assets: { 'art.png': 'data:image/png;base64,abc' },
  tilemaps: {}, sounds: { 'beep.wav': 'data:audio/wav;base64,abc' }, currentFile: 'main.py',
};
const create = jest.fn<Promise<ApiProject>, [string, Project, string]>();
const readBack = getProject as jest.MockedFunction<typeof getProject>;
const savedDraft = projectStorage.saveAnonymousDraft as jest.Mock;
const removedDraft = projectStorage.deleteAnonymousDraft as jest.Mock;
const created: ApiProject = {
  id: 'cloud-1', user_id: 'owner-1', role: 'owner', name: 'My game',
  files: project.files, assets: project.assets, tilemaps: {}, sounds: project.sounds,
  sheet: undefined, current_file: 'main.py', version: 1,
} as ApiProject;

beforeEach(() => {
  jest.clearAllMocks();
  savedDraft.mockResolvedValue(undefined);
  removedDraft.mockResolvedValue(undefined);
  create.mockResolvedValue(created);
  readBack.mockResolvedValue({ ...created });
});

test('persists latest edits, verifies complete server copy, then removes only the claimed draft', async () => {
  expect(await claimAnonymousDraft('__anon_draft_1', project, 'My game', create)).toEqual(created);
  expect(savedDraft).toHaveBeenCalledWith(expect.objectContaining({ id: '__anon_draft_1', project }));
  expect(create).toHaveBeenCalledWith('My game', project, 'My game');
  expect(readBack).toHaveBeenCalledWith('cloud-1');
  expect(removedDraft).toHaveBeenCalledWith('__anon_draft_1');
  expect(savedDraft.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  expect(readBack.mock.invocationCallOrder[0]).toBeLessThan(removedDraft.mock.invocationCallOrder[0]);
});

test('accepts the server-canonical name without losing verification of project content', async () => {
  expect(await claimAnonymousDraft('__anon_draft_1', project, 'My  game', create)).toEqual(created);
  expect(create).toHaveBeenCalledWith('My  game', project, 'My  game');
  expect(removedDraft).toHaveBeenCalledWith('__anon_draft_1');
});

test.each([
  ['missing asset', { assets: {} }],
  ['wrong revision', { version: 2 }],
  ['wrong current file', { current_file: 'other.py' }],
  ['wrong owner', { role: 'viewer' }],
])('retains the device draft when the read-back has a %s', async (_description, mismatch) => {
  readBack.mockResolvedValue({ ...created, ...mismatch } as ApiProject);
  await expect(claimAnonymousDraft('__anon_draft_1', project, 'My game', create))
    .rejects.toThrow('draftClaimVerificationFailed');
  expect(removedDraft).not.toHaveBeenCalled();
});

test('retains the device draft when the read-back request fails', async () => {
  readBack.mockRejectedValue(new Error('network'));
  await expect(claimAnonymousDraft('__anon_draft_1', project, 'My game', create)).rejects.toThrow('network');
  expect(removedDraft).not.toHaveBeenCalled();
});

test('does not create a remote project when the latest local snapshot cannot commit', async () => {
  savedDraft.mockRejectedValue(new Error('quota'));
  await expect(claimAnonymousDraft('__anon_draft_1', project, 'My game', create)).rejects.toThrow('quota');
  expect(create).not.toHaveBeenCalled();
  expect(removedDraft).not.toHaveBeenCalled();
});
