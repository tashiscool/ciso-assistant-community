import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { MODULE_CATALOG } from '../core/moduleRegistry';

type ExportStatus = 'Active' | 'Inactive';
type ExportModule = string;
type ExportType = 'DOCX' | 'XLSX';
type RenderType =
  | 'Text'
  | 'RTF / HTML'
  | 'Date (MM/DD/YYYY)'
  | 'Date (YYYY-MM-DD)'
  | 'Checkbox'
  | 'Checkbox YES/NO'
  | 'File Name'
  | 'Image';

type TemplateAnalysis = {
  fileName: string;
  format: ExportType;
  tagsFound: number;
  mappedTags: number;
  unmappedTags: number;
  repeatedTags: number;
  tablesDetected: number;
  extractionMode: 'content-scan' | 'heuristic-seed';
  issues: string[];
};

type MappingRow = {
  id: string;
  tag: string;
  fieldPath: string | null;
  fieldNodeId: string | null;
  renderType: RenderType;
  confidence: number;
  tableRegion: string;
  repeated: boolean;
  accepted: boolean;
};

type FilterRow = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type SubTemplate = {
  id: string;
  title: string;
  fileName: string;
  status: string;
  analysis: TemplateAnalysis;
  mappings: MappingRow[];
};

type FieldCatalogNode = {
  id: string;
  name: string;
  path?: string;
  helper?: string;
  fieldType?: string;
  children?: FieldCatalogNode[];
};

type StarterTemplate = {
  id: string;
  title: string;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string;
  kind: 'system' | 'custom';
  defaultFileName: string;
  defaultTags: string[];
};

type ExportBuilderRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  module: string;
  export_group: string;
  export_type: string;
  description: string | null;
  template_file_name: string | null;
  template_analysis_json: string;
  mappings_json: string;
  filter_rows_json: string;
  filter_expression: string | null;
  sub_templates_json: string;
  source_template_id: string | null;
  source_kind: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type ExportBuilderTestRunRow = {
  id: string;
  scenario_name: string;
  status: string;
  result_json: string;
  created_by_user_id: string | null;
  created_at: string;
};

type ExportBuilderSummary = {
  id: string;
  title: string;
  status: ExportStatus;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string | null;
  lastUpdated: string;
  mappings: number;
  tags: number;
  sourceKind: 'system' | 'custom';
};

type ExportBuilderTestRun = {
  id: string;
  scenarioName: string;
  status: string;
  result: {
    mappedTags: number;
    unmappedTags: number;
    repeatedTags: number;
    previewLines: string[];
    generatedArtifactName: string;
  };
  createdByUserId: string | null;
  createdAt: string;
};

type ExportBuilderDetail = {
  id: string;
  title: string;
  status: ExportStatus;
  module: ExportModule;
  exportGroup: string;
  exportType: ExportType;
  description: string | null;
  templateFileName: string | null;
  templateAnalysis: TemplateAnalysis;
  mappings: MappingRow[];
  filterRows: FilterRow[];
  filterExpression: string;
  subTemplates: SubTemplate[];
  sourceTemplateId: string | null;
  sourceKind: 'system' | 'custom';
  fieldCatalog: FieldCatalogNode[];
  starterTemplates: StarterTemplate[];
  testRuns: ExportBuilderTestRun[];
  createdAt: string;
  updatedAt: string;
};

type CreateExportInput = {
  title?: string;
  starterTemplateId?: string | null;
};

type SaveExportInput = {
  title?: string;
  status?: ExportStatus;
  module?: ExportModule;
  exportGroup?: string;
  exportType?: ExportType;
  description?: string | null;
  templateFileName?: string | null;
  templateAnalysis?: TemplateAnalysis;
  mappings?: MappingRow[];
  filterRows?: FilterRow[];
  filterExpression?: string;
  subTemplates?: SubTemplate[];
};

type AnalyzeTemplateInput = {
  fileName?: string;
  content?: string;
  subTemplateId?: string | null;
};

type AutoMapInput = {
  mappings?: MappingRow[];
};

type ImportMappingsInput = {
  mappings?: MappingRow[];
  filterRows?: FilterRow[];
  filterExpression?: string;
};

type TestExportInput = {
  scenarioName?: string;
};

type FlatFieldNode = {
  id: string;
  path: string;
  name: string;
  fieldType: string;
};

function nowIso() {
  return new Date().toISOString();
}

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function requireTenant(ctx: WorkerRequestContext): string | Response {
  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }
  return ctx.tenantId;
}

function requireUser(ctx: WorkerRequestContext): string | Response {
  if (!ctx.userId) {
    return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
  }
  return ctx.userId;
}

