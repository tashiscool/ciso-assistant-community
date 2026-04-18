CREATE TABLE IF NOT EXISTS setup_general_configs (
  tenant_id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL,
  workspace_label TEXT NOT NULL,
  timezone TEXT NOT NULL,
  locale TEXT NOT NULL,
  date_format TEXT NOT NULL,
  fiscal_year_start_month TEXT NOT NULL,
  default_due_time TEXT NOT NULL,
  default_reviewer_team TEXT NOT NULL,
  working_days_json TEXT NOT NULL,
  change_freeze_enabled INTEGER NOT NULL DEFAULT 0,
  change_freeze_window TEXT,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS setup_risk_models (
  tenant_id TEXT PRIMARY KEY,
  model_type TEXT NOT NULL,
  likelihood_scale INTEGER NOT NULL,
  impact_scale INTEGER NOT NULL,
  acceptable_max INTEGER NOT NULL,
  monitor_max INTEGER NOT NULL,
  mitigate_max INTEGER NOT NULL,
  formula_preset TEXT NOT NULL,
  residual_risk_method TEXT NOT NULL,
  inherited_risk_method TEXT NOT NULL,
  risk_owner_role TEXT NOT NULL,
  auto_escalation_enabled INTEGER NOT NULL DEFAULT 0,
  auto_escalation_threshold TEXT NOT NULL,
  auto_escalation_days INTEGER NOT NULL,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
