export type ImportStep = {
  key: string;
  label: string;
  status: 'pending' | 'completed' | 'failed';
  detail?: string | null;
};

export type ImportCreatedObject = {
  id: string;
  name: string;
};

export type ImportJob = {
  id: string;
  tenantId: string;
  folderId: string;
  folderName: string;
  createdByUserId: string | null;
  name: string;
  sourceType: string;
  targetKind: string;
  status: string;
  rowCount: number;
  importedCount: number;
  errorCount: number;
  steps: ImportStep[];
  summary: Record<string, unknown>;
  createdObjects: ImportCreatedObject[];
  createdAt: string;
  updatedAt: string;
};
