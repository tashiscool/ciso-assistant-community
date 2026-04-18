CREATE TABLE IF NOT EXISTS setup_classifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  confidentiality TEXT NOT NULL,
  integrity TEXT NOT NULL,
  availability TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_setup_classifications_tenant
  ON setup_classifications(tenant_id, title);

CREATE TABLE IF NOT EXISTS setup_branding_configs (
  tenant_id TEXT PRIMARY KEY,
  primary_logo_url TEXT,
  primary_logo_dark_url TEXT,
  favicon_url TEXT,
  login_logo_url TEXT,
  background_image_url TEXT,
  primary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  sidebar_background_color TEXT NOT NULL,
  banner_color TEXT NOT NULL,
  login_message TEXT NOT NULL,
  footer_text TEXT NOT NULL,
  enable_background_blur INTEGER NOT NULL DEFAULT 1,
  enable_background_overlay INTEGER NOT NULL DEFAULT 1,
  show_powered_by_regovise INTEGER NOT NULL DEFAULT 1,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