const fieldCatalog: FieldCatalogNode[] = [
  {
    id: 'security-plan',
    name: 'Security Plan',
    helper: 'Primary module fields used in SSP, SAP, SAR, and evidence-ready exports.',
    children: [
      {
        id: 'security-plan-core',
        name: 'Core Metadata',
        children: [
          { id: 'field-plan-name', name: 'Plan Name', path: 'Security Plan.Plan Name', fieldType: 'Text', helper: 'Reusable plan title for registers, coversheets, and document indexes.' },
          { id: 'field-system-name', name: 'System Name', path: 'Security Plan.System Name', fieldType: 'Text', helper: 'Canonical title used in narrative exports.' },
          { id: 'field-other-identifier', name: 'Other Identifier', path: 'Security Plan.Other Identifier', fieldType: 'Text', helper: 'Supports alternate IDs, package codes, and external system references.' },
          { id: 'field-plan-status', name: 'Status', path: 'Security Plan.Status', fieldType: 'Text', helper: 'Lifecycle state for plan summaries and cover sheets.' },
          { id: 'field-system-type', name: 'System Type', path: 'Security Plan.System Type', fieldType: 'Text', helper: 'Commonly used in SSP system overview sections.' },
          { id: 'field-risk-maturity-level', name: 'Risk Maturity Level', path: 'Security Plan.Risk Maturity Level', fieldType: 'Text', helper: 'Semantic parity with imported plan rollups and dashboards.' },
          { id: 'field-facility', name: 'Facility', path: 'Security Plan.Facility', fieldType: 'Text', helper: 'Facility or location reference attached to the plan.' },
          { id: 'field-organization', name: 'Organization', path: 'Security Plan.Organization', fieldType: 'Text', helper: 'Owning business unit or organization label.' },
          { id: 'field-description', name: 'Description', path: 'Security Plan.Description', fieldType: 'Text', helper: 'Narrative summary of the system or boundary.' },
          { id: 'field-authorization-date', name: 'Authorization Date', path: 'Security Plan.Authorization Date', fieldType: 'Date', helper: 'Supports formatted date rendering.' },
          { id: 'field-ato-date', name: 'ATO Date', path: 'Security Plan.ATO Date', fieldType: 'Date', helper: 'Common authorization shorthand used in system registers.' },
          { id: 'field-ato-expiration', name: 'ATO Expiration', path: 'Security Plan.ATO Expiration', fieldType: 'Date', helper: 'Expiration or reauthorization due date for exports.' },
          { id: 'field-fips-category', name: 'FIPS Category', path: 'Security Plan.FIPS Category', fieldType: 'Text', helper: 'Categorization alias used in some plan templates.' },
          { id: 'field-categorization', name: 'Categorization', path: 'Security Plan.System Categorization', fieldType: 'Text', helper: 'Required by FedRAMP narrative packages.' },
          { id: 'field-owner-name', name: 'System Owner Name', path: 'Security Plan.System Owner.Name', fieldType: 'Person', helper: 'Supports person-display formatting.' },
          { id: 'field-owner-email', name: 'System Owner Email', path: 'Security Plan.System Owner.Email', fieldType: 'Text', helper: 'Useful for signatures and cover pages.' },
          { id: 'field-created-at', name: 'Created At', path: 'Security Plan.Created At', fieldType: 'Date', helper: 'System-maintained creation timestamp for audit-ready exports.' },
          { id: 'field-updated-at', name: 'Updated At', path: 'Security Plan.Updated At', fieldType: 'Date', helper: 'System-maintained last updated timestamp for audit-ready exports.' },
        ],
      },
      {
        id: 'security-plan-implementation',
        name: 'Implementation',
        children: [
          { id: 'field-implementation-statement', name: 'Implementation Statement', path: 'Control Implementation.Statement', fieldType: 'RTF / HTML', helper: 'Rich text output with HTML-to-Word rendering.' },
          { id: 'field-control-id', name: 'Control Id', path: 'Control Implementation.Control Id', fieldType: 'Text', helper: 'Repeating table key for appendix rows.' },
          { id: 'field-control-title', name: 'Control Title', path: 'Control Implementation.Title', fieldType: 'Text', helper: 'Human-readable control caption.' },
          { id: 'field-evidence-count', name: 'Evidence Count', path: 'Control Implementation.Evidence Count', fieldType: 'Number', helper: 'Useful for evidence-coverage summaries.' },
        ],
      },
    ],
  },
  {
    id: 'security-controls',
    name: 'Security Controls',
    helper: 'Reusable control register fields for control catalogs, matrices, and implementation summaries.',
    children: [
      {
        id: 'security-controls-core',
        name: 'Control Register',
        children: [
          { id: 'field-sc-control-id', name: 'Control Id', path: 'Security Controls.Control Id', fieldType: 'Text', helper: 'Primary control key for matrices and control worksheets.' },
          { id: 'field-sc-title', name: 'Title', path: 'Security Controls.Title', fieldType: 'Text', helper: 'Human-readable control caption.' },
          { id: 'field-sc-family', name: 'Family', path: 'Security Controls.Family', fieldType: 'Text', helper: 'Control family or domain label.' },
          { id: 'field-sc-implementation-status', name: 'Implementation Status', path: 'Security Controls.Implementation Status', fieldType: 'Text', helper: 'Implemented / partial / planned style status output.' },
          { id: 'field-sc-responsible-role', name: 'Responsible Role', path: 'Security Controls.Responsible Role', fieldType: 'Text', helper: 'Role or owner responsible for the control implementation.' },
          { id: 'field-sc-description', name: 'Description', path: 'Security Controls.Description', fieldType: 'Text', helper: 'Narrative description for export-ready control detail.' },
          { id: 'field-sc-guidance', name: 'Guidance', path: 'Security Controls.Guidance', fieldType: 'RTF / HTML', helper: 'Framework notes or internal control guidance.' },
          { id: 'field-sc-test-procedure', name: 'Test Procedure', path: 'Security Controls.Test Procedure', fieldType: 'RTF / HTML', helper: 'Reusable assessor steps and verification guidance.' },
          { id: 'field-sc-assessment-status', name: 'Assessment Status', path: 'Security Controls.Assessment Status', fieldType: 'Text', helper: 'Satisfied / not assessed / other than satisfied.' },
          { id: 'field-sc-last-assessed', name: 'Last Assessed', path: 'Security Controls.Last Assessed', fieldType: 'Date', helper: 'Most recent assessment date for the control.' },
          { id: 'field-sc-evidence-count', name: 'Evidence Count', path: 'Security Controls.Evidence Count', fieldType: 'Number', helper: 'Evidence coverage count for exports and matrices.' },
        ],
      },
    ],
  },
  {
    id: 'master-assessment',
    name: 'Master Assessment',
    helper: 'Assessment-context routing values for SAP and SAR packages.',
    children: [
      {
        id: 'master-assessment-core',
        name: 'Assessment Context',
        children: [
          { id: 'field-master-assessment-id', name: 'Master Assessment Id', path: 'masterAssessment.id', fieldType: 'Text', helper: 'Back-end routing key for assessment-aware exports.' },
          { id: 'field-master-assessment-title', name: 'Master Assessment Title', path: 'masterAssessment.title', fieldType: 'Text', helper: 'Used for SAP / SAR contextual export mode.' },
          { id: 'field-master-assessment-updated', name: 'Items Date Last Updated', path: 'masterAssessment.items.dateLastUpdated', fieldType: 'Date', helper: 'Useful in appendix and activity-summary sections.' },
        ],
      },
    ],
  },
  {
    id: 'supporting-data',
    name: 'Supporting Data',
    helper: 'Assets, risks, files, and related record collections.',
    children: [
      {
        id: 'supporting-assets',
        name: 'Assets',
        children: [
          { id: 'field-asset-id', name: 'Asset Id', path: 'Assets.Asset Id', fieldType: 'Text', helper: 'Inventory key used in export tables and worksheets.' },
          { id: 'field-asset-name', name: 'Asset Name', path: 'Assets.Name', fieldType: 'Text', helper: 'Inventory and worksheet exports.' },
          { id: 'field-asset-type', name: 'Asset Type', path: 'Assets.Type', fieldType: 'Text', helper: 'Server, application, service, or platform type.' },
          { id: 'field-asset-ip', name: 'IP Address', path: 'Assets.IP Address', fieldType: 'Text', helper: 'Supports infrastructure inventory outputs.' },
          { id: 'field-asset-os', name: 'Operating System', path: 'Assets.Operating System', fieldType: 'Text', helper: 'Operating system or platform version.' },
          { id: 'field-asset-location', name: 'Location', path: 'Assets.Location', fieldType: 'Text', helper: 'Facility or deployment location label.' },
          { id: 'field-asset-owner', name: 'Asset Owner', path: 'Assets.Owner.Name', fieldType: 'Person', helper: 'Owner columns in inventory worksheets.' },
          { id: 'field-asset-classification', name: 'Classification', path: 'Assets.Classification', fieldType: 'Text', helper: 'Sensitivity or handling classification.' },
          { id: 'field-asset-status', name: 'Status', path: 'Assets.Status', fieldType: 'Text', helper: 'Lifecycle state for inventory exports.' },
        ],
      },
      {
        id: 'supporting-risks',
        name: 'Risks',
        children: [
          { id: 'field-risk-id', name: 'Risk Id', path: 'Risks.Risk Id', fieldType: 'Text', helper: 'Primary key for risk registers and treatment plans.' },
          { id: 'field-risk-title', name: 'Title', path: 'Risks.Title', fieldType: 'Text', helper: 'Short risk label used in summaries and exports.' },
          { id: 'field-risk-likelihood', name: 'Likelihood', path: 'Risks.Likelihood', fieldType: 'Text', helper: 'Likelihood or probability value from the configured model.' },
          { id: 'field-risk-impact', name: 'Impact', path: 'Risks.Impact', fieldType: 'Text', helper: 'Impact or consequence value from the configured model.' },
          { id: 'field-risk-level', name: 'Risk Level', path: 'Risks.Risk Level', fieldType: 'Text', helper: 'Calculated or assigned risk rating.' },
          { id: 'field-risk-mitigation', name: 'Mitigation', path: 'Risks.Mitigation', fieldType: 'Text', helper: 'Primary mitigation or treatment narrative.' },
          { id: 'field-risk-status', name: 'Status', path: 'Risks.Status', fieldType: 'Text', helper: 'Open, accepted, mitigating, or closed state.' },
          { id: 'field-risk-owner', name: 'Owner', path: 'Risks.Owner.Name', fieldType: 'Person', helper: 'Owner display field for registers and accountability tables.' },
          { id: 'field-risk-due-date', name: 'Due Date', path: 'Risks.Due Date', fieldType: 'Date', helper: 'Target date for mitigation or review completion.' },
        ],
      },
      {
        id: 'supporting-files',
        name: 'Files & Images',
        children: [
          { id: 'field-boundary-file', name: 'Authorization Boundary File Name', path: 'Files.Authorization Boundary.File Name', fieldType: 'File Name', helper: 'File-name placeholder support.' },
          { id: 'field-boundary-image', name: 'Authorization Boundary Image', path: 'Files.Authorization Boundary.Image', fieldType: 'Image', helper: 'Best rendered inside a Word image placeholder.' },
        ],
      },
    ],
  },
];

