PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS field_parity_models (
  model_key TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  field_count INTEGER NOT NULL,
  field_names_json TEXT NOT NULL,
  schema_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_parity_models_count
  ON field_parity_models (field_count DESC, model_key);

CREATE TABLE IF NOT EXISTS field_parity_records (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  record_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  command_type TEXT NOT NULL,
  data_json TEXT,
  data_ref TEXT,
  data_size_bytes INTEGER NOT NULL DEFAULT 0,
  parity_status TEXT NOT NULL,
  missing_fields_json TEXT NOT NULL DEFAULT '[]',
  extra_fields_json TEXT NOT NULL DEFAULT '[]',
  field_count INTEGER NOT NULL DEFAULT 0,
  updated_by_command_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, model_key, record_id),
  FOREIGN KEY(model_key) REFERENCES field_parity_models(model_key)
);

CREATE INDEX IF NOT EXISTS idx_field_parity_records_status
  ON field_parity_records (tenant_id, model_key, parity_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_parity_records_command
  ON field_parity_records (tenant_id, command_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS field_parity_field_index (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  value_type TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  value_bool INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, model_key, record_id, field_path)
);

CREATE INDEX IF NOT EXISTS idx_field_parity_field_lookup
  ON field_parity_field_index (tenant_id, model_key, field_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_parity_field_value_text
  ON field_parity_field_index (tenant_id, model_key, value_text);

CREATE INDEX IF NOT EXISTS idx_field_parity_field_value_number
  ON field_parity_field_index (tenant_id, model_key, value_number);
