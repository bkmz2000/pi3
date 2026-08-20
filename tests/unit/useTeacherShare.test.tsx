/**
 * useTeacherShare: the teacher-sharing half of the student IDE — fetches
 * the share status, and share/unshare/help-request actions that refresh
 * after each mutation. Guards: skips entirely unless logged in as a
 * student with a current project.
 */
import { renderHook, act } from '@testing-library/react';

const editorState = {
  currentProjectId: 'p1' as string | undefined,
};

const userState = {
  authState: 'logged_in' as string,
  user: { role: 'student', name: 'Alice' } as { role: string; name: string } | null,
};

jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
}));

jest.mock('../../src/state/useUser', () => ({
  useUser: () => userState,
}));

jest.mock('../../src/state/api', () => ({
  getTeacherShare: jest.fn(),
  shareProject: jest.fn().mockResolvedValue(undefined),
  unshareProject: jest.fn().mockResolvedValue(undefined),
  toggleHelpRequest: jest.fn().mockResolvedValue(undefined),
}));

import { useTeacherShare } from '../../src/state/useTeacherShare';
import { getTeacherShare, shareProject, unshareProject, toggleHelpRequest } from '../../src/state/api';

const shareStatus = {
  shared_with: [{ teacher_id: 't1', teacher_name: 'Ms. Rivera' }],
  help_request: { id: 'h1', status: 'pending' },
};

beforeEach(() => {
  (getTeacherShare as jest.Mock).mockReset();
  (shareProject as jest.Mock).mockReset();
  (unshareProject as jest.Mock).mockReset();
  (toggleHelpRequest as jest.Mock).mockReset();
  editorState.currentProjectId = 'p1';
  userState.authState = 'logged_in';
  userState.user = { role: 'student', name: 'Alice' };
  (getTeacherShare as jest.Mock).mockResolvedValue(shareStatus);
});

describe('useTeacherShare', () => {
  it('fetches share status on mount for a logged-in student', async () => {
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    expect(getTeacherShare).toHaveBeenCalledWith('p1');
    expect(result.current.data).toEqual(shareStatus);
    expect(result.current.loading).toBe(false);
  });

  it('skips the fetch when not logged in', async () => {
    userState.authState = 'logged_out';
    renderHook(() => useTeacherShare());
    await act(async () => {});
    expect(getTeacherShare).not.toHaveBeenCalled();
  });

  it('skips the fetch when the user is not a student', async () => {
    userState.user = { role: 'teacher', name: 'Mr. Khan' };
    renderHook(() => useTeacherShare());
    await act(async () => {});
    expect(getTeacherShare).not.toHaveBeenCalled();
  });

  it('skips the fetch when there is no current project', async () => {
    editorState.currentProjectId = undefined;
    renderHook(() => useTeacherShare());
    await act(async () => {});
    expect(getTeacherShare).not.toHaveBeenCalled();
  });

  it('clears data and records failure when the fetch rejects', async () => {
    (getTeacherShare as jest.Mock).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('share() posts then refreshes', async () => {
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    (getTeacherShare as jest.Mock).mockClear();

    await act(async () => { await result.current.share('ms.rivera@school.org'); });

    expect(shareProject).toHaveBeenCalledWith('p1', 'ms.rivera@school.org', 'viewer');
    expect(getTeacherShare).toHaveBeenCalledTimes(1);
  });

  it('unshare() posts then refreshes', async () => {
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    (getTeacherShare as jest.Mock).mockClear();

    await act(async () => { await result.current.unshare('t1'); });

    expect(unshareProject).toHaveBeenCalledWith('p1', 't1');
    expect(getTeacherShare).toHaveBeenCalledTimes(1);
  });

  it('toggleHelp() posts then refreshes', async () => {
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    (getTeacherShare as jest.Mock).mockClear();

    await act(async () => { await result.current.toggleHelp(); });

    expect(toggleHelpRequest).toHaveBeenCalledWith('p1');
    expect(getTeacherShare).toHaveBeenCalledTimes(1);
  });

  it('mutations are no-ops without a current project', async () => {
    editorState.currentProjectId = undefined;
    const { result } = renderHook(() => useTeacherShare());
    await act(async () => {});
    await act(async () => { await result.current.share('x@y.z'); });
    expect(shareProject).not.toHaveBeenCalled();
  });
});
