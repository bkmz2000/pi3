import { API_BASE } from './apiBase';

interface ApiError {
  error: string;
  message: string;
}

export class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

class ApiClient {
  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(cb: () => void): void {
    this.onUnauthorized = cb;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // gzip large request bodies. Save payloads (assets, sheets, tilemaps) can
    // be megabytes; raw JSON usually compresses 5-10x. Skip the overhead for
    // small bodies and skip entirely if the browser lacks CompressionStream.
    let body = options.body;
    if (
      typeof body === 'string' &&
      body.length > 4096 &&
      typeof CompressionStream !== 'undefined'
    ) {
      const compressed = await new Response(
        new Blob([body]).stream().pipeThrough(new CompressionStream('gzip')),
      ).blob();
      body = compressed;
      headers['Content-Encoding'] = 'gzip';
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      body,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new ApiHttpError(401, 'Unauthorized');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Error',
        message: 'An error occurred',
      }));
      throw new ApiHttpError(response.status, error.message || error.error);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

export interface User {
  id: string;
  name: string;
  handle: string | null;
  role: 'student' | 'teacher';
  created_at: number;
  freeze_updates?: boolean;
}

export async function setFreezeUpdates(freeze: boolean): Promise<{ freeze_updates: boolean }> {
  return api.patch<{ freeze_updates: boolean }>('/api/users/me/freeze', { freeze });
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  is_public: number;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  files: Record<string, string>;
  assets: Record<string, string>;
  tilemaps: Record<string, import('./IdeState').TilemapData>;
  sounds: Record<string, string>;
  // sheet can arrive as either the sparse-chunk wire shape or the legacy
  // single-buffer shape (older saved rows). Decoder handles both.
  sheet?: import('./sheetCodec').SheetWire | import('./IdeState').SheetData;
  current_file: string;
  created_at: number;
  updated_at: number;
  thumbnail_updated_at?: number | null;
}

export async function uploadProjectThumbnail(id: string, blob: Blob): Promise<{ thumbnail_updated_at: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/thumbnail`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Thumbnail upload failed: ${res.status}`);
  return res.json();
}

export async function getMe(): Promise<User> {
  return api.get<User>('/api/users/me');
}

export async function outsiderSignup(name: string, password: string, role: 'student' | 'teacher' = 'student'): Promise<User> {
  return api.post<User>('/api/users/outsider', { name, password, role });
}

export async function outsiderLogin(name: string, password: string): Promise<User> {
  return api.post<User>('/api/users/outsider/login', { name, password });
}

export async function getProjects(): Promise<Project[]> {
  return api.get<Project[]>('/api/projects');
}

export async function createProject(body: { name: string; description?: string; files?: Record<string, string>; assets?: Record<string, string>; tilemaps?: Record<string, import('./IdeState').TilemapData>; sounds?: Record<string, string>; sheet?: import('./sheetCodec').SheetWire; currentFile?: string }): Promise<Project> {
  return api.post<Project>('/api/projects', body);
}

export async function getProject(id: string): Promise<Project> {
  return api.get<Project>(`/api/projects/${id}`);
}

export async function updateProject(id: string, data: { name?: string; description?: string }): Promise<Project> {
  return api.put<Project>(`/api/projects/${id}`, data);
}

export async function saveProjectContent(id: string, data: { files?: Record<string, string>; assets?: Record<string, string>; tilemaps?: Record<string, import('./IdeState').TilemapData>; sounds?: Record<string, string>; sheet?: import('./sheetCodec').SheetWire; currentFile?: string }): Promise<Project> {
  return api.put<Project>(`/api/projects/${id}/save`, data);
}

export async function deleteProject(id: string): Promise<void> {
  return api.delete<void>(`/api/projects/${id}`);
}

export async function shareProject(id: string, username: string, role: 'editor' | 'viewer'): Promise<void> {
  return api.post<void>(`/api/projects/${id}/share`, { username, role });
}

export interface UserSearchResult {
  id: string;
  name: string;
  handle: string | null;
  role: string;
}

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  if (q.trim().length < 2) return [];
  return api.get<UserSearchResult[]>(`/api/users/search?q=${encodeURIComponent(q)}`);
}

export async function shareProjectWithUser(id: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
  return api.post<void>(`/api/projects/${id}/share`, { user_id: userId, role });
}

export interface TeacherShareStatus {
  shared: boolean;
  teachers: { id: string; name: string; handle: string | null }[];
  help_request: { id: string; status: string } | null;
}

