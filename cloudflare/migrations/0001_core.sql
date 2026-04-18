-- 0001_core.sql
-- Core D1 schema: tenants, IAM, basic GRC primitives (frameworks, controls, risks)
-- This is written for Cloudflare D1 (SQLite dialect).

PRAGMA foreign_keys = ON;

-- Tenants / organizations

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,            -- uuid
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id     TEXT NOT NULL,
  key           TEXT NOT NULL,
  value_json    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- IAM / Users / Sessions / Roles

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  email         TEXT NOT NULL,
  display_name  TEXT,
  locale        TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id       TEXT NOT NULL,
  role_id       TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,            -- uuid or random token id
  user_id       TEXT NOT NULL,
  tenant_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at    TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Simple feature flags / permissions per role

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL,
  permission    TEXT NOT NULL,
  PRIMARY KEY (role_id, permission),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Compliance primitives

CREATE TABLE IF NOT EXISTS frameworks (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  key           TEXT NOT NULL,               -- e.g. ISO27001_2022
  name          TEXT NOT NULL,
  version       TEXT,
  category      TEXT,                        -- e.g. security, privacy
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS controls (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  framework_id  TEXT NOT NULL,
  ref           TEXT NOT NULL,               -- e.g. A.5.1
  title         TEXT NOT NULL,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (framework_id, ref),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (framework_id) REFERENCES frameworks(id) ON DELETE CASCADE
);

-- Risk primitives

CREATE TABLE IF NOT EXISTS risk_registers (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_scenarios (
  id            TEXT PRIMARY KEY,            -- uuid
  tenant_id     TEXT NOT NULL,
  register_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  likelihood    REAL,
  impact        REAL,
  inherent_score REAL,
  residual_score REAL,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (register_id) REFERENCES risk_registers(id) ON DELETE CASCADE
);

-- Simple join between risk scenarios and controls

CREATE TABLE IF NOT EXISTS risk_scenario_controls (
  scenario_id   TEXT NOT NULL,
  control_id    TEXT NOT NULL,
  PRIMARY KEY (scenario_id, control_id),
  FOREIGN KEY (scenario_id) REFERENCES risk_scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (control_id) REFERENCES controls(id) ON DELETE CASCADE
);

