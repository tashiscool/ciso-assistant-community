-- 0003_workspace_admin.sql
-- Workspace administration schema for folders, groups, and scoped role assignments.

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN keep_local_login INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_third_party INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_auditee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN preferences_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE roles ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS folders (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  content_type     TEXT NOT NULL DEFAULT 'domain',
  parent_folder_id TEXT,
  is_builtin       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, parent_folder_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_tenant_parent
  ON folders (tenant_id, parent_folder_id);

CREATE TABLE IF NOT EXISTS user_groups (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  folder_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  is_builtin    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, folder_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_groups_tenant_folder
  ON user_groups (tenant_id, folder_id);

CREATE TABLE IF NOT EXISTS user_group_memberships (
  user_id   TEXT NOT NULL,
  group_id  TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group
  ON user_group_memberships (group_id);

CREATE TABLE IF NOT EXISTS role_assignments (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  role_id             TEXT NOT NULL,
  user_id             TEXT,
  group_id            TEXT,
  scope_folder_id     TEXT NOT NULL,
  assigned_by_user_id TEXT,
  is_recursive        INTEGER NOT NULL DEFAULT 1,
  is_builtin          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (user_id IS NOT NULL AND group_id IS NULL)
    OR (user_id IS NULL AND group_id IS NOT NULL)
  ),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (scope_folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_tenant_scope
  ON role_assignments (tenant_id, scope_folder_id);

CREATE INDEX IF NOT EXISTS idx_role_assignments_user
  ON role_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_role_assignments_group
  ON role_assignments (group_id);
