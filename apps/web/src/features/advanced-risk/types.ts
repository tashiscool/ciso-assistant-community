export type EbiosWorkshopStep = {
  id: string;
  label: string;
  status: 'to_do' | 'in_progress' | 'done';
};

export type EbiosWorkshop = {
  id: string;
  label: string;
  steps: EbiosWorkshopStep[];
};

export type EbiosFearedEvent = {
  id: string;
  name: string;
  gravity: number;
  assets: string[];
};

export type EbiosStakeholder = {
  id: string;
  name: string;
  category: string;
  dependency: number;
};

export type EbiosStrategicScenario = {
  id: string;
  name: string;
  attacker: string;
  priority: number;
};

export type EbiosOperationalScenario = {
  id: string;
  name: string;
  likelihood: number;
  impact: number;
  attackPath: string[];
};

export type EbiosStudy = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  perimeterId: string | null;
  perimeterName: string | null;
  referenceEntityId: string | null;
  referenceEntityName: string | null;
  refId: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  quotationMethod: string;
  riskMatrixName: string | null;
  observation: string | null;
  workshops: EbiosWorkshop[];
  fearedEvents: EbiosFearedEvent[];
  stakeholders: EbiosStakeholder[];
  strategicScenarios: EbiosStrategicScenario[];
  operationalScenarios: EbiosOperationalScenario[];
  metrics: {
    workshopProgress: number;
    fearedEvents: number;
    stakeholders: number;
    strategicScenarios: number;
    operationalScenarios: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type QuantitativeHypothesis = {
  id: string;
  name: string;
  riskStage: 'inherent' | 'current' | 'residual';
  probability: number;
  impactLow: number;
  impactHigh: number;
  ale: number;
  isSelected: boolean;
};

export type QuantitativeScenario = {
  id: string;
  refId: string;
  name: string;
  description: string | null;
  status: string;
  currentAle: number;
  residualAle: number;
  ownerName: string | null;
  treatmentStrategy: string | null;
  treatmentCost: number | null;
  hypotheses: QuantitativeHypothesis[];
};

export type QuantitativeAction = {
  id: string;
  title: string;
  ownerName: string | null;
  status: string;
  annualCost: number | null;
  scenarioId: string;
  scenarioName: string;
};

export type QuantitativeStudy = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  riskRegisterId: string | null;
  riskRegisterName: string | null;
  refId: string | null;
  name: string;
  description: string | null;
  version: string;
  status: string;
  distributionModel: string;
  currency: string;
  lossThreshold: number | null;
  observation: string | null;
  riskTolerance: Record<string, unknown>;
  portfolio: Record<string, unknown>;
  scenarios: QuantitativeScenario[];
  actionPlan: QuantitativeAction[];
  metrics: {
    currency: string;
    currentAleCombined: number;
    residualAleCombined: number;
    riskReduction: number;
    scenariosAboveThreshold: number;
    totalScenarios: number;
  };
  createdAt: string;
  updatedAt: string;
};