export interface SharedProject {
  id: string;
  name: string;
  description: string | null;
  updated_at: number;
  student_id: string;
  student_name: string;
  student_handle: string | null;
  help_request_id: string | null;
  help_request_status: string | null;
  help_request_created_at: number | null;
  group_name: string | null;
}

export interface HelpRequest {
  id: string;
  status: string;
  created_at: number;
  project_id: string;
  project_name: string;
  student_id: string;
  student_name: string;
  student_handle: string | null;
}

export async function getTeacherShare(projectId: string): Promise<TeacherShareStatus> {
  return api.get<TeacherShareStatus>(`/api/projects/${projectId}/teacher-share`);
}

export async function unshareProject(projectId: string, userId: string): Promise<void> {
  return api.delete<void>(`/api/projects/${projectId}/share/${userId}`);
}

export async function toggleHelpRequest(projectId: string): Promise<{ help_request: { id: string; status: string } }> {
  return api.post(`/api/projects/${projectId}/help-request`);
}

export async function getSharedProjects(): Promise<SharedProject[]> {
  return api.get<SharedProject[]>('/api/projects/shared-with-me');
}

// ── Live presence (teacher dashboard roster) ─────────────────────────────

export interface LivePresenceMember {
  student_id: string;
  student_name: string;
  student_handle: string | null;
  project_id: string | null;
  project_name: string | null;
  file: string | null;
  cursor_line: number | null;
  updated_at: number | null;
  idle: boolean;
}

export interface LivePresenceResponse {
  members: LivePresenceMember[];
  server_now: number;
}

// One member's live editor buffer, fetched on selection (master-detail).
export interface LiveMemberBuffer {
  file: string | null;
  cursor_line: number | null;
  content: string | null;
  updated_at: number | null;
  idle: boolean;
}

// Lighter member row for a session roster (no project fields).
export interface LiveSessionMember {
  student_id: string;
  student_name: string | null;
  student_handle: string | null;
  file: string | null;
  cursor_line: number | null;
  updated_at: number | null;
  idle: boolean;
}

export interface LiveSessionRosterResponse {
  members: LiveSessionMember[];
  server_now: number;
  role: 'starter' | 'joiner';
}

export interface PresencePayload {
  content?: string;
  contentHash?: string;
  sessionId?: string | null;
}

export async function postLivePresence(
  projectId: string,
  file: string,
  cursorLine: number,
  extra: PresencePayload = {},
): Promise<void> {
  await api.post<void>('/api/live/presence', {
    project_id: projectId,
    file,
    cursor_line: cursorLine,
    // Omit content when unchanged so the server keeps the last buffer.
    ...(extra.content != null ? { content: extra.content, content_hash: extra.contentHash } : {}),
    session_id: extra.sessionId ?? null,
  });
}

export async function getLiveGroup(groupId: string): Promise<LivePresenceResponse> {
  return api.get<LivePresenceResponse>(`/api/live/group/${encodeURIComponent(groupId)}`);
}

export async function getLiveMember(groupId: string, studentId: string): Promise<LiveMemberBuffer> {
  return api.get<LiveMemberBuffer>(
    `/api/live/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(studentId)}`,
  );
}

// ── Live sessions (public + institutional peer) ──────────────────────────

export interface SessionStartResponse {
  token: string;
  session_id: string;
  expires_at: number;
  group_id?: string;
}

export interface SessionJoinResponse {
  session_id: string;
  starter_id: string;
  role: 'starter' | 'joiner';
  expires_at: number;
}

export async function startSession(): Promise<SessionStartResponse> {
  return api.post<SessionStartResponse>('/api/sessions/start', {});
}

export async function joinSession(token: string): Promise<SessionJoinResponse> {
  return api.post<SessionJoinResponse>('/api/sessions/join', { token });
}

export async function getSessionRoster(sid: string, token: string): Promise<LiveSessionRosterResponse> {
  return api.get<LiveSessionRosterResponse>(
    `/api/live/session/${encodeURIComponent(sid)}/roster?token=${encodeURIComponent(token)}`,
  );
}

export async function getSessionMember(sid: string, studentId: string, token: string): Promise<LiveMemberBuffer> {
  return api.get<LiveMemberBuffer>(
    `/api/live/session/${encodeURIComponent(sid)}/member/${encodeURIComponent(studentId)}?token=${encodeURIComponent(token)}`,
  );
}

