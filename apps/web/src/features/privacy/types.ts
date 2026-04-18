export type NamedReference = {
  id: string;
  name: string;
};

export type ProcessingPurpose = {
  id: string;
  name: string;
  legalBasis: string;
  article9Condition: string | null;
};

export type ProcessingPersonalData = {
  id: string;
  name: string;
  category: string;
  retention: string | null;
  deletionPolicy: string | null;
  isSensitive: boolean;
};

export type ProcessingSubject = {
  id: string;
  name: string;
  category: string;
};

export type ProcessingRecipient = {
  id: string;
  name: string;
  category: string;
};

export type ProcessingContractor = {
  id: string;
  name: string;
  relationshipType: string;
  country: string | null;
  documentationLink: string | null;
  entity: NamedReference | null;
};

export type ProcessingTransfer = {
  id: string;
  name: string;
  country: string | null;
  transferMechanism: string | null;
  guarantees: string | null;
  documentationLink: string | null;
  entity: NamedReference | null;
};

export type Processing = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  refId: string | null;
  name: string;
  description: string | null;
  status: string;
  informationChannel: string | null;
  usageChannel: string | null;
  dpiaRequired: boolean;
  dpiaReference: string | null;
  hasSensitivePersonalData: boolean;
  perimeters: NamedReference[];
  purposes: ProcessingPurpose[];
  personalData: ProcessingPersonalData[];
  dataSubjects: ProcessingSubject[];
  dataRecipients: ProcessingRecipient[];
  dataContractors: ProcessingContractor[];
  dataTransfers: ProcessingTransfer[];
  purposeCount: number;
  personalDataCount: number;
  subjectCount: number;
  contractorCount: number;
  transferCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RightRequest = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  refId: string | null;
  name: string;
  requestedOn: string;
  dueDate: string | null;
  requestType: string;
  status: string;
  observation: string | null;
  processings: NamedReference[];
  createdAt: string;
  updatedAt: string;
};

export type DataBreach = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  refId: string | null;
  name: string;
  discoveredOn: string;
  breachType: string;
  riskLevel: string;
  status: string;
  affectedSubjectsCount: number;
  affectedPersonalDataCount: number;
  affectedProcessings: NamedReference[];
  authorityNotifiedOn: string | null;
  subjectsNotifiedOn: string | null;
  potentialConsequences: string | null;
  observation: string | null;
  createdAt: string;
  updatedAt: string;
};