const starterTemplates: StarterTemplate[] = [
  { id: 'starter-fedramp-ssp', title: 'FedRAMP Rev 5 SSP', module: 'Security Plans', exportGroup: 'FedRAMP Deliverables', exportType: 'DOCX', description: 'Narrative Security Plan export with system metadata and implementation sections.', kind: 'system', defaultFileName: 'fedramp-rev5-ssp.docx', defaultTags: ['{{system_name}}', '{{authorization_date}}', '{{system_owner.name}}', '{{categorization}}', '{{implementation_statement}}', '{{control_id}}', '{{control_title}}'] },
  { id: 'starter-fedramp-sap', title: 'FedRAMP Rev 5 SAP', module: 'Master Assessments', exportGroup: 'Assessment Deliverables', exportType: 'DOCX', description: 'Assessment-context plan document with master-assessment routing.', kind: 'system', defaultFileName: 'fedramp-rev5-sap.docx', defaultTags: ['{{masterAssessment.id}}', '{{masterAssessment.title}}', '{{masterAssessment.items.dateLastUpdated}}', '{{system_name}}', '{{system_owner.name}}'] },
  { id: 'starter-fedramp-sar', title: 'FedRAMP Rev 5 SAR', module: 'Master Assessments', exportGroup: 'Assessment Deliverables', exportType: 'DOCX', description: 'Security assessment report package with narrative and control findings sections.', kind: 'system', defaultFileName: 'fedramp-rev5-sar.docx', defaultTags: ['{{masterAssessment.title}}', '{{masterAssessment.items.dateLastUpdated}}', '{{control_id}}', '{{control_title}}', '{{implementation_statement}}'] },
  { id: 'starter-fedramp-appendix-a', title: 'FedRAMP Rev 5 Appendix A', module: 'Security Plans', exportGroup: 'Appendices', exportType: 'XLSX', description: 'Worksheet-oriented appendix for control, ownership, and evidence summaries.', kind: 'system', defaultFileName: 'fedramp-rev5-appendix-a.xlsx', defaultTags: ['{{asset_name}}', '{{asset_ip}}', '{{asset_owner}}', '{{evidence_count}}'] },
  { id: 'starter-fedramp-separation', title: 'FedRAMP Rev 5 Separation of Duties Matrix', module: 'Security Plans', exportGroup: 'Appendices', exportType: 'XLSX', description: 'Responsibility matrix for teams, controls, and approval roles.', kind: 'system', defaultFileName: 'fedramp-rev5-separation-of-duties.xlsx', defaultTags: ['{{system_owner.name}}', '{{control_id}}', '{{control_title}}'] },
  { id: 'starter-labs-ssp', title: 'LABS SSP', module: 'Security Plans', exportGroup: 'Starter Templates', exportType: 'DOCX', description: 'Internal starter narrative package for solution labs and early drafts.', kind: 'system', defaultFileName: 'labs-ssp.docx', defaultTags: ['{{system_name}}', '{{system_owner.name}}', '{{implementation_statement}}'] },
  { id: 'starter-controls-matrix', title: 'Security Controls Matrix', module: 'Security Controls', exportGroup: 'Control Deliverables', exportType: 'XLSX', description: 'Control implementation matrix with ownership, assessment, and evidence coverage fields.', kind: 'system', defaultFileName: 'security-controls-matrix.xlsx', defaultTags: ['{{control_id}}', '{{control_title}}', '{{implementation_status}}', '{{responsible_role}}', '{{assessment_status}}', '{{evidence_count}}'] },
  { id: 'starter-risk-register', title: 'Risk Register', module: 'Risks', exportGroup: 'Risk Deliverables', exportType: 'XLSX', description: 'Risk register export with scoring, ownership, mitigation, and due dates.', kind: 'system', defaultFileName: 'risk-register.xlsx', defaultTags: ['{{risk_id}}', '{{risk_title}}', '{{likelihood}}', '{{impact}}', '{{risk_level}}', '{{mitigation}}', '{{risk_owner}}', '{{due_date}}'] },
  { id: 'starter-asset-inventory', title: 'Asset Inventory', module: 'Assets', exportGroup: 'Inventory Deliverables', exportType: 'XLSX', description: 'Asset inventory export with ownership, platform, and classification details.', kind: 'system', defaultFileName: 'asset-inventory.xlsx', defaultTags: ['{{asset_id}}', '{{asset_name}}', '{{asset_type}}', '{{asset_ip}}', '{{asset_os}}', '{{asset_location}}', '{{asset_owner}}', '{{asset_classification}}', '{{asset_status}}'] },
];

