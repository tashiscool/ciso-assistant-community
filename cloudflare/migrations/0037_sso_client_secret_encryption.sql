PRAGMA foreign_keys = ON;

ALTER TABLE setup_sso_configs
  ADD COLUMN client_secret_encrypted TEXT;
