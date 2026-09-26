import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const projectsState = {
  apiProjects: [
    {
      id: 'mine-1', name: 'My game', description: 'An owned project', role: 'owner',
      updated_at: Date.now(), thumbnail_updated_at: null,
    },
    {
      id: 'shared-1', name: 'Class game', description: 'A shared project', role: 'viewer',
      updated_at: Date.now(), thumbnail_updated_at: null,
    },
  ],
  apiLoading: false,
  apiError: null,
  fetchProjects: jest.fn().mockResolvedValue(undefined),
  addProject: jest.fn(),
  removeProject: jest.fn(),
  renameProject: jest.fn(),
  downloadProject: jest.fn(),
  importProjectFromFile: jest.fn(),
};

const editorState = {
  currentProjectId: 'mine-1' as string | null,
  changeCurrentProject: jest.fn(),
};

const userState = { authState: 'logged_in', user: { role: 'student' } };

jest.mock('../../src/hooks/useProjects', () => ({ useProjects: () => projectsState }));
jest.mock('../../src/state/useUser', () => ({ useUser: () => userState }));
jest.mock('../../src/utils/storage', () => ({
  projectStorage: { listAnonymousDrafts: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../src/utils/anonStash', () => ({
  migrateLegacyAnonStash: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/zip', () => ({ downloadProjectZip: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (state: typeof editorState) => unknown) => selector(editorState),
  isExampleSessionId: (id: string | null | undefined) => typeof id === 'string' && id.startsWith('__example_session_'),
  exampleNameFromSessionId: (id: string) => id.replace('__example_session_', ''),
}));

const theme = {
  accent: '#0e9aa7', canvasBg: '#fff', fontUI: 'sans-serif', panelBorder: '#888',
  panelTxt: '#111', panelTxtMute: '#555', railActiveBg: '#ddd', railBg: '#eee',
  railIcon: '#333', railIconActive: '#111', railLogo: '#111', runBg: '#287a43',
  runTxt: '#fff', stopBg: '#a33', surface: '#fff', surfacePanel: '#f7f7f7',
};

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (state: { theme: typeof theme }) => unknown) => selector({ theme }),
}));
jest.mock('../../src/components/projects/ShareDialog', () => ({ ShareDialog: () => null }));

import { ProjectsPage } from '../../src/components/projects/ProjectsPage';
import { projectStorage } from '../../src/utils/storage';
import { downloadProjectZip } from '../../src/utils/zip';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderPage(path = '/projects') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProjectsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (projectStorage.listAnonymousDrafts as jest.Mock).mockResolvedValue([]);
  userState.authState = 'logged_in';
  editorState.currentProjectId = 'mine-1';
});

it('uses one surface with owned, examples, and shared categories', async () => {
  renderPage();
  await waitFor(() => expect(projectsState.fetchProjects).toHaveBeenCalled());

  expect(screen.getByText('My game')).toBeInTheDocument();
  expect(screen.queryByText('Class game')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: /examples/i }));
  expect(screen.getByText('Hello World')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /shared with me/i }));
  expect(screen.getByText('Class game')).toBeInTheDocument();
  expect(screen.queryByText('My game')).toBeNull();
});

it('opens examples through an explicit draft route', () => {
  renderPage('/projects?tab=examples');
  const helloRow = screen.getByText('Hello World').closest('article');
  fireEvent.click(helloRow!.querySelector('button')!);
  expect(screen.getByTestId('location')).toHaveTextContent('/ide/example/hello%20world');
});

it('shows and opens local recovery drafts even when signed out', async () => {
  userState.authState = 'signed_out';
  (projectStorage.listAnonymousDrafts as jest.Mock).mockResolvedValue([{
    id: '__anon_draft_recovered_proj-queue_52',
    project: { name: 'Recovered offline edits #52', files: { 'main.py': 'print(42)' }, assets: {}, tilemaps: {}, sounds: {} },
    lastModified: Date.now(),
  }]);

  renderPage();

  const recovery = await screen.findByRole('button', { name: /open recovered offline edits #52/i });
  fireEvent.click(recovery);
  expect(screen.getByTestId('location')).toHaveTextContent('/ide/__anon_draft_recovered_proj-queue_52');
});

it('exports the selected stored local draft even when signed out', async () => {
  userState.authState = 'signed_out';
  (projectStorage.listAnonymousDrafts as jest.Mock).mockResolvedValue([{
    id: '__anon_draft_art',
    project: {
      name: 'Art project', files: { 'main.py': 'draw()' },
      assets: { 'art.png': 'data:image/png;base64,abc' }, tilemaps: {},
      sounds: { 'beep.wav': 'data:audio/wav;base64,def' }, currentFile: 'main.py',
    },
    lastModified: Date.now(),
  }]);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /export project art project/i }));
  await waitFor(() => expect(downloadProjectZip).toHaveBeenCalledWith(expect.objectContaining({
    id: '__anon_draft_art',
    files: [{ name: 'main.py', content: 'draw()' }],
    assets: { 'art.png': 'data:image/png;base64,abc' },
    sounds: { 'beep.wav': 'data:audio/wav;base64,def' },
  })));
  expect(screen.getByTestId('location')).toHaveTextContent('/projects');
});

it('returns to the currently loaded account project', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', { name: /back to editor/i }));
  expect(screen.getByTestId('location')).toHaveTextContent('/ide/mine-1');
});
