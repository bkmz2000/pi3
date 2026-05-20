import { Project as ApiProject } from '../../src/state/api';
import { toEditorProject } from '../../src/state/projectNormalization';

const baseApi = (overrides: Partial<ApiProject> = {}): ApiProject => ({
  id: 'proj-123',
  name: 'Test Project',
  description: null,
  is_public: 0,
  user_id: 'user-123',
  role: 'owner',
  files: {},
  assets: {},
  tilemaps: {},
  current_file: 'main.py',
  created_at: 1234567890,
  updated_at: 1234567890,
  ...overrides,
});

describe('toEditorProject — API→editor adapter', () => {
  it('converts snake_case current_file to camelCase currentFile', () => {
    const apiProject = baseApi({
      files: { 'main.py': 'print("hello")' },
      assets: { 'sprite.svg': 'data:image/svg...' },
    });

    const editorProject = toEditorProject(apiProject);

    expect(editorProject).toEqual({
      name: 'Test Project',
      files: { 'main.py': 'print("hello")' },
      assets: { 'sprite.svg': 'data:image/svg...' },
      tilemaps: {},
      currentFile: 'main.py',
    });
  });

  it('adapter maps current_file to currentFile', () => {
    const apiProject = baseApi({ id: 'p1', name: 'P1', role: 'editor', files: { 'script.py': '' }, current_file: 'script.py' });

    const result = toEditorProject(apiProject);

    expect(result.currentFile).toBe('script.py');
    expect('current_file' in result).toBe(false);
  });

  it('adapter does not leak API-only fields', () => {
    const result = toEditorProject(baseApi({ id: 'p1', name: 'P1' }));

    expect('id' in result).toBe(false);
    expect('is_public' in result).toBe(false);
    expect('user_id' in result).toBe(false);
    expect('role' in result).toBe(false);
    expect('created_at' in result).toBe(false);
    expect('updated_at' in result).toBe(false);
    expect('description' in result).toBe(false);
  });

  it('adapter preserves file and asset content', () => {
    const files = {
      'main.py': 'print(1)',
      'utils.py': 'def helper(): pass',
    };
    const assets = {
      'sprite.svg': 'url1',
      'bg.png': 'url2',
    };

    const result = toEditorProject(baseApi({ id: 'p1', name: 'P1', role: 'viewer', files, assets }));

    expect(result.files).toEqual(files);
    expect(result.assets).toEqual(assets);
  });

  it('adapter falls back to empty tilemaps when API field is missing', () => {
    const apiProjectWithoutTimaps = { ...baseApi(), tilemaps: undefined } as unknown as ApiProject;
    const result = toEditorProject(apiProjectWithoutTimaps);
    expect(result.tilemaps).toEqual({});
  });
});