function starterTemplateModuleName(moduleKey: string, pluralName: string): ExportModule {
  switch (moduleKey) {
    case 'catalogues':
      return 'Catalogues';
    case 'assessment-plans':
      return 'Assessment Plans';
    default:
      return pluralName;
  }
}

function buildGeneratedFieldCatalog(): FieldCatalogNode[] {
  return MODULE_CATALOG.filter((entry) => Array.isArray(entry.starterFields) && entry.starterFields.length > 0)
    .map((entry) => ({
      id: `catalog-${entry.moduleKey}`,
      name: entry.pluralName,
      helper: entry.description,
      children: [
        {
          id: `catalog-${entry.moduleKey}-core`,
          name: `${entry.moduleName} Register`,
          children: (entry.starterFields ?? []).map((field) => ({
            id: `field-${entry.moduleKey}-${field.systemName}`,
            name: field.displayName,
            path: `${starterTemplateModuleName(entry.moduleKey, entry.pluralName)}.${field.displayName}`,
            helper: field.helpText ?? `${field.displayName} field from the ${entry.pluralName.toLowerCase()} workspace.`,
            fieldType: field.fieldType,
          })),
        },
      ],
    }))
    .filter((node) => node.children?.[0]?.children?.length);
}

function buildGeneratedStarterTemplates(): StarterTemplate[] {
  return MODULE_CATALOG.filter((entry) => entry.implementationType !== 'subfeature' && Array.isArray(entry.starterFields) && entry.starterFields.length > 0)
    .map((entry) => ({
      id: `starter-${entry.moduleKey}-register`,
      title: `${entry.pluralName} Register`,
      module: starterTemplateModuleName(entry.moduleKey, entry.pluralName),
      exportGroup: `${entry.pluralName} Deliverables`,
      exportType: 'XLSX' as ExportType,
      description: `Register-style export starter for ${entry.pluralName.toLowerCase()} with seeded semantic data fields.`,
      kind: 'system' as const,
      defaultFileName: `${entry.moduleKey}-register.xlsx`,
      defaultTags: (entry.starterFields ?? []).slice(0, 8).map((field) => `{{${field.systemName}}}`),
    }))
    .filter((template) => template.defaultTags.length > 0);
}

function flattenFieldCatalog(nodes: FieldCatalogNode[]): FlatFieldNode[] {
  const flat: FlatFieldNode[] = [];
  for (const node of nodes) {
    if (node.path) {
      flat.push({
        id: node.id,
        path: node.path,
        name: node.name,
        fieldType: node.fieldType ?? 'Text',
      });
    }
    if (node.children?.length) {
      flat.push(...flattenFieldCatalog(node.children));
    }
  }
  return flat;
}

const mergedFieldCatalog = [
  ...fieldCatalog,
  ...buildGeneratedFieldCatalog().filter(
    (node) => !fieldCatalog.some((existing) => existing.name.toLowerCase() === node.name.toLowerCase()),
  ),
];

const mergedStarterTemplates = [
  ...starterTemplates,
  ...buildGeneratedStarterTemplates().filter(
    (template) => !starterTemplates.some((existing) => existing.id === template.id),
  ),
];

const flatFieldCatalog = flattenFieldCatalog(mergedFieldCatalog);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function renderTypeForFieldType(fieldType: string): RenderType {
  switch (fieldType) {
    case 'RTF / HTML':
      return 'RTF / HTML';
    case 'Date':
      return 'Date (MM/DD/YYYY)';
    case 'Image':
      return 'Image';
    case 'File Name':
      return 'File Name';
    default:
      return 'Text';
  }
}

