import { act, render, waitFor } from '@testing-library/react';
import { AnonStashLoader } from '../../src/components/AnonStashLoader';

const editorState = {
  currentProjectId: null as string | null,
  dirtyFiles: new Set<string>(),
  changeCurrentProject: jest.fn(),
};
const mockListAnonymousDrafts = jest.fn();
const mockMigrateLegacyAnonStash = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/state/IdeState', () => {
  const useEditorMock = (selector: (state: typeof editorState) => unknown) => selector(editorState);
  (useEditorMock as unknown as { getState: () => typeof editorState }).getState = () => editorState;
  return { useEditor: useEditorMock };
});
jest.mock('../../src/utils/storage', () => ({ projectStorage: { listAnonymousDrafts: (...args: unknown[]) => mockListAnonymousDrafts(...args) } }));
jest.mock('../../src/utils/anonStash', () => ({ migrateLegacyAnonStash: (...args: unknown[]) => mockMigrateLegacyAnonStash(...args) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

const olderDraft = {
  id: '__anon_draft_previous',
  project: { name: 'Older work', files: { 'main.py': 'print(1)' }, assets: {}, tilemaps: {}, sounds: {} },
  lastModified: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMigrateLegacyAnonStash.mockResolvedValue(undefined);
  editorState.currentProjectId = null;
  editorState.dirtyFiles = new Set();
  window.history.pushState({}, '', '/ide');
  localStorage.clear();
});

test('does not replace a clean project selected while IndexedDB drafts are loading', async () => {
  const pendingDrafts = deferred<typeof olderDraft[]>();
  mockListAnonymousDrafts.mockReturnValue(pendingDrafts.promise);

  render(<AnonStashLoader />);
  await waitFor(() => expect(mockListAnonymousDrafts).toHaveBeenCalledTimes(1));
  editorState.currentProjectId = '__anon_draft_new-project';

  await act(async () => { pendingDrafts.resolve([olderDraft]); });

  expect(editorState.changeCurrentProject).not.toHaveBeenCalled();
  expect(localStorage.getItem('pi3_last_editor_path')).toBeNull();
});

test('restores the newest draft on a still-fresh editor route', async () => {
  mockListAnonymousDrafts.mockResolvedValue([olderDraft]);
  render(<AnonStashLoader />);

  await waitFor(() => expect(editorState.changeCurrentProject).toHaveBeenCalledWith(olderDraft.project, olderDraft.id));
  expect(localStorage.getItem('pi3_last_editor_path')).toBe(`/ide/${olderDraft.id}`);
});
