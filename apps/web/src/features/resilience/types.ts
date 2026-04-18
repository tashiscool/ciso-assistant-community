export type RecoveryMatrixLevel = {
  label: string;
  score: number;
  tone: string;
};

export type EscalationThreshold = {
  pointInTime: number;
  humanPit: string;
  label: string;
  hexColor: string;
  qualiImpact: number;
  quantiImpact: number | null;
  quantiImpactUnit: string | null;
  justification: string | null;
};

export type BiaAssetAssessment = {
  id: string;
  assetName: string;
  folderName: string;
  dependencies: string[];
  associatedControls: string[];
  recoveryDocumented: boolean;
  recoveryTested: boolean;
  recoveryTargetsMet: boolean;
  observation: string | null;
  thresholds: EscalationThreshold[];
};

export type BusinessImpactAnalysis = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  perimeterId: string | null;
  perimeterName: string | null;
  refId: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  observation: string | null;
  riskMatrixName: string | null;
  riskMatrix: {
    levels: RecoveryMatrixLevel[];
  };
  assetAssessments: BiaAssetAssessment[];
  metrics: {
    documentation: number;
    tests: number;
    objectives: number;
  };
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};