function scoreFieldMatch(tag: string, field: FlatFieldNode): number {
  const cleanedTag = tag.replace(/[{}]/g, '');
  const tagParts = cleanedTag.split('|').pop() ?? cleanedTag;
  const tagTokens = tokenize(tagParts.replace(/[._-]+/g, ' '));
  const fieldTokens = tokenize(field.path);
  if (tagTokens.length === 0 || fieldTokens.length === 0) {
    return 0;
  }
  const tagJoined = tagTokens.join(' ');
  const fieldJoined = fieldTokens.join(' ');
  if (tagJoined === fieldJoined) {
    return 99;
  }
  const overlap = tagTokens.filter((token) => fieldTokens.includes(token)).length;
  let score = Math.round((overlap / Math.max(tagTokens.length, fieldTokens.length)) * 100);
  const lastFieldToken = fieldTokens[fieldTokens.length - 1];
  if (tagTokens[tagTokens.length - 1] === lastFieldToken) {
    score += 18;
  }
  if (fieldJoined.includes(tagJoined) || tagJoined.includes(fieldJoined)) {
    score += 14;
  }
  if (tagJoined.includes('masterassessment') && fieldJoined.includes('master assessment')) {
    score += 10;
  }
  return Math.min(score, 98);
}

function tableRegionForTag(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower.includes('asset')) {
    return 'Assets Table';
  }
  if (lower.includes('risk')) {
    return 'Risk Register';
  }
  if (lower.includes('control')) {
    return 'Control Matrix';
  }
  if (lower.includes('masterassessment')) {
    return 'Assessment Context';
  }
  return 'Document Body';
}

function autoMapTags(tags: string[]): MappingRow[] {
  return tags.map((tag) => {
    const best = flatFieldCatalog
      .map((field) => ({ field, score: scoreFieldMatch(tag, field) }))
      .sort((a, b) => b.score - a.score)[0];
    return {
      id: crypto.randomUUID(),
      tag,
      fieldPath: best?.score >= 48 ? best.field.path : null,
      fieldNodeId: best?.score >= 48 ? best.field.id : null,
      renderType: best?.score >= 48 ? renderTypeForFieldType(best.field.fieldType) : 'Text',
      confidence: best?.score ?? 0,
      tableRegion: tableRegionForTag(tag),
      repeated: tags.filter((candidate) => candidate === tag).length > 1,
      accepted: (best?.score ?? 0) >= 76,
    };
  });
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags));
}

function fallbackTagsFor(module: ExportModule, exportType: ExportType, fileName: string) {
  const lowerName = fileName.toLowerCase();
  const byStarter = mergedStarterTemplates.find(
    (template) =>
      template.module === module &&
      template.exportType === exportType &&
      lowerName.includes(template.defaultFileName.toLowerCase().replace(/\.(docx|xlsx)$/i, '').slice(0, 12)),
  );
  if (byStarter) {
    return byStarter.defaultTags;
  }
  if (module === 'Master Assessments') {
    return ['{{masterAssessment.id}}', '{{masterAssessment.title}}', '{{masterAssessment.items.dateLastUpdated}}', '{{system_name}}', '{{control_id}}'];
  }
  if (module === 'Security Controls') {
    return ['{{control_id}}', '{{control_title}}', '{{implementation_status}}', '{{responsible_role}}', '{{assessment_status}}', '{{evidence_count}}'];
  }
  if (module === 'Risks') {
    return ['{{risk_id}}', '{{risk_title}}', '{{likelihood}}', '{{impact}}', '{{risk_level}}', '{{mitigation}}', '{{risk_owner}}', '{{due_date}}'];
  }
  if (module === 'Assets') {
    return ['{{asset_id}}', '{{asset_name}}', '{{asset_type}}', '{{asset_ip}}', '{{asset_os}}', '{{asset_location}}', '{{asset_owner}}', '{{asset_classification}}', '{{asset_status}}'];
  }
  if (exportType === 'XLSX') {
    return ['{{asset_name}}', '{{asset_ip}}', '{{asset_owner}}', '{{evidence_count}}'];
  }
  return ['{{system_name}}', '{{authorization_date}}', '{{system_owner.name}}', '{{categorization}}', '{{implementation_statement}}'];
}

function analyzeTemplateInput(
  module: ExportModule,
  exportType: ExportType,
  fileName: string,
  content?: string,
): { analysis: TemplateAnalysis; mappings: MappingRow[] } {
  const extractedTags = uniqueTags(Array.from(content?.matchAll(/{{\s*([^{}]+)\s*}}/g) ?? []).map((match) => `{{${match[1].trim()}}}`));
  const tags = extractedTags.length > 0 ? extractedTags : fallbackTagsFor(module, exportType, fileName);
  const mappings = autoMapTags(tags);
  const repeatedTags = tags.length - uniqueTags(tags).length;
  const issues: string[] = [];
  let extractionMode: TemplateAnalysis['extractionMode'] = 'content-scan';
  if (extractedTags.length === 0) {
    extractionMode = 'heuristic-seed';
    issues.push('No explicit {{}} placeholders were detected from the uploaded content, so starter heuristics were used.');
  }
  if (mappings.some((mapping) => !mapping.fieldPath)) {
    issues.push('Some placeholders still need manual mapping before test generation.');
  }
  return {
    analysis: {
      fileName,
      format: exportType,
      tagsFound: tags.length,
      mappedTags: mappings.filter((mapping) => mapping.fieldPath).length,
      unmappedTags: mappings.filter((mapping) => !mapping.fieldPath).length,
      repeatedTags,
      tablesDetected: Math.max(1, new Set(mappings.map((mapping) => mapping.tableRegion)).size),
      extractionMode,
      issues,
    },
    mappings,
  };
}

function defaultAnalysis(fileName: string, exportType: ExportType): TemplateAnalysis {
  return {
    fileName,
    format: exportType,
    tagsFound: 0,
    mappedTags: 0,
    unmappedTags: 0,
    repeatedTags: 0,
    tablesDetected: 0,
    extractionMode: 'heuristic-seed',
    issues: ['Upload a DOCX or XLSX template to extract tags and prepare field mappings.'],
  };
}

