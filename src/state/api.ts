const API_BASE = import.meta?.env?.VITE_API_URL || '';

interface ApiError {
  error: string;
  message: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.token = null;
      localStorage.removeItem('pi3_token');
      window.location.href = '/';
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

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

export interface User {
  id: string;
  name: string;
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
  current_file: string;
  created_at: number;
  updated_at: number;
}

export async function getMe(): Promise<User> {
  return api.get<User>('/api/users/me');
}

export async function createUser(name: string): Promise<{ user: User; api_token: string }> {
  const result = await api.post<{ id: string; name: string; api_token: string; created_at: number }>('/api/users', { name });
  return { user: { id: result.id, name: result.name, created_at: result.created_at }, api_token: result.api_token };
}

export async function getProjects(): Promise<Project[]> {
  return api.get<Project[]>('/api/projects');
}

export async function createProject(body: { name: string; description?: string; files?: Record<string, string>; assets?: Record<string, string>; currentFile?: string }): Promise<Project> {
  return api.post<Project>('/api/projects', body);
}

export async function getProject(id: string): Promise<Project> {
  return api.get<Project>(`/api/projects/${id}`);
}

export async function updateProject(id: string, data: { name?: string; description?: string }): Promise<Project> {
  return api.put<Project>(`/api/projects/${id}`, data);
}

export async function saveProjectContent(id: string, data: { files?: Record<string, string>; assets?: Record<string, string>; currentFile?: string }): Promise<Project> {
  return api.put<Project>(`/api/projects/${id}/save`, data);
}

export async function deleteProject(id: string): Promise<void> {
  return api.delete<void>(`/api/projects/${id}`);
}

export async function shareProject(id: string, email: string, role: 'editor' | 'viewer'): Promise<void> {
  return api.post<void>(`/api/projects/${id}/share`, { email, role });
}
