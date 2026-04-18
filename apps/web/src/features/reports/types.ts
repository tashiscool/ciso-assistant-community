export type ReportCatalogItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tags: string[];
};

export type ReportExport = {
  id: string;
  tenantId: string;
  folderId: string | null;
  folderName: string | null;
  createdByUserId: string | null;
  reportId: string;
  name: string;
  format: string;
  status: string;
  filters: Record<string, string | null>;
  summary: Record<string, unknown>;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  downloadPath: string;
};

export type DoraLintResult = {
  severity: 'error' | 'warning' | 'info' | 'ok';
  category: string;
  message: string;
  field?: string;
  object_type?: string;
  object_id?: string;
};

export type DoraLintPayload = {
  summary: {
    errors: number;
    warnings: number;
    info: number;
    ok: number;
  };
  results: DoraLintResult[];
  available_identifiers: Array<{
    type: string;
    value: string;
    label: string;
  }>;
  entity_country: string;
  competent_authority: string;
};
