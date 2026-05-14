import { useEffect, useState, useCallback } from 'react';
import { useEditor } from './IdeState';
import { useUser } from './useUser';
import {
  getTeacherShare, shareProject, unshareProject, toggleHelpRequest,
  type TeacherShareStatus,
} from './api';

export function useTeacherShare() {
  const currentProjectId = useEditor((s) => s.currentProjectId);
  const { authState, user } = useUser();
  const [data, setData] = useState<TeacherShareStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentProjectId || authState !== 'logged_in' || user?.role !== 'student') {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await getTeacherShare(currentProjectId));
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [currentProjectId, authState, user?.role]);

  useEffect(() => { refresh(); }, [refresh]);

  const share = useCallback(async (teacherEmail: string) => {
    if (!currentProjectId) return;
    await shareProject(currentProjectId, teacherEmail, 'viewer');
    await refresh();
  }, [currentProjectId, refresh]);

  const unshare = useCallback(async (teacherId: string) => {
    if (!currentProjectId) return;
    await unshareProject(currentProjectId, teacherId);
    await refresh();
  }, [currentProjectId, refresh]);

  const toggleHelp = useCallback(async () => {
    if (!currentProjectId) return;
    await toggleHelpRequest(currentProjectId);
    await refresh();
  }, [currentProjectId, refresh]);

  return { data, loading, share, unshare, toggleHelp };
}
