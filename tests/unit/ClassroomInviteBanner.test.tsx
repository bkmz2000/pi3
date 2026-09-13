import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClassroomInviteBanner } from '../../src/components/session/ClassroomInviteBanner';
import { useIde } from '../../src/state/IdeState';
import { useLiveSession } from '../../src/state/useLiveSession';
import { useUser } from '../../src/state/useUser';

jest.mock('../../src/state/api', () => ({
  getLiveGroupInvitations: jest.fn(),
  joinClassroomSession: jest.fn(),
  startSession: jest.fn(),
  joinSession: jest.fn(),
}));

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) => selector({
    theme: {
      successPill: '#def7e5', successPillTxt: '#18794e', panelTxt: '#222',
      panelTxtMute: '#666', panelBorder: '#bbb', runBg: '#087f5b', runTxt: '#fff', fontUI: 'sans-serif',
    },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getLiveGroupInvitations, joinClassroomSession } = require('../../src/state/api') as {
  getLiveGroupInvitations: jest.Mock;
  joinClassroomSession: jest.Mock;
};

describe('ClassroomInviteBanner', () => {
  beforeEach(() => {
    getLiveGroupInvitations.mockReset();
    joinClassroomSession.mockReset();
    useUser.setState({ authState: 'logged_in', user: { id: 'student-1', name: 'Student', handle: 'student', role: 'student', created_at: 1 } });
    useLiveSession.setState({
      token: null, sid: null, role: null, expiresAt: null, kind: null, groupId: null, label: null,
      peerTabs: [], activePeer: null,
    });
    useIde.setState({ activePanel: null });
  });

  it('shows a group invitation and joins only after acceptance', async () => {
    getLiveGroupInvitations.mockResolvedValue([{
      group_id: 'group-a2', group_name: 'A2', session_id: 'sid-a2',
      teacher_name: 'Teacher', teacher_handle: 'teacher', started_at: 1, expires_at: 999,
    }]);
    joinClassroomSession.mockResolvedValue({
      token: 'class-token', session_id: 'sid-a2', group_id: 'group-a2', expires_at: 999,
    });

    render(<ClassroomInviteBanner />);
    await screen.findByText('Group A2 is live. Join?');
    expect(joinClassroomSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(joinClassroomSession).toHaveBeenCalledWith('group-a2'));
    expect(useLiveSession.getState()).toMatchObject({
      token: 'class-token', sid: 'sid-a2', kind: 'classroom', groupId: 'group-a2', label: 'A2',
    });
    expect(useIde.getState().activePanel).toBe('live');
  });

  it('can dismiss one classroom session without joining it', async () => {
    getLiveGroupInvitations.mockResolvedValue([{
      group_id: 'group-a2', group_name: 'A2', session_id: 'sid-a2',
      teacher_name: 'Teacher', teacher_handle: null, started_at: 1, expires_at: 999,
    }]);
    render(<ClassroomInviteBanner />);
    await screen.findByText('Group A2 is live. Join?');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Group A2 is live. Join?')).toBeNull());
    expect(joinClassroomSession).not.toHaveBeenCalled();
  });
});
