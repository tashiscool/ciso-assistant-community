export type PortalRequirement = {
  id: string;
  ref: string;
  title: string;
  question: string;
  assessable: boolean;
  result: string;
  response: string | null;
  observation: string | null;
  evidenceNote: string | null;
};

export type PortalEvent = {
  id: string;
  eventType: string;
  actorName: string;
  note: string | null;
  createdAt: string;
};

export type PortalAssignment = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  complianceAssessmentId: string | null;
  complianceAssessmentName: string | null;
  entityId: string | null;
  entityName: string | null;
  refId: string | null;
  name: string;
  frameworkName: string | null;
  actorName: string | null;
  actorEmail: string | null;
  status: string;
  dueDate: string | null;
  submittedAt: string | null;
  observation: string | null;
  requirements: PortalRequirement[];
  events: PortalEvent[];
  totalRequirements: number;
  assessedRequirements: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
};
