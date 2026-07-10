CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at);
