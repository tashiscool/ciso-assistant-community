-- 0029_risk_register_folder_scope.sql
-- Make risk registers explicitly domain-scoped so risk routes can enforce row-level access.

PRAGMA foreign_keys = ON;

ALTER TABLE risk_registers ADD COLUMN folder_id TEXT;

CREATE INDEX IF NOT EXISTS idx_risk_registers_tenant_folder
  ON risk_registers (tenant_id, folder_id);

UPDATE risk_registers
SET folder_id = (
  SELECT assessment.folder_id
  FROM risk_assessments AS assessment
  WHERE assessment.risk_register_id = risk_registers.id
  ORDER BY assessment.updated_at DESC, assessment.created_at DESC
  LIMIT 1
)
WHERE folder_id IS NULL;