// Emoji-only reactions inside a session. `target` is the student_id reacted to.
export interface SessionComment {
  id: string;
  author_id: string;
  emoji: string;
  target?: string;
  created_at: number;
}

export async function getAllowedEmoji(): Promise<string[]> {
  const r = await api.get<{ allowed: string[] }>('/api/sessions/allowed-emoji');
  return r.allowed;
}

export async function postSessionComment(
  sid: string, token: string, emoji: string, target?: string,
): Promise<SessionComment> {
  return api.post<SessionComment>(`/api/sessions/${encodeURIComponent(sid)}/comments`, { token, emoji, target });
}

export async function listSessionComments(sid: string, token: string): Promise<SessionComment[]> {
  return api.post<SessionComment[]>(`/api/sessions/${encodeURIComponent(sid)}/comments/list`, { token });
}

export async function getHelpRequests(): Promise<HelpRequest[]> {
  return api.get<HelpRequest[]>('/api/help-requests');
}

export async function getGroupHelpRequests(groupId: string): Promise<HelpRequest[]> {
  return api.get<HelpRequest[]>(`/api/help-requests?group_id=${encodeURIComponent(groupId)}`);
}

export async function addressHelpRequest(id: string): Promise<void> {
  return api.patch<void>(`/api/help-requests/${id}`, { status: 'addressed' });
}

export async function markHelpRequestInProgress(id: string): Promise<void> {
  return api.patch<void>(`/api/help-requests/${id}`, { status: 'in_progress' });
}

export interface Group {
  id: string;
  name: string;
  teacher_id: string;
  invite_code: string | null;
  archived_at: number | null;
  created_at: number;
  member_count: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  student_id: string;
  student_name: string;
  student_handle: string | null;
  joined_at: number;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
  teacher_handle?: string | null;
}

export interface ApiComment {
  id: string;
  project_id: string;
  file_path: string;
  line_number: number;
  anchor_text: string;
  text: string;
  author_id: string;
  author_name: string;
  author_handle: string | null;
  created_at: number;
}

export async function getComments(projectId: string, file?: string): Promise<ApiComment[]> {
  const qs = file ? `?file=${encodeURIComponent(file)}` : '';
  return api.get<ApiComment[]>(`/api/projects/${projectId}/comments${qs}`);
}

export async function addComment(projectId: string, body: {
  file_path: string;
  line_number: number;
  anchor_text: string;
  text: string;
}): Promise<ApiComment> {
  return api.post<ApiComment>(`/api/projects/${projectId}/comments`, body);
}

export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  return api.delete<void>(`/api/projects/${projectId}/comments/${commentId}`);
}

export async function getGroups(includeArchived = false): Promise<Group[]> {
  return api.get<Group[]>(`/api/groups${includeArchived ? '?include_archived=1' : ''}`);
}

export async function updateGroup(id: string, patch: { name?: string; archived?: boolean }): Promise<Group> {
  return api.patch<Group>(`/api/groups/${id}`, patch);
}

export async function regenerateInviteCode(id: string): Promise<{ invite_code: string }> {
  return api.post<{ invite_code: string }>(`/api/groups/${id}/invite-code/regenerate`);
}

export async function joinGroupByCode(code: string): Promise<{ id: string; name: string; already_member?: boolean }> {
  return api.post(`/api/groups/join`, { code });
}

export async function getMyGroups(): Promise<(Group & { teacher_name: string; teacher_handle: string | null })[]> {
  return api.get('/api/groups/my');
}

export async function createGroup(name: string): Promise<Group> {
  return api.post<Group>('/api/groups', { name });
}

export async function getGroup(id: string): Promise<GroupDetail> {
  return api.get<GroupDetail>(`/api/groups/${id}`);
}

export async function deleteGroup(id: string): Promise<void> {
  return api.delete<void>(`/api/groups/${id}`);
}

export async function inviteToGroup(groupId: string, username: string): Promise<GroupMember> {
  return api.post<GroupMember>(`/api/groups/${groupId}/invite`, { username });
}

export async function removeFromGroup(groupId: string, userId: string): Promise<void> {
  return api.delete<void>(`/api/groups/${groupId}/members/${userId}`);
}

export interface Config {
  allowPasswordAuth: boolean;
}

export async function getConfig(): Promise<Config> {
  return api.get<Config>('/api/config');
}
