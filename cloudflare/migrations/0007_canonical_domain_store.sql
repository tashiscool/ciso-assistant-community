PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS canonical_model_registry (
  model_key TEXT PRIMARY KEY,
  app_label TEXT NOT NULL,
  model_name TEXT NOT NULL,
  db_table TEXT NOT NULL,
  source_module TEXT NOT NULL,
  source_file TEXT NOT NULL,
  pk_field TEXT NOT NULL,
  field_names_json TEXT NOT NULL DEFAULT '[]',
  relation_fields_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canonical_model_registry_app
  ON canonical_model_registry (app_label, model_name);

CREATE TABLE IF NOT EXISTS canonical_route_registry (
  route_path TEXT PRIMARY KEY,
  route_kind TEXT NOT NULL,
  source_module TEXT NOT NULL,
  target_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canonical_route_registry_module
  ON canonical_route_registry (source_module, route_kind, route_path);

CREATE TABLE IF NOT EXISTS canonical_domain_state (
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'updated',
  state_json TEXT,
  state_ref TEXT,
  state_size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  folder_id TEXT,
  owner_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, domain, entity_id),
  FOREIGN KEY (model_key) REFERENCES canonical_model_registry(model_key)
);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_state_model
  ON canonical_domain_state (tenant_id, model_key, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_state_status
  ON canonical_domain_state (tenant_id, domain, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_state_deleted
  ON canonical_domain_state (tenant_id, domain, deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS canonical_domain_relations (
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relation_name TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  target_model_key TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, domain, entity_id, relation_name, target_entity_id),
  FOREIGN KEY (tenant_id, domain, entity_id)
    REFERENCES canonical_domain_state(tenant_id, domain, entity_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_relations_target
  ON canonical_domain_relations (tenant_id, target_entity_id, relation_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS canonical_domain_field_index (
  tenant_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  field_path TEXT NOT NULL,
  value_type TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_bool INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, domain, entity_id, field_path),
  FOREIGN KEY (tenant_id, domain, entity_id)
    REFERENCES canonical_domain_state(tenant_id, domain, entity_id)
    ON DELETE CASCADE,
  FOREIGN KEY (model_key) REFERENCES canonical_model_registry(model_key)
);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_field_lookup
  ON canonical_domain_field_index (tenant_id, domain, field_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_field_text
  ON canonical_domain_field_index (tenant_id, domain, field_path, value_text);

CREATE INDEX IF NOT EXISTS idx_canonical_domain_field_number
  ON canonical_domain_field_index (tenant_id, domain, field_path, value_number);
