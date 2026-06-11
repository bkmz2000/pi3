// Mock for src/utils/storage.ts — prevents indexedDB usage in jsdom tests
export class ProjectStorage {
  async init() {}
  async getProject() { return null; }
  async saveProject() {}
  async deleteProject() {}
  async listProjects() { return []; }
  async queueSave() {}
  async flushQueue() {}
  async getQueuedSaves() { return []; }
}

export const projectStorage = new ProjectStorage();
export const isOnline = () => true;
