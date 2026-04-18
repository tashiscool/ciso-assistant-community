-- 0018_ops_control_surfaces.sql
-- Canonical operations control-room state for Utilities, Subsystems, RMF, and App Management.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ops_utility_runs (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  utility_key         TEXT NOT NULL,
  module_name         TEXT NOT NULL,
  scope_label         TEXT NOT NULL,
  records_hint        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL,
  notes               TEXT,
  preview_mode        INTEGER NOT NULL DEFAULT 0,
  receipt_path        TEXT,
  created_by_user_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_utility_runs_tenant_updated
  ON ops_utility_runs (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ops_subsystem_preferences (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  subsystem_key       TEXT NOT NULL,
  pinned              INTEGER NOT NULL DEFAULT 0,
  open_count          INTEGER NOT NULL DEFAULT 0,
  last_opened_at      TEXT,
  activity_note       TEXT,
  updated_by_user_id  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, subsystem_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_subsystem_preferences_tenant_updated
  ON ops_subsystem_preferences (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ops_subsystem_sessions (
  tenant_id             TEXT PRIMARY KEY,
  active_subsystem_key  TEXT NOT NULL,
  active_record_type    TEXT NOT NULL,
  updated_by_user_id    TEXT,
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ops_rmf_packages (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL,
  name                   TEXT NOT NULL,
  system_category        TEXT NOT NULL,
  authorization_boundary TEXT NOT NULL,
  current_state          TEXT NOT NULL,
  authorization_status   TEXT NOT NULL,
  progress_percent       INTEGER NOT NULL DEFAULT 0,
  blockers_json          TEXT NOT NULL DEFAULT '[]',
  next_handoff           TEXT NOT NULL,
  decision_target        TEXT NOT NULL,
  steps_json             TEXT NOT NULL DEFAULT '[]',
  artifacts_json         TEXT NOT NULL DEFAULT '[]',
  timeline_json          TEXT NOT NULL DEFAULT '[]',
  created_by_user_id     TEXT,
  updated_by_user_id     TEXT,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_rmf_packages_tenant_updated
  ON ops_rmf_packages (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ops_app_management_apps (
  id                       TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL,
  name                     TEXT NOT NULL,
  description              TEXT NOT NULL,
  administrators_json      TEXT NOT NULL DEFAULT '[]',
  default_public           INTEGER NOT NULL DEFAULT 0,
  inherit_parent_access    INTEGER NOT NULL DEFAULT 1,
  default_users_json       TEXT NOT NULL DEFAULT '[]',
  default_groups_json      TEXT NOT NULL DEFAULT '[]',
  groups_json              TEXT NOT NULL DEFAULT '[]',
  users_json               TEXT NOT NULL DEFAULT '[]',
  service_accounts_json    TEXT NOT NULL DEFAULT '[]',
  automation_owner         TEXT NOT NULL,
  automation_queue         TEXT NOT NULL,
  automation_health        TEXT NOT NULL,
  notes                    TEXT,
  created_by_user_id       TEXT,
  updated_by_user_id       TEXT,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_app_management_apps_tenant_updated
  ON ops_app_management_apps (tenant_id, updated_at DESC);