function defaultFilterRows(): FilterRow[] {
  return [{ id: crypto.randomUUID(), field: 'status', operator: 'Equals', value: 'Active' }];
}

function seedExportRows() {
  return mergedStarterTemplates.slice(0, 3).map((template) => {
    const analyzed = analyzeTemplateInput(template.module, template.exportType, template.defaultFileName, template.defaultTags.join('\n'));
    return {
      title: template.title,
      status: template.id === 'starter-fedramp-sar' ? ('Inactive' as ExportStatus) : ('Active' as ExportStatus),
      module: template.module,
      exportGroup: template.exportGroup,
      exportType: template.exportType,
      description: template.description,
      templateFileName: template.defaultFileName,
      templateAnalysis: analyzed.analysis,
      mappings: analyzed.mappings,
      filterRows: defaultFilterRows(),
      filterExpression: '1',
      subTemplates:
        template.exportType === 'DOCX'
          ? [
              {
                id: crypto.randomUUID(),
                title: `${template.title} Appendix`,
                fileName: `${template.defaultFileName.replace(/\.docx$/i, '')}-appendix.docx`,
                status: 'Ready',
                analysis: analyzeTemplateInput(template.module, 'DOCX', `${template.title}-appendix.docx`, '{{control_id}}\n{{control_title}}').analysis,
                mappings: autoMapTags(['{{control_id}}', '{{control_title}}']),
              },
            ]
          : [],
      sourceTemplateId: template.id,
      sourceKind: template.kind,
    };
  });
}

