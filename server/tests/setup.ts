import Database from 'better-sqlite3';
import { setTestClient } from '../db/index.js';
import { createSqliteClient } from '../db/sqlite-shim.js';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      api_token TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
      password_hash TEXT,
      handle TEXT,
      handle_seq INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower
      ON users(lower(handle)) WHERE handle IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_seq
      ON users(handle_seq) WHERE handle_seq IS NOT NULL;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      files TEXT NOT NULL DEFAULT '{}',
      assets TEXT NOT NULL DEFAULT '{}',
      tilemaps TEXT NOT NULL DEFAULT '{}',
      animations TEXT NOT NULL DEFAULT '{}',
      sounds TEXT NOT NULL DEFAULT '{}',
      current_file TEXT NOT NULL DEFAULT 'main.py',
      thumbnail BLOB,
      thumbnail_updated_at INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      forked_from_snapshot_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_shares (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(project_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token);

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      invite_code TEXT,
      archived_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code
      ON groups(invite_code) WHERE invite_code IS NOT NULL;

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id),
      joined_at INTEGER NOT NULL,
      UNIQUE(group_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      anchor_text TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_project_file ON comments(project_id, file_path);

    CREATE TABLE IF NOT EXISTS help_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      addressed_by TEXT REFERENCES users(id),
      addressed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_help_requests_project_status ON help_requests(project_id, status);

    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      statement TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      starter_code TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      generator_py TEXT NULL,
      reference_solution_py TEXT NULL,
      checker_py TEXT NULL,
      source TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged')),
      scan_findings TEXT,
      public_status TEXT NOT NULL DEFAULT 'unlisted' CHECK (public_status IN ('unlisted', 'pending_review', 'approved', 'rejected')),
      published_json TEXT,
      first_published_at INTEGER,
      last_published_at INTEGER,
      distinct_view_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS problem_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id),
      first_viewed_at INTEGER NOT NULL,
      UNIQUE(problem_id, viewer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_problem_views_problem ON problem_views(problem_id);
    CREATE INDEX IF NOT EXISTS idx_problems_archived_order ON problems(archived, order_index);

    CREATE TABLE IF NOT EXISTS problem_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      tier INTEGER NOT NULL,
      is_visible INTEGER NOT NULL DEFAULT 0,
      ordinal INTEGER NOT NULL,
      input TEXT NOT NULL,
      expected TEXT NOT NULL,
      fields_json TEXT NULL,
      UNIQUE(problem_id, ordinal)
    );
    CREATE INDEX IF NOT EXISTS idx_tests_problem_tier ON problem_tests(problem_id, tier, ordinal);

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      code TEXT NOT NULL,
      stars INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      failed_test INTEGER,
      failed_tier INTEGER,
      ts TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_user_problem ON submissions(user_id, problem_id, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id, ts DESC);

    CREATE TABLE IF NOT EXISTS content_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      handled_at INTEGER,
      handled_by TEXT,
      handled_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_reports_open ON content_reports (handled_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports (target_type, target_id);

    CREATE TABLE IF NOT EXISTS project_snapshots (
      id TEXT PRIMARY KEY,
      share_link TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      original_project_id TEXT,
      title TEXT NOT NULL,
      files_json TEXT NOT NULL,
      assets_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged')),
      scan_findings TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      fork_count INTEGER NOT NULL DEFAULT 0,
      public_status TEXT NOT NULL DEFAULT 'unlisted' CHECK (public_status IN ('unlisted', 'requested', 'approved', 'rejected'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_snapshots_owner ON project_snapshots(owner_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_snapshots_share_link ON project_snapshots(share_link);

    CREATE TABLE IF NOT EXISTS snapshot_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL REFERENCES project_snapshots(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id),
      first_viewed_at INTEGER NOT NULL,
      UNIQUE(snapshot_id, viewer_id)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_views_snapshot ON snapshot_views(snapshot_id);
  `);

  const client = createSqliteClient(db);
  setTestClient(client);
  return db;
}

export function closeTestDb(): void {
  setTestClient(undefined);
}

export default { createTestDb, closeTestDb };
