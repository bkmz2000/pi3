import { getProject } from './api';

/** Replay a pending local snapshot before loading the server's project row. */
export async function loadProjectAfterQueue(
  projectId: string,
  syncQueuedSaves: () => Promise<void>,
): ReturnType<typeof getProject> {
  await syncQueuedSaves();
  return getProject(projectId);
}
