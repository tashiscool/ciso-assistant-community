PRAGMA foreign_keys = ON;

ALTER TABLE setup_sso_configs
  ADD COLUMN jit_default_role_names_json TEXT NOT NULL DEFAULT '[]';