async function ensureSeedExports(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  const row = await env.D1_MAIN.prepare(`SELECT COUNT(1) AS export_count FROM export_builder_exports WHERE tenant_id = ?`)
    .bind(tenantId)
    .first<{ export_count: number | null }>();
  if (Number(row?.export_count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const statements = seedExportRows().map((record) =>
    env.D1_MAIN.prepare(
      `INSERT INTO export_builder_exports (
        id, tenant_id, title, status, module, export_group, export_type, description,
        template_file_name, template_analysis_json, mappings_json, filter_rows_json,
        filter_expression, sub_templates_json, source_template_id, source_kind,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      tenantId,
      record.title,
      record.status,
      record.module,
      record.exportGroup,
      record.exportType,
      record.description,
      record.templateFileName,
      JSON.stringify(record.templateAnalysis),
      JSON.stringify(record.mappings),
      JSON.stringify(record.filterRows),
      record.filterExpression,
      JSON.stringify(record.subTemplates),
      record.sourceTemplateId,
      record.sourceKind,
      userId,
      userId,
      createdAt,
      createdAt,
    ),
  );
  await env.D1_MAIN.batch(statements);
}

function toSummary(row: ExportBuilderRow): ExportBuilderSummary {
  const analysis = asJson<TemplateAnalysis>(row.template_analysis_json, defaultAnalysis(row.template_file_name ?? 'template.docx', row.export_type as ExportType));
  const mappings = asJson<MappingRow[]>(row.mappings_json, []);
  return {
    id: row.id,
    title: row.title,
    status: row.status as ExportStatus,
    module: row.module as ExportModule,
    exportGroup: row.export_group,
    exportType: row.export_type as ExportType,
    description: row.description,
    lastUpdated: row.updated_at,
    mappings: mappings.length,
    tags: analysis.tagsFound,
    sourceKind: (row.source_kind as 'system' | 'custom') || 'custom',
  };
}

async function listTestRuns(env: WorkerRequestContext['env'], tenantId: string, exportId: string): Promise<ExportBuilderTestRun[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT id, scenario_name, status, result_json, created_by_user_id, created_at
       FROM export_builder_test_runs
      WHERE tenant_id = ? AND export_id = ?
      ORDER BY created_at DESC
      LIMIT 10`,
  )
    .bind(tenantId, exportId)
    .all<ExportBuilderTestRunRow>();
  return rows.results.map((row) => ({
    id: row.id,
    scenarioName: row.scenario_name,
    status: row.status,
    result: asJson<ExportBuilderTestRun['result']>(row.result_json, { mappedTags: 0, unmappedTags: 0, repeatedTags: 0, previewLines: [], generatedArtifactName: 'preview.docx' }),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  }));
}

async function getExportRow(env: WorkerRequestContext['env'], tenantId: string, exportId: string): Promise<ExportBuilderRow | null> {
  return env.D1_MAIN.prepare(`SELECT * FROM export_builder_exports WHERE tenant_id = ? AND id = ? LIMIT 1`)
    .bind(tenantId, exportId)
    .first<ExportBuilderRow>();
}

async function toDetail(env: WorkerRequestContext['env'], tenantId: string, row: ExportBuilderRow): Promise<ExportBuilderDetail> {
  return {
    id: row.id,
    title: row.title,
    status: row.status as ExportStatus,
    module: row.module as ExportModule,
    exportGroup: row.export_group,
    exportType: row.export_type as ExportType,
    description: row.description,
    templateFileName: row.template_file_name,
    templateAnalysis: asJson<TemplateAnalysis>(row.template_analysis_json, defaultAnalysis(row.template_file_name ?? 'template.docx', row.export_type as ExportType)),
    mappings: asJson<MappingRow[]>(row.mappings_json, []),
    filterRows: asJson<FilterRow[]>(row.filter_rows_json, []),
    filterExpression: row.filter_expression ?? '1',
    subTemplates: asJson<SubTemplate[]>(row.sub_templates_json, []),
    sourceTemplateId: row.source_template_id,
    sourceKind: (row.source_kind as 'system' | 'custom') || 'custom',
    fieldCatalog: mergedFieldCatalog,
    starterTemplates: mergedStarterTemplates,
    testRuns: await listTestRuns(env, tenantId, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateMappings(analysis: TemplateAnalysis, mappings: MappingRow[]) {
  const diagnostics: string[] = [];
  if (analysis.tagsFound === 0) {
    diagnostics.push('No template tags are currently available for mapping.');
  }
  if (mappings.some((mapping) => !mapping.tag.trim())) {
    diagnostics.push('Every mapping row must preserve a template tag.');
  }
  if (mappings.some((mapping) => mapping.fieldPath && !flatFieldCatalog.some((field) => field.path === mapping.fieldPath))) {
    diagnostics.push('One or more mapped Regovise field paths are not available in the canonical field catalog.');
  }
  return diagnostics;
}

export async function handleExportBuilderRoutes(segments: string[], ctx: WorkerRequestContext): Promise<Response> {
  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await ensureSeedExports(ctx.env, tenantId, ctx.userId);

  const [resource, id, action] = segments;
  if (resource !== 'exports') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      const rows = await ctx.env.D1_MAIN.prepare(`SELECT * FROM export_builder_exports WHERE tenant_id = ? ORDER BY updated_at DESC, title ASC`)
        .bind(tenantId)
        .all<ExportBuilderRow>();
      return json({ data: { exports: rows.results.map(toSummary), starterTemplates: mergedStarterTemplates, fieldCatalog: mergedFieldCatalog } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const body = await readJson<CreateExportInput>(ctx.request);
      const starter = mergedStarterTemplates.find((template) => template.id === body.starterTemplateId);
      const createdAt = nowIso();
      const exportId = crypto.randomUUID();
      const templateAnalysis = starter
        ? analyzeTemplateInput(starter.module, starter.exportType, starter.defaultFileName, starter.defaultTags.join('\n')).analysis
        : defaultAnalysis('template.docx', 'DOCX');
      const mappings = starter ? autoMapTags(starter.defaultTags) : [];
      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO export_builder_exports (
          id, tenant_id, title, status, module, export_group, export_type, description,
          template_file_name, template_analysis_json, mappings_json, filter_rows_json,
          filter_expression, sub_templates_json, source_template_id, source_kind,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          exportId,
          tenantId,
          body.title?.trim() || starter?.title || 'New Export',
          'Inactive',
          starter?.module || 'Security Plans',
          starter?.exportGroup || 'Custom Exports',
          starter?.exportType || 'DOCX',
          starter?.description || 'Custom canonical Export Builder definition.',
          starter?.defaultFileName || null,
          JSON.stringify(templateAnalysis),
          JSON.stringify(mappings),
          JSON.stringify(defaultFilterRows()),
          '1',
          JSON.stringify([]),
          starter?.id ?? null,
          starter?.kind ?? 'custom',
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();
      const row = await getExportRow(ctx.env, tenantId, exportId);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }, { status: 201 }) : json({ error: 'create_failed' }, { status: 500 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const row = await getExportRow(ctx.env, tenantId, id);
      return row ? json({ data: await toDetail(ctx.env, tenantId, row) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const current = await getExportRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Export Builder definition not found.' }, { status: 404 });
      }
      const body = await readJson<SaveExportInput>(ctx.request);
      const templateAnalysis = body.templateAnalysis ?? asJson<TemplateAnalysis>(current.template_analysis_json, defaultAnalysis(current.template_file_name ?? 'template.docx', current.export_type as ExportType));
      const mappings = body.mappings ?? asJson<MappingRow[]>(current.mappings_json, []);
      const diagnostics = validateMappings(templateAnalysis, mappings);
      if (diagnostics.length > 0) {
        templateAnalysis.issues = uniqueTags([...templateAnalysis.issues, ...diagnostics]);
      }
      templateAnalysis.mappedTags = mappings.filter((mapping) => mapping.fieldPath).length;
      templateAnalysis.unmappedTags = Math.max(templateAnalysis.tagsFound - templateAnalysis.mappedTags, 0);
      await ctx.env.D1_MAIN.prepare(
        `UPDATE export_builder_exports
            SET title = ?, status = ?, module = ?, export_group = ?, export_type = ?, description = ?,
                template_file_name = ?, template_analysis_json = ?, mappings_json = ?, filter_rows_json = ?,
                filter_expression = ?, sub_templates_json = ?, updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.title?.trim() || current.title,
          body.status || current.status,
          body.module || current.module,
          body.exportGroup?.trim() || current.export_group,
          body.exportType || current.export_type,
          body.description ?? current.description,
          body.templateFileName ?? current.template_file_name,
          JSON.stringify(templateAnalysis),
          JSON.stringify(mappings),
          JSON.stringify(body.filterRows ?? asJson<FilterRow[]>(current.filter_rows_json, [])),
          body.filterExpression ?? current.filter_expression ?? '1',
          JSON.stringify(body.subTemplates ?? asJson<SubTemplate[]>(current.sub_templates_json, [])),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();
      const updated = await getExportRow(ctx.env, tenantId, id);
      return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'DELETE') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      await ctx.env.D1_MAIN.prepare(`DELETE FROM export_builder_test_runs WHERE tenant_id = ? AND export_id = ?`).bind(tenantId, id).run();
      await ctx.env.D1_MAIN.prepare(`DELETE FROM export_builder_exports WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).run();
      return json({ data: { deleted: true } });
    }

    return methodNotAllowed(['GET', 'PUT', 'DELETE']);
  }

  if (action === 'analyze-template') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<AnalyzeTemplateInput>(ctx.request);
    const fileName = body.fileName?.trim();
    if (!fileName) {
      return json({ error: 'invalid_template', message: 'fileName is required for template analysis.' }, { status: 400 });
    }
    const exportType = (fileName.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'DOCX') as ExportType;
    const analyzed = analyzeTemplateInput(current.module as ExportModule, exportType, fileName, body.content);
    const subTemplates = asJson<SubTemplate[]>(current.sub_templates_json, []);

    if (body.subTemplateId) {
      const updatedSubTemplates = subTemplates.map((template) =>
        template.id === body.subTemplateId
          ? { ...template, fileName, status: 'Analyzed', analysis: analyzed.analysis, mappings: analyzed.mappings }
          : template,
      );
      await ctx.env.D1_MAIN.prepare(`UPDATE export_builder_exports SET sub_templates_json = ?, updated_by_user_id = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
        .bind(JSON.stringify(updatedSubTemplates), userIdOrResponse, nowIso(), tenantId, id)
        .run();
    } else {
      await ctx.env.D1_MAIN.prepare(
        `UPDATE export_builder_exports
            SET export_type = ?, template_file_name = ?, template_analysis_json = ?, mappings_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(exportType, fileName, JSON.stringify(analyzed.analysis), JSON.stringify(analyzed.mappings), userIdOrResponse, nowIso(), tenantId, id)
        .run();
    }
    const updated = await getExportRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'auto-map') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<AutoMapInput>(ctx.request);
    const currentMappings = body.mappings ?? asJson<MappingRow[]>(current.mappings_json, []);
    const remapped = autoMapTags(currentMappings.map((mapping) => mapping.tag));
    await ctx.env.D1_MAIN.prepare(`UPDATE export_builder_exports SET mappings_json = ?, updated_by_user_id = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
      .bind(JSON.stringify(remapped), userIdOrResponse, nowIso(), tenantId, id)
      .run();
    const updated = await getExportRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'import-mappings') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<ImportMappingsInput>(ctx.request);
    const templateAnalysis = asJson<TemplateAnalysis>(current.template_analysis_json, defaultAnalysis(current.template_file_name ?? 'template.docx', current.export_type as ExportType));
    const incomingMappings = body.mappings ?? [];
    const diagnostics = validateMappings(templateAnalysis, incomingMappings);
    if (incomingMappings.length === 0 || diagnostics.some((message) => message.includes('No template tags'))) {
      return json({ error: 'invalid_import', message: 'Imported mappings failed validation.', diagnostics }, { status: 400 });
    }
    templateAnalysis.mappedTags = incomingMappings.filter((mapping) => mapping.fieldPath).length;
    templateAnalysis.unmappedTags = Math.max(templateAnalysis.tagsFound - templateAnalysis.mappedTags, 0);
    await ctx.env.D1_MAIN.prepare(
      `UPDATE export_builder_exports
          SET mappings_json = ?, filter_rows_json = ?, filter_expression = ?, template_analysis_json = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
    )
      .bind(
        JSON.stringify(incomingMappings),
        JSON.stringify(body.filterRows ?? asJson<FilterRow[]>(current.filter_rows_json, [])),
        body.filterExpression ?? current.filter_expression ?? '1',
        JSON.stringify(templateAnalysis),
        userIdOrResponse,
        nowIso(),
        tenantId,
        id,
      )
      .run();
    const updated = await getExportRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'duplicate') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const duplicateId = crypto.randomUUID();
    const createdAt = nowIso();
    await ctx.env.D1_MAIN.prepare(
      `INSERT INTO export_builder_exports (
        id, tenant_id, title, status, module, export_group, export_type, description,
        template_file_name, template_analysis_json, mappings_json, filter_rows_json,
        filter_expression, sub_templates_json, source_template_id, source_kind,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        duplicateId,
        tenantId,
        `${current.title} Copy`,
        current.status,
        current.module,
        current.export_group,
        current.export_type,
        current.description,
        current.template_file_name,
        current.template_analysis_json,
        current.mappings_json,
        current.filter_rows_json,
        current.filter_expression,
        current.sub_templates_json,
        current.source_template_id,
        'custom',
        userIdOrResponse,
        userIdOrResponse,
        createdAt,
        createdAt,
      )
      .run();
    const duplicated = await getExportRow(ctx.env, tenantId, duplicateId);
    return duplicated ? json({ data: await toDetail(ctx.env, tenantId, duplicated) }, { status: 201 }) : json({ error: 'duplicate_failed' }, { status: 500 });
  }

  if (action === 'test') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<TestExportInput>(ctx.request);
    const detail = await toDetail(ctx.env, tenantId, current);
    const result = {
      mappedTags: detail.mappings.filter((mapping) => mapping.fieldPath).length,
      unmappedTags: detail.mappings.filter((mapping) => !mapping.fieldPath).length,
      repeatedTags: detail.mappings.filter((mapping) => mapping.repeated).length,
      previewLines: detail.mappings.slice(0, 4).map((mapping) => `${mapping.tag} -> ${mapping.fieldPath ?? 'UNMAPPED'}`),
      generatedArtifactName: `${detail.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${detail.exportType.toLowerCase()}`,
    };
    const runId = crypto.randomUUID();
    await ctx.env.D1_MAIN.prepare(
      `INSERT INTO export_builder_test_runs (
        id, export_id, tenant_id, scenario_name, status, result_json, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(runId, id, tenantId, body.scenarioName?.trim() || 'Default preview run', 'completed', JSON.stringify(result), userIdOrResponse, nowIso())
      .run();
    return json({ data: { runId, status: 'completed', result } });
  }

  if (action === 'sub-templates') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }
    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }
    const current = await getExportRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const body = await readJson<{ title?: string; fileName?: string; content?: string }>(ctx.request);
    const fileName = body.fileName?.trim();
    if (!fileName || !fileName.toLowerCase().endsWith('.docx')) {
      return json({ error: 'invalid_subtemplate', message: 'Sub templates currently require a DOCX file name.' }, { status: 400 });
    }
    const analyzed = analyzeTemplateInput(current.module as ExportModule, 'DOCX', fileName, body.content);
    const subTemplates = asJson<SubTemplate[]>(current.sub_templates_json, []);
    const nextSubTemplate: SubTemplate = {
      id: crypto.randomUUID(),
      title: body.title?.trim() || fileName.replace(/\.docx$/i, ''),
      fileName,
      status: 'Ready',
      analysis: analyzed.analysis,
      mappings: analyzed.mappings,
    };
    await ctx.env.D1_MAIN.prepare(`UPDATE export_builder_exports SET sub_templates_json = ?, updated_by_user_id = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
      .bind(JSON.stringify([...subTemplates, nextSubTemplate]), userIdOrResponse, nowIso(), tenantId, id)
      .run();
    const updated = await getExportRow(ctx.env, tenantId, id);
    return updated ? json({ data: await toDetail(ctx.env, tenantId, updated) }, { status: 201 }) : json({ error: 'not_found' }, { status: 404 });
  }

  return json({ error: 'unknown_builder_action', action }, { status: 404 });
}
