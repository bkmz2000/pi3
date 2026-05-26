import { API_BASE } from './apiBase';

interface ApiError {
  error: string;
  message: string;
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

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Error',
        message: 'An error occurred',
      }));
      throw new Error(error.message || error.error);
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
  animations: Record<string, import('./IdeState').AnimationData>;
  sounds: Record<string, string>;
  sheet?: import('./IdeState').SheetData;
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

export async function createProject(body: { name: string; description?: string; files?: Record<string, string>; assets?: Record<string, string>; tilemaps?: Record<string, import('./IdeState').TilemapData>; animations?: Record<string, import('./IdeState').AnimationData>; sounds?: Record<string, string>; currentFile?: string }): Promise<Project> {
  return api.post<Project>('/api/projects', body);
}

export async function getProject(id: string): Promise<Project> {
  return api.get<Project>(`/api/projects/${id}`);
}

export async function updateProject(id: string, data: { name?: string; description?: string }): Promise<Project> {
  return api.put<Project>(`/api/projects/${id}`, data);
}

export async function saveProjectContent(id: string, data: { files?: Record<string, string>; assets?: Record<string, string>; tilemaps?: Record<string, import('./IdeState').TilemapData>; animations?: Record<string, import('./IdeState').AnimationData>; sounds?: Record<string, string>; sheet?: import('./IdeState').SheetData; currentFile?: string }): Promise<Project> {
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
