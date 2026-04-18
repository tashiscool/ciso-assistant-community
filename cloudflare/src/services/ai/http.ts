import type { WorkerRequestContext } from '../../router';
import { requireAnyPermission } from '../../authorization';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { handleResponseAutomationRoutes } from './responseAutomation';
import { handleEvidenceMappingRoutes } from './evidenceMapping';
import { handleRegmlRoutes } from './regml';

type PolicyBuilderStatus = 'Draft' | 'Running' | 'Finished';
type QueueSourceType = 'Profile' | 'Catalog';
type ComplianceExportFamily = 'RegScale' | 'OSCAL' | 'eMASS' | 'FedRAMP' | 'Word';
type ComplianceExportFormat = 'JSON' | 'XML' | 'Excel' | 'Word';
type ComplianceExportStatus = 'Ready' | 'Running' | 'Blocked';

type PolicyControl = {
  controlId: string;
  title: string;
  family: string;
  description: string;
};

type PolicyProfile = {
  id: string;
  label: string;
  description: string;
  catalogues: string[];
  controls: PolicyControl[];
};

type PolicyCatalogue = {
  name: string;
  controls: PolicyControl[];
};

type QueueItem = {
  id: string;
  sourceType: QueueSourceType;
  sourceName: string;
  controlId: string;
  title: string;
  family: string;
  description: string;
};

type CreatedRequirement = {
  id: string;
  sourceControlId: string;
  title: string;
  description: string;
  family: string | null;
  status: string;
  assignee: string | null;
  sourceName: string;
  createdAt: string;
};

type PolicyBuilderSessionRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  folder_name: string | null;
  title: string;
  owner_user_id: string | null;
  owner_name: string | null;
  status: PolicyBuilderStatus;
  selected_profile_ids_json: string;
  queue_json: string;
  last_saved_at: string;
  created_at: string;
  updated_at: string;
};

type PolicyBuilderRequirementRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  folder_id: string | null;
  source_control_id: string;
  source_name: string;
  title: string;
  description: string | null;
  family: string | null;
  status: string;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
};

type ControlCatalogueRow = {
  framework_id: string;
  framework_name: string;
  control_id: string;
  control_ref: string;
  control_title: string;
  control_description: string | null;
};

type PolicyBuilderPipelineStep = {
  id: string;
  title: string;
  owner: string;
  writeTarget: string;
  helper: string;
  metric: string;
  status: 'Complete' | 'Running' | 'Queued' | 'Attention';
};

type ExportAvailability =
  | 'always'
  | 'categorization'
  | 'assessment'
  | 'inventory'
  | 'findings'
  | 'evidence';

type ComplianceExportOption = {
  id: string;
  section: string;
  family: ComplianceExportFamily;
  format: ComplianceExportFormat;
  extension: '.json' | '.xml' | '.xlsx' | '.xlsm' | '.docx';
  title: string;
  description: string;
  prerequisite: string;
  availability: ExportAvailability;
  scope: string;
};

type ComplianceExportReadinessRow = {
  field: string;
  status: 'Met' | 'Missing' | 'Derived';
  notes: string;
};

type ComplianceExportReadiness = {
  systemCategorizationReady: boolean;
  assessmentsCount: number;
  findingsCount: number;
  evidenceCount: number;
  exportsCount: number;
  inventorySignals: number;
  rows: ComplianceExportReadinessRow[];
};

type ComplianceExportJobRow = {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  folder_name: string | null;
  option_id: string;
  family: ComplianceExportFamily;
  format: ComplianceExportFormat;
  title: string;
  description: string | null;
  source_record: string;
  file_name: string;
  status: ComplianceExportStatus;
  readiness_json: string;
  artifact_key: string | null;
  report_export_id: string | null;
  queue_depth: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type CreatePolicyBuilderSessionInput = {
  title?: string;
};

type UpdatePolicyBuilderSessionInput = {
  title?: string;
  ownerName?: string;
};

type QueuePolicyProfileInput = {
  profileId?: string;
};

type QueuePolicyControlInput = {
  catalogName?: string;
  controlId?: string;
};

type CreateComplianceExportJobInput = {
  optionId?: string;
  sourceRecord?: string;
};

type UserRow = {
  id: string;
  display_name: string | null;
  email: string;
};

const fallbackProfiles: PolicyProfile[] = [
  {
    id: 'fedramp-moderate',
    label: 'FedRAMP Moderate Baseline',
    description: 'Security profile grouped around core cloud authorization controls.',
    catalogues: ['NIST 800-53 Rev 5', 'FedRAMP Rev. 5'],
    controls: [
      {
        controlId: 'AC-2',
        title: 'Account Management',
        family: 'Access Control',
        description: 'Covers account lifecycle expectations for workforce and service accounts.',
      },
      {
        controlId: 'IA-2',
        title: 'Multi-Factor Authentication',
        family: 'Identification & Authentication',
        description: 'Requires MFA for privileged and defined access paths.',
      },
      {
        controlId: 'SC-13',
        title: 'Cryptographic Protection',
        family: 'System & Communications Protection',
        description: 'Defines encryption and key management requirements.',
      },
    ],
  },
  {
    id: 'iso-core',
    label: 'ISO 27001 Core Controls',
    description: 'Policy profile anchored to governance and operations clauses in ISO 27001.',
    catalogues: ['ISO 27001'],
    controls: [
      {
        controlId: 'A.5.15',
        title: 'Access Control',
        family: 'Access',
        description: 'Defines access management policy requirements.',
      },
      {
        controlId: 'A.8.16',
        title: 'Monitoring Activities',
        family: 'Operations Security',
        description: 'Requires monitoring, logging, and review practices.',
      },
      {
        controlId: 'A.8.32',
        title: 'Change Management',
        family: 'Change Management',
        description: 'Defines formal change control and approval requirements.',
      },
    ],
  },
];

const complianceExportCatalog: ComplianceExportOption[] = [
  {
    id: 'regscale-conmon-json',
    section: 'JSON Exports',
    family: 'RegScale',
    format: 'JSON',
    extension: '.json',
    title: 'Export RegScale Continuous Monitoring (.json)',
    description: 'Export continuous monitoring records into a raw machine-readable package.',
    prerequisite: 'Continuous monitoring evidence should exist in the tenant.',
    availability: 'evidence',
    scope: 'Continuous Monitoring',
  },
  {
    id: 'regscale-security-plan-json',
    section: 'JSON Exports',
    family: 'RegScale',
    format: 'JSON',
    extension: '.json',
    title: 'Export RegScale Security Plan (.json)',
    description: 'Export the active security-plan record as a tenant-scoped JSON bundle.',
    prerequisite: 'Compliance review and policy context should exist.',
    availability: 'assessment',
    scope: 'Security Plan',
  },
  {
    id: 'oscal-ssp-xml',
    section: 'OSCAL / XML Exports',
    family: 'OSCAL',
    format: 'XML',
    extension: '.xml',
    title: 'Export OSCAL System Security Plan (XML)',
    description: 'Produce OSCAL-compatible SSP content for downstream exchange.',
    prerequisite: 'System categorization and control content must be present.',
    availability: 'categorization',
    scope: 'Security Plan',
  },
  {
    id: 'fedramp-ssp-xml',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'XML',
    extension: '.xml',
    title: 'FedRAMP SSP Export (OSCAL XML)',
    description: 'Generate a FedRAMP-oriented SSP export in OSCAL XML form.',
    prerequisite: 'FedRAMP categorization and assessment scope must be configured.',
    availability: 'categorization',
    scope: 'Security Plan',
  },
  {
    id: 'fedramp-sap-xml',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'XML',
    extension: '.xml',
    title: 'FedRAMP SAP Export (OSCAL XML)',
    description: 'Render the security assessment plan package for FedRAMP workflows.',
    prerequisite: 'Assessment records and readiness data are required.',
    availability: 'assessment',
    scope: 'Assessments',
  },
  {
    id: 'fedramp-sar-xml',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'XML',
    extension: '.xml',
    title: 'FedRAMP SAR Export (OSCAL XML)',
    description: 'Render the security assessment report package in OSCAL XML.',
    prerequisite: 'Assessment records and findings must be available.',
    availability: 'findings',
    scope: 'Assessments',
  },
  {
    id: 'fedramp-poam-xml',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'XML',
    extension: '.xml',
    title: 'FedRAMP POAM Export (OSCAL XML)',
    description: 'Produce a FedRAMP POA&M XML export from active findings and actions.',
    prerequisite: 'Findings or non-compliance items are required.',
    availability: 'findings',
    scope: 'POA&M',
  },
  {
    id: 'emass-hardware',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsm',
    title: 'eMASS Hardware Software List Export',
    description: 'Package inventory-style records for eMASS hardware and software uploads.',
    prerequisite: 'Inventory or evidence records should be present.',
    availability: 'inventory',
    scope: 'Assets',
  },
  {
    id: 'emass-poams',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsx',
    title: 'eMASS POAMs Export',
    description: 'Generate eMASS-compatible POA&M worksheets from active findings.',
    prerequisite: 'Findings or non-compliance records are required.',
    availability: 'findings',
    scope: 'Issues',
  },
  {
    id: 'emass-ppsms',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsx',
    title: 'eMASS PPSMs Export',
    description: 'Generate a PPSM worksheet for protocol and service review workflows.',
    prerequisite: 'Evidence and system records should be available.',
    availability: 'evidence',
    scope: 'Ports & Protocols',
  },
  {
    id: 'emass-usn-ppsms',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsx',
    title: 'eMASS USN PPSMs Export',
    description: 'Produce the USN-specific PPSM workbook for transport and service declarations.',
    prerequisite: 'Evidence and system records should be available.',
    availability: 'evidence',
    scope: 'Ports & Protocols',
  },
  {
    id: 'emass-slcm',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsm',
    title: 'eMASS SLCM Export',
    description: 'Prepare SLCM data for eMASS ingestion and lifecycle reviews.',
    prerequisite: 'Assessment and inventory records should be available.',
    availability: 'assessment',
    scope: 'Lifecycle',
  },
  {
    id: 'emass-sap-sar',
    section: 'eMASS Exports',
    family: 'eMASS',
    format: 'Excel',
    extension: '.xlsx',
    title: 'eMASS SAP/SAR Export',
    description: 'Generate the combined SAP/SAR workbook for eMASS assessors.',
    prerequisite: 'Assessment records and findings are required.',
    availability: 'findings',
    scope: 'Assessments',
  },
  {
    id: 'fedramp-inventory',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP Inventory Export',
    description: 'Build the FedRAMP inventory workbook from tenant evidence and asset signals.',
    prerequisite: 'Inventory or evidence records should be present.',
    availability: 'inventory',
    scope: 'Assets',
  },
  {
    id: 'fedramp-poams',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP POAMs Export',
    description: 'Generate a FedRAMP POA&M workbook from active remediation items.',
    prerequisite: 'Findings or non-compliance items are required.',
    availability: 'findings',
    scope: 'POA&M',
  },
  {
    id: 'fedramp-risk-exposure',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP Risk Exposure Export',
    description: 'Export risk exposure and residual-risk views for authorization reporting.',
    prerequisite: 'Findings or assessment posture must exist.',
    availability: 'findings',
    scope: 'Risk',
  },
  {
    id: 'fedramp-test-case-procedures',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP Test Case Procedures Export',
    description: 'Generate test case worksheets for assessment execution teams.',
    prerequisite: 'Assessment data and evidence references are required.',
    availability: 'assessment',
    scope: 'Assessments',
  },
  {
    id: 'fedramp-cis-crm',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP CIS/CRM Export',
    description: 'Package control implementation and control responsibility mappings.',
    prerequisite: 'Control and assessment data are required.',
    availability: 'assessment',
    scope: 'Controls',
  },
  {
    id: 'fedramp-deviation-request',
    section: 'FedRAMP Exports',
    family: 'FedRAMP',
    format: 'Excel',
    extension: '.xlsx',
    title: 'FedRAMP Deviation Request Export',
    description: 'Export deviation and exception packaging for approval workflows.',
    prerequisite: 'Findings or exception-style records are required.',
    availability: 'findings',
    scope: 'Exceptions',
  },
  {
    id: 'fedramp-ssp-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'FedRAMP SSP (.docx)',
    description: 'Generate a narrative FedRAMP SSP document package.',
    prerequisite: 'System categorization and assessment scope must be configured.',
    availability: 'categorization',
    scope: 'Security Plan',
  },
  {
    id: 'fedramp-appendix-a-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'FedRAMP Appendix A (.docx)',
    description: 'Generate the Appendix A narrative package for FedRAMP reviews.',
    prerequisite: 'Assessment scope and inventory context are required.',
    availability: 'assessment',
    scope: 'Appendix A',
  },
  {
    id: 'fedramp-sap-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'FedRAMP SAP Export (.docx)',
    description: 'Generate a narrative SAP export package for assessor handoff.',
    prerequisite: 'Assessment records must exist.',
    availability: 'assessment',
    scope: 'Assessments',
  },
  {
    id: 'fedramp-sar-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'FedRAMP SAR Export (.docx)',
    description: 'Generate a narrative SAR document from findings and test outcomes.',
    prerequisite: 'Assessment records and findings are required.',
    availability: 'findings',
    scope: 'Assessments',
  },
  {
    id: 'cmmc-ssp-report-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'CMMC SSP Report (.docx)',
    description: 'Generate a CMMC-oriented narrative SSP report.',
    prerequisite: 'Assessment records must exist.',
    availability: 'assessment',
    scope: 'Security Plan',
  },
  {
    id: 'tailored-ssp-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'Tailored SSP Export (.docx)',
    description: 'Generate a narrative SSP package using tailored field mappings.',
    prerequisite: 'Assessment and control data are required.',
    availability: 'assessment',
    scope: 'Security Plan',
  },
  {
    id: 'doe-ssp-docx',
    section: 'Word / Narrative Exports',
    family: 'Word',
    format: 'Word',
    extension: '.docx',
    title: 'DOE SSP Export (.docx)',
    description: 'Generate a DOE-style narrative SSP package.',
    prerequisite: 'Assessment and control data are required.',
    availability: 'assessment',
    scope: 'Security Plan',
  },
];

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

function countBySource(queue: QueueItem[]) {
  const grouped = new Map<string, number>();
  for (const item of queue) {
    grouped.set(item.sourceName, (grouped.get(item.sourceName) ?? 0) + 1);
  }
  return Array.from(grouped.entries()).map(([sourceName, count]) => ({ sourceName, count }));
}

function buildPolicyPipeline(
  session: { status: PolicyBuilderStatus },
  queue: QueueItem[],
  createdRequirements: CreatedRequirement[],
): PolicyBuilderPipelineStep[] {
  if (session.status === 'Finished') {
    return [
      {
        id: 'select-profile',
        title: 'Select Profile',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_sessions.selected_profile_ids_json',
        helper: 'Profiles were resolved into candidate controls for this policy context.',
        metric: 'Profiles added',
        status: 'Complete',
      },
      {
        id: 'manual-controls',
        title: 'Manually Select Controls',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_sessions.queue_json',
        helper: 'Manual catalogue selections were added into the requirement queue.',
        metric: 'Queue completed',
        status: 'Complete',
      },
      {
        id: 'review-finish',
        title: 'Review and Finish',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_requirements',
        helper: 'Requirements were batch-created and linked back to the policy builder session.',
        metric: `${createdRequirements.length} requirements created`,
        status: 'Complete',
      },
    ];
  }

  if (session.status === 'Running') {
    return [
      {
        id: 'select-profile',
        title: 'Select Profile',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_sessions.selected_profile_ids_json',
        helper: 'Security profiles are queued and persisted in the canonical Worker runtime.',
        metric: 'Profiles resolved',
        status: 'Complete',
      },
      {
        id: 'manual-controls',
        title: 'Manually Select Controls',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_sessions.queue_json',
        helper: 'Catalogue controls remain editable until the final batch-create step.',
        metric: `${queue.length} controls waiting`,
        status: queue.length > 0 ? 'Complete' : 'Running',
      },
      {
        id: 'review-finish',
        title: 'Review and Finish',
        owner: 'AI Policy Builder',
        writeTarget: 'D1 ai_policy_builder_requirements',
        helper: 'The final review step writes policy requirements into D1 for later attestation.',
        metric: queue.length > 0 ? 'Ready to batch-create' : 'Waiting on queue content',
        status: queue.length > 0 ? 'Running' : 'Queued',
      },
    ];
  }

  return [
    {
      id: 'select-profile',
      title: 'Select Profile',
      owner: 'AI Policy Builder',
      writeTarget: 'D1 ai_policy_builder_sessions.selected_profile_ids_json',
      helper: 'Select a security profile to queue mapped controls.',
      metric: 'No profile selected yet',
      status: 'Running',
    },
    {
      id: 'manual-controls',
      title: 'Manually Select Controls',
      owner: 'AI Policy Builder',
      writeTarget: 'D1 ai_policy_builder_sessions.queue_json',
      helper: 'Manual catalogue selection lets you expand the requirement queue across multiple frameworks.',
      metric: `${queue.length} controls queued`,
      status: queue.length > 0 ? 'Complete' : 'Queued',
    },
    {
      id: 'review-finish',
      title: 'Review and Finish',
      owner: 'AI Policy Builder',
      writeTarget: 'D1 ai_policy_builder_requirements',
      helper: 'Finish writes standardized requirements and returns operators to the policy review surface.',
      metric: createdRequirements.length > 0 ? `${createdRequirements.length} already created` : 'Nothing created yet',
      status: createdRequirements.length > 0 ? 'Complete' : 'Queued',
    },
  ];
}

function buildCompliancePipeline(status: ComplianceExportStatus) {
  if (status === 'Ready') {
    return [
      { id: 'persist', title: 'Persist export request', owner: 'Compliance Exports', writeTarget: 'D1 ai_compliance_export_jobs', helper: 'The export request is stored in the canonical Worker runtime.', metric: 'Job persisted', status: 'Complete' as const },
      { id: 'validate', title: 'Validate prerequisites', owner: 'Compliance Exports', writeTarget: 'D1 readiness snapshot', helper: 'Readiness checks passed for the selected export option.', metric: 'Prerequisites met', status: 'Complete' as const },
      { id: 'render', title: 'Render artifact', owner: 'Compliance Exports', writeTarget: 'D1 report_exports manifest', helper: 'The export artifact was rendered and registered with the files history layer.', metric: 'Artifact created', status: 'Complete' as const },
      { id: 'publish', title: 'Publish to Files subsystem', owner: 'Compliance Exports', writeTarget: 'Report export linkage', helper: 'The generated file can now be downloaded from the export history panel.', metric: 'Ready in files', status: 'Complete' as const },
    ];
  }

  if (status === 'Blocked') {
    return [
      { id: 'persist', title: 'Persist export request', owner: 'Compliance Exports', writeTarget: 'D1 ai_compliance_export_jobs', helper: 'Blocked requests are still persisted so operators can inspect prerequisites.', metric: 'Job persisted', status: 'Complete' as const },
      { id: 'validate', title: 'Validate prerequisites', owner: 'Compliance Exports', writeTarget: 'D1 readiness snapshot', helper: 'One or more prerequisites are missing for this export family.', metric: 'Readiness failed', status: 'Attention' as const },
      { id: 'render', title: 'Render artifact', owner: 'Compliance Exports', writeTarget: 'D1 report_exports manifest', helper: 'Rendering remains blocked until readiness requirements are satisfied.', metric: 'Blocked', status: 'Queued' as const },
      { id: 'publish', title: 'Publish to Files subsystem', owner: 'Compliance Exports', writeTarget: 'Report export linkage', helper: 'No files entry is created for blocked jobs.', metric: 'Blocked', status: 'Queued' as const },
    ];
  }

  return [
    { id: 'persist', title: 'Persist export request', owner: 'Compliance Exports', writeTarget: 'D1 ai_compliance_export_jobs', helper: 'The export job is stored before rendering starts.', metric: 'Job persisted', status: 'Complete' as const },
    { id: 'validate', title: 'Validate prerequisites', owner: 'Compliance Exports', writeTarget: 'D1 readiness snapshot', helper: 'Prerequisites passed and the export can continue.', metric: 'Validated', status: 'Complete' as const },
    { id: 'render', title: 'Render artifact', owner: 'Compliance Exports', writeTarget: 'D1 report_exports manifest', helper: 'Rendering is actively preparing the compliance package.', metric: 'Rendering', status: 'Running' as const },
    { id: 'publish', title: 'Publish to Files subsystem', owner: 'Compliance Exports', writeTarget: 'Report export linkage', helper: 'Publication will complete when the artifact is finalized.', metric: 'Queued for files', status: 'Queued' as const },
  ];
}

function getDownloadContent(job: ComplianceExportJobRow, option: ComplianceExportOption) {
  const readiness = asJson<ComplianceExportReadinessRow[]>(job.readiness_json, []);
  const payload = {
    exportId: job.id,
    optionId: option.id,
    title: option.title,
    family: option.family,
    format: option.format,
    sourceRecord: job.source_record,
    readiness,
    generatedAt: job.updated_at,
  };

  if (option.extension === '.json') {
    return {
      content: JSON.stringify(payload, null, 2),
      contentType: 'application/json; charset=utf-8',
    };
  }

  if (option.extension === '.xml') {
    return {
      content: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<complianceExport id="${job.id}" optionId="${option.id}">`,
        `  <title>${escapeXml(option.title)}</title>`,
        `  <family>${escapeXml(option.family)}</family>`,
        `  <sourceRecord>${escapeXml(job.source_record)}</sourceRecord>`,
        `  <generatedAt>${escapeXml(job.updated_at)}</generatedAt>`,
        '</complianceExport>',
      ].join('\n'),
      contentType: 'application/xml; charset=utf-8',
    };
  }

  return {
    content: [
      option.title,
      '',
      `Job: ${job.id}`,
      `Family: ${option.family}`,
      `Format: ${option.format}${option.extension}`,
      `Source Record: ${job.source_record}`,
      `Generated At: ${job.updated_at}`,
      '',
      'Readiness Snapshot:',
      ...readiness.map((row) => `- ${row.field}: ${row.status} (${row.notes})`),
    ].join('\n'),
    contentType: 'application/octet-stream',
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function getFirstFolderId(env: WorkerRequestContext['env'], tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT id
    FROM folders
    WHERE tenant_id = ?
    ORDER BY CASE WHEN content_type = 'domain' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ id: string }>();

  return row?.id ?? null;
}

async function getFolderSummary(env: WorkerRequestContext['env'], tenantId: string, folderId: string | null) {
  if (!folderId) {
    return null;
  }

  return env.D1_MAIN.prepare(
    `
    SELECT id, name
    FROM folders
    WHERE tenant_id = ? AND id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, folderId)
    .first<{ id: string; name: string }>();
}

async function getPreferredOwner(env: WorkerRequestContext['env'], tenantId: string, userId: string | null) {
  if (userId) {
    const current = await env.D1_MAIN.prepare(
      `
      SELECT id, display_name, email
      FROM users
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId, userId)
      .first<UserRow>();

    if (current) {
      return current;
    }
  }

  return env.D1_MAIN.prepare(
    `
    SELECT id, display_name, email
    FROM users
    WHERE tenant_id = ? AND is_active = 1
    ORDER BY created_at ASC
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<UserRow>();
}

async function listCatalogueRows(env: WorkerRequestContext['env'], tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      framework.id AS framework_id,
      framework.name AS framework_name,
      control.id AS control_id,
      control.ref AS control_ref,
      control.title AS control_title,
      control.description AS control_description
    FROM frameworks AS framework
    INNER JOIN controls AS control
      ON control.framework_id = framework.id
    WHERE framework.tenant_id = ?
    ORDER BY framework.name ASC, control.ref ASC
    `,
  )
    .bind(tenantId)
    .all<ControlCatalogueRow>();

  return results;
}

function buildProfilesAndCatalogues(rows: ControlCatalogueRow[]) {
  if (rows.length === 0) {
    return {
      profiles: fallbackProfiles,
      catalogues: fallbackProfiles.map((profile) => ({
        name: profile.catalogues[0] ?? profile.label,
        controls: profile.controls,
      })),
    };
  }

  const grouped = new Map<string, PolicyControl[]>();
  const frameworkNames = new Map<string, string>();
  for (const row of rows) {
    frameworkNames.set(row.framework_id, row.framework_name);
    const current = grouped.get(row.framework_id) ?? [];
    current.push({
      controlId: row.control_ref,
      title: row.control_title,
      family: row.control_ref.split('-')[0] || row.framework_name,
      description: row.control_description ?? 'No description available.',
    });
    grouped.set(row.framework_id, current);
  }

  const profiles = Array.from(grouped.entries()).map(([frameworkId, controls]) => {
    const label = frameworkNames.get(frameworkId) ?? 'Security Profile';
    return {
      id: `profile-${frameworkId}`,
      label: `${label} Core Set`,
      description: `Derived from the loaded ${label} control catalogue for this tenant.`,
      catalogues: [label],
      controls: controls.slice(0, Math.min(controls.length, 6)),
    };
  });

  const catalogues = Array.from(grouped.entries()).map(([frameworkId, controls]) => ({
    name: frameworkNames.get(frameworkId) ?? frameworkId,
    controls,
  }));

  return { profiles, catalogues };
}

async function listPolicyBuilderSessions(env: WorkerRequestContext['env'], tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      session.id,
      session.tenant_id,
      session.folder_id,
      folder.name AS folder_name,
      session.title,
      session.owner_user_id,
      session.owner_name,
      session.status,
      session.selected_profile_ids_json,
      session.queue_json,
      session.last_saved_at,
      session.created_at,
      session.updated_at
    FROM ai_policy_builder_sessions AS session
    LEFT JOIN folders AS folder
      ON folder.id = session.folder_id
    WHERE session.tenant_id = ?
    ORDER BY session.updated_at DESC, session.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<PolicyBuilderSessionRow>();

  return results;
}

async function getPolicyBuilderSession(env: WorkerRequestContext['env'], tenantId: string, sessionId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT
      session.id,
      session.tenant_id,
      session.folder_id,
      folder.name AS folder_name,
      session.title,
      session.owner_user_id,
      session.owner_name,
      session.status,
      session.selected_profile_ids_json,
      session.queue_json,
      session.last_saved_at,
      session.created_at,
      session.updated_at
    FROM ai_policy_builder_sessions AS session
    LEFT JOIN folders AS folder
      ON folder.id = session.folder_id
    WHERE session.tenant_id = ? AND session.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, sessionId)
    .first<PolicyBuilderSessionRow>();
}

async function listPolicyBuilderRequirements(
  env: WorkerRequestContext['env'],
  tenantId: string,
  sessionId: string,
) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      id,
      tenant_id,
      session_id,
      folder_id,
      source_control_id,
      source_name,
      title,
      description,
      family,
      status,
      assignee_name,
      created_at,
      updated_at
    FROM ai_policy_builder_requirements
    WHERE tenant_id = ? AND session_id = ?
    ORDER BY created_at DESC
    `,
  )
    .bind(tenantId, sessionId)
    .all<PolicyBuilderRequirementRow>();

  return results.map((row) => ({
    id: row.id,
    sourceControlId: row.source_control_id,
    title: row.title,
    description: row.description ?? '',
    family: row.family,
    status: row.status,
    assignee: row.assignee_name,
    sourceName: row.source_name,
    createdAt: row.created_at,
  })) satisfies CreatedRequirement[];
}

async function listExistingRequirementIds(
  env: WorkerRequestContext['env'],
  tenantId: string,
  folderId: string | null,
) {
  const baseQuery =
    folderId === null
      ? `
        SELECT DISTINCT source_control_id
        FROM ai_policy_builder_requirements
        WHERE tenant_id = ? AND folder_id IS NULL
      `
      : `
        SELECT DISTINCT source_control_id
        FROM ai_policy_builder_requirements
        WHERE tenant_id = ? AND folder_id = ?
      `;

  const statement = env.D1_MAIN.prepare(baseQuery);
  const bound = folderId === null ? statement.bind(tenantId) : statement.bind(tenantId, folderId);
  const { results } = await bound.all<{ source_control_id: string }>();
  return results.map((row) => row.source_control_id);
}

function toPolicySessionSummary(row: PolicyBuilderSessionRow) {
  const queue = asJson<QueueItem[]>(row.queue_json, []);
  return {
    id: row.id,
    title: row.title,
    owner: row.owner_name ?? 'Unassigned',
    status: row.status,
    policyLocation: row.folder_name ?? 'Tenant root policy context',
    queuedControls: queue.length,
    selectedProfiles: asJson<string[]>(row.selected_profile_ids_json, []),
    lastSavedAt: row.last_saved_at,
  };
}

function toComplianceExportJobResponse(row: ComplianceExportJobRow) {
  return {
    id: row.id,
    title: row.title,
    family: row.family,
    format: row.format,
    sourceRecord: row.source_record,
    fileName: row.file_name,
    status: row.status,
    readiness: asJson<ComplianceExportReadinessRow[]>(row.readiness_json, []),
    artifactKey: row.artifact_key,
    queueDepth: row.queue_depth,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    filesPath: row.report_export_id ? `/_api/ops/reports/exports/${row.report_export_id}` : null,
    downloadPath: `/_api/ai/compliance-exports/jobs/${row.id}/download`,
  };
}

async function listComplianceExportJobs(env: WorkerRequestContext['env'], tenantId: string) {
  const { results } = await env.D1_MAIN.prepare(
    `
    SELECT
      job.id,
      job.tenant_id,
      job.folder_id,
      folder.name AS folder_name,
      job.option_id,
      job.family,
      job.format,
      job.title,
      job.description,
      job.source_record,
      job.file_name,
      job.status,
      job.readiness_json,
      job.artifact_key,
      job.report_export_id,
      job.queue_depth,
      job.created_by_user_id,
      job.created_at,
      job.updated_at
    FROM ai_compliance_export_jobs AS job
    LEFT JOIN folders AS folder
      ON folder.id = job.folder_id
    WHERE job.tenant_id = ?
    ORDER BY job.created_at DESC
    `,
  )
    .bind(tenantId)
    .all<ComplianceExportJobRow>();

  return results;
}

async function getComplianceExportJob(env: WorkerRequestContext['env'], tenantId: string, jobId: string) {
  return env.D1_MAIN.prepare(
    `
    SELECT
      job.id,
      job.tenant_id,
      job.folder_id,
      folder.name AS folder_name,
      job.option_id,
      job.family,
      job.format,
      job.title,
      job.description,
      job.source_record,
      job.file_name,
      job.status,
      job.readiness_json,
      job.artifact_key,
      job.report_export_id,
      job.queue_depth,
      job.created_by_user_id,
      job.created_at,
      job.updated_at
    FROM ai_compliance_export_jobs AS job
    LEFT JOIN folders AS folder
      ON folder.id = job.folder_id
    WHERE job.tenant_id = ? AND job.id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId, jobId)
    .first<ComplianceExportJobRow>();
}

async function buildComplianceReadiness(env: WorkerRequestContext['env'], tenantId: string): Promise<ComplianceExportReadiness> {
  const [assessments, findings, evidence, exportsRow, appliedControls] = await Promise.all([
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM compliance_assessments WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ count: number | null }>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS count
      FROM compliance_requirement_assessments
      WHERE tenant_id = ? AND result IN ('non_compliant', 'partially_compliant')
      `,
    )
      .bind(tenantId)
      .first<{ count: number | null }>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM evidence_artifacts WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ count: number | null }>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM report_exports WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ count: number | null }>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS count FROM applied_controls WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ count: number | null }>(),
  ]);

  const assessmentsCount = Number(assessments?.count ?? 0);
  const findingsCount = Number(findings?.count ?? 0);
  const evidenceCount = Number(evidence?.count ?? 0);
  const exportsCount = Number(exportsRow?.count ?? 0);
  const inventorySignals = Number(appliedControls?.count ?? 0) + evidenceCount;
  const systemCategorizationReady = assessmentsCount > 0;

  return {
    systemCategorizationReady,
    assessmentsCount,
    findingsCount,
    evidenceCount,
    exportsCount,
    inventorySignals,
    rows: [
      {
        field: 'System categorization',
        status: systemCategorizationReady ? 'Met' : 'Missing',
        notes: systemCategorizationReady
          ? `${assessmentsCount} compliance review(s) are available to drive SSP-style exports.`
          : 'FedRAMP and OSCAL exports remain blocked until a compliance review exists.',
      },
      {
        field: 'Assessment coverage',
        status: assessmentsCount > 0 ? 'Met' : 'Missing',
        notes: assessmentsCount > 0
          ? `${assessmentsCount} assessment record(s) can feed SAP, SAR, and SSP outputs.`
          : 'Assessment-backed export families do not have source data yet.',
      },
      {
        field: 'Findings and POA&M content',
        status: findingsCount > 0 ? 'Met' : 'Missing',
        notes: findingsCount > 0
          ? `${findingsCount} non-compliance or partial-compliance item(s) can feed POA&M style exports.`
          : 'POA&M-style exports need findings or non-compliance items.',
      },
      {
        field: 'Inventory and evidence',
        status: inventorySignals > 0 ? 'Derived' : 'Missing',
        notes: inventorySignals > 0
          ? `${inventorySignals} inventory/evidence signal(s) can be used for inventory-oriented exports.`
          : 'Inventory exports need asset or evidence signals in the tenant.',
      },
      {
        field: 'Files subsystem linkage',
        status: 'Derived',
        notes: `${exportsCount} prior export artifact(s) already exist in the canonical files history layer.`,
      },
    ],
  };
}

function evaluateComplianceOption(
  option: ComplianceExportOption,
  readiness: ComplianceExportReadiness,
) {
  let ready = false;
  let blockedReason = '';

  switch (option.availability) {
    case 'always':
      ready = true;
      break;
    case 'categorization':
      ready = readiness.systemCategorizationReady;
      blockedReason = 'System categorization has not been established for this tenant yet.';
      break;
    case 'assessment':
      ready = readiness.assessmentsCount > 0;
      blockedReason = 'No compliance assessments exist yet for this export family.';
      break;
    case 'inventory':
      ready = readiness.inventorySignals > 0;
      blockedReason = 'Inventory or evidence signals are required before this export becomes available.';
      break;
    case 'findings':
      ready = readiness.findingsCount > 0;
      blockedReason = 'Findings or POA&M-style non-compliance items are required before this export can run.';
      break;
    case 'evidence':
      ready = readiness.evidenceCount > 0;
      blockedReason = 'Evidence artifacts are required before this export can run.';
      break;
  }

  return {
    ...option,
    ready,
    blockedReason: ready ? null : blockedReason || option.prerequisite,
  };
}

async function buildPolicyBuilderWorkspace(ctx: WorkerRequestContext, tenantId: string) {
  const catalogueRows = await listCatalogueRows(ctx.env, tenantId);
  const { profiles, catalogues } = buildProfilesAndCatalogues(catalogueRows);
  const sessions = await listPolicyBuilderSessions(ctx.env, tenantId);
  const folderId = await getFirstFolderId(ctx.env, tenantId);
  const folder = await getFolderSummary(ctx.env, tenantId, folderId);
  const owner = await getPreferredOwner(ctx.env, tenantId, ctx.userId);
  const existingRequirementIds = await listExistingRequirementIds(ctx.env, tenantId, folderId);

  return {
    policyContext: {
      id: folder?.id ?? 'tenant-root-policy',
      name: folder?.name ?? 'Primary policy context',
      owner: owner?.display_name?.trim() || owner?.email || 'Unassigned',
      location: folder?.name ?? 'Tenant root',
      readiness: {
        profilesConfigured: profiles.length > 0,
        controlCataloguesLoaded: catalogues.length > 0,
        canEditPolicy: !!ctx.userId,
        existingRequirementCount: existingRequirementIds.length,
      },
    },
    profiles,
    catalogues,
    sessions: sessions.map(toPolicySessionSummary),
  };
}

async function buildPolicyBuilderDetail(ctx: WorkerRequestContext, tenantId: string, sessionId: string) {
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return null;
  }

  const queue = asJson<QueueItem[]>(session.queue_json, []);
  const createdRequirements = await listPolicyBuilderRequirements(ctx.env, tenantId, sessionId);
  const existingRequirementIds = await listExistingRequirementIds(ctx.env, tenantId, session.folder_id);

  return {
    session: {
      id: session.id,
      title: session.title,
      owner: session.owner_name ?? 'Unassigned',
      status: session.status,
      policyLocation: session.folder_name ?? 'Tenant root policy context',
      selectedProfiles: asJson<string[]>(session.selected_profile_ids_json, []),
      lastSavedAt: session.last_saved_at,
      createdAt: session.created_at,
    },
    queue,
    createdRequirements,
    existingRequirementIds,
    queueSummary: countBySource(queue),
    pipeline: buildPolicyPipeline({ status: session.status }, queue, createdRequirements),
  };
}

async function createPolicyBuilderSession(ctx: WorkerRequestContext, tenantId: string) {
  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const body = await readJson<CreatePolicyBuilderSessionInput>(ctx.request);
  const folderId = await getFirstFolderId(ctx.env, tenantId);
  const owner = await getPreferredOwner(ctx.env, tenantId, userId);
  const sessionId = crypto.randomUUID();
  const timestamp = nowIso();

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO ai_policy_builder_sessions (
      id,
      tenant_id,
      folder_id,
      title,
      owner_user_id,
      owner_name,
      status,
      selected_profile_ids_json,
      queue_json,
      last_saved_at,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'Draft', '[]', '[]', ?, ?, ?)
    `,
  )
    .bind(
      sessionId,
      tenantId,
      folderId,
      body.title?.trim() || 'Policy Builder Session',
      owner?.id ?? userId,
      owner?.display_name?.trim() || owner?.email || 'Policy owner',
      timestamp,
      timestamp,
      timestamp,
    )
    .run();

  return json({ data: await buildPolicyBuilderDetail(ctx, tenantId, sessionId) }, { status: 201 });
}

async function updatePolicyBuilderSession(
  ctx: WorkerRequestContext,
  tenantId: string,
  sessionId: string,
) {
  const body = await readJson<UpdatePolicyBuilderSessionInput>(ctx.request);
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return json({ error: 'policy_builder_session_not_found' }, { status: 404 });
  }

  const nextTitle = body.title?.trim() || session.title;
  const nextOwner = body.ownerName?.trim() || session.owner_name || 'Unassigned';
  const timestamp = nowIso();

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE ai_policy_builder_sessions
    SET title = ?, owner_name = ?, updated_at = ?, last_saved_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(nextTitle, nextOwner, timestamp, timestamp, tenantId, sessionId)
    .run();

  return json({ data: await buildPolicyBuilderDetail(ctx, tenantId, sessionId) });
}

async function queuePolicyProfile(
  ctx: WorkerRequestContext,
  tenantId: string,
  sessionId: string,
) {
  const body = await readJson<QueuePolicyProfileInput>(ctx.request);
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return json({ error: 'policy_builder_session_not_found' }, { status: 404 });
  }

  const catalogueRows = await listCatalogueRows(ctx.env, tenantId);
  const { profiles } = buildProfilesAndCatalogues(catalogueRows);
  const selectedProfile = profiles.find((profile) => profile.id === body.profileId);
  if (!selectedProfile) {
    return json({ error: 'policy_profile_not_found' }, { status: 404 });
  }

  const existingRequirementIds = new Set(await listExistingRequirementIds(ctx.env, tenantId, session.folder_id));
  const existingQueue = asJson<QueueItem[]>(session.queue_json, []);
  const existingQueueIds = new Set(existingQueue.map((item) => item.controlId));
  const selectedProfiles = new Set(asJson<string[]>(session.selected_profile_ids_json, []));
  selectedProfiles.add(selectedProfile.id);

  const additions = selectedProfile.controls
    .filter((control) => !existingRequirementIds.has(control.controlId) && !existingQueueIds.has(control.controlId))
    .map((control) => ({
      id: crypto.randomUUID(),
      sourceType: 'Profile' as const,
      sourceName: selectedProfile.label,
      controlId: control.controlId,
      title: control.title,
      family: control.family,
      description: control.description,
    }));

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE ai_policy_builder_sessions
    SET selected_profile_ids_json = ?, queue_json = ?, status = 'Running', updated_at = ?, last_saved_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(
      JSON.stringify(Array.from(selectedProfiles)),
      JSON.stringify([...existingQueue, ...additions]),
      nowIso(),
      nowIso(),
      tenantId,
      sessionId,
    )
    .run();

  return json({
    data: {
      detail: await buildPolicyBuilderDetail(ctx, tenantId, sessionId),
      addedCount: additions.length,
      skippedCount: selectedProfile.controls.length - additions.length,
      message:
        additions.length > 0
          ? `${additions.length} control(s) from ${selectedProfile.label} queued.`
          : `All controls from ${selectedProfile.label} already exist for this policy context.`,
    },
  });
}

async function queuePolicyControl(
  ctx: WorkerRequestContext,
  tenantId: string,
  sessionId: string,
) {
  const body = await readJson<QueuePolicyControlInput>(ctx.request);
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return json({ error: 'policy_builder_session_not_found' }, { status: 404 });
  }

  const catalogueRows = await listCatalogueRows(ctx.env, tenantId);
  const { catalogues } = buildProfilesAndCatalogues(catalogueRows);
  const selectedCatalogue = catalogues.find((catalogue) => catalogue.name === body.catalogName);
  const selectedControl = selectedCatalogue?.controls.find((control) => control.controlId === body.controlId);

  if (!selectedCatalogue || !selectedControl) {
    return json({ error: 'policy_control_not_found' }, { status: 404 });
  }

  const existingRequirementIds = new Set(await listExistingRequirementIds(ctx.env, tenantId, session.folder_id));
  const existingQueue = asJson<QueueItem[]>(session.queue_json, []);
  const existingQueueIds = new Set(existingQueue.map((item) => item.controlId));

  if (existingRequirementIds.has(selectedControl.controlId) || existingQueueIds.has(selectedControl.controlId)) {
    return json(
      {
        error: 'duplicate_requirement',
        message: `Unable to add duplicate requirement for ${selectedControl.controlId}.`,
        data: await buildPolicyBuilderDetail(ctx, tenantId, sessionId),
      },
      { status: 409 },
    );
  }

  const nextQueue = [
    ...existingQueue,
    {
      id: crypto.randomUUID(),
      sourceType: 'Catalog' as const,
      sourceName: selectedCatalogue.name,
      controlId: selectedControl.controlId,
      title: selectedControl.title,
      family: selectedControl.family,
      description: selectedControl.description,
    },
  ];

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE ai_policy_builder_sessions
    SET queue_json = ?, status = 'Running', updated_at = ?, last_saved_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(JSON.stringify(nextQueue), nowIso(), nowIso(), tenantId, sessionId)
    .run();

  return json({
    data: {
      detail: await buildPolicyBuilderDetail(ctx, tenantId, sessionId),
      message: `${selectedControl.controlId} queued from ${selectedCatalogue.name}.`,
    },
  });
}

async function clearPolicyBuilderQueue(
  ctx: WorkerRequestContext,
  tenantId: string,
  sessionId: string,
) {
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return json({ error: 'policy_builder_session_not_found' }, { status: 404 });
  }

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE ai_policy_builder_sessions
    SET queue_json = '[]', status = 'Draft', updated_at = ?, last_saved_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(nowIso(), nowIso(), tenantId, sessionId)
    .run();

  return json({ data: await buildPolicyBuilderDetail(ctx, tenantId, sessionId) });
}

async function finishPolicyBuilderSession(
  ctx: WorkerRequestContext,
  tenantId: string,
  sessionId: string,
) {
  const session = await getPolicyBuilderSession(ctx.env, tenantId, sessionId);
  if (!session) {
    return json({ error: 'policy_builder_session_not_found' }, { status: 404 });
  }

  const queue = asJson<QueueItem[]>(session.queue_json, []);
  if (queue.length === 0) {
    return json(
      {
        error: 'empty_queue',
        message: 'Add controls to the queue before finishing the builder.',
      },
      { status: 400 },
    );
  }

  const existingRequirementIds = new Set(await listExistingRequirementIds(ctx.env, tenantId, session.folder_id));
  const createdAt = nowIso();
  const nextRequirements = queue.filter((item) => !existingRequirementIds.has(item.controlId));

  for (const item of nextRequirements) {
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO ai_policy_builder_requirements (
        id,
        tenant_id,
        session_id,
        folder_id,
        source_control_id,
        source_name,
        title,
        description,
        family,
        status,
        assignee_name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Implemented', ?, ?, ?)
      `,
    )
      .bind(
        crypto.randomUUID(),
        tenantId,
        sessionId,
        session.folder_id,
        item.controlId,
        item.sourceName,
        item.title,
        item.description,
        item.family,
        session.owner_name,
        createdAt,
        createdAt,
      )
      .run();
  }

  await ctx.env.D1_MAIN.prepare(
    `
    UPDATE ai_policy_builder_sessions
    SET status = 'Finished', queue_json = '[]', updated_at = ?, last_saved_at = ?
    WHERE tenant_id = ? AND id = ?
    `,
  )
    .bind(createdAt, createdAt, tenantId, sessionId)
    .run();

  return json({
    data: {
      detail: await buildPolicyBuilderDetail(ctx, tenantId, sessionId),
      createdCount: nextRequirements.length,
      skippedCount: queue.length - nextRequirements.length,
      message:
        nextRequirements.length > 0
          ? `${nextRequirements.length} requirement(s) created. Review them in the score-card and attestation flow next.`
          : 'All queued controls already exist in this policy context.',
    },
  });
}

async function buildComplianceExportsWorkspace(ctx: WorkerRequestContext, tenantId: string) {
  const readiness = await buildComplianceReadiness(ctx.env, tenantId);
  const jobs = await listComplianceExportJobs(ctx.env, tenantId);
  const options = complianceExportCatalog.map((option) => evaluateComplianceOption(option, readiness));

  return {
    readiness,
    sections: Array.from(new Set(options.map((option) => option.section))).map((section) => ({
      id: section.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: section,
      options: options.filter((option) => option.section === section),
    })),
    jobs: jobs.map(toComplianceExportJobResponse),
    filesPanel: {
      totalGenerated: jobs.filter((job) => job.status === 'Ready').length,
      totalBlocked: jobs.filter((job) => job.status === 'Blocked').length,
      latestGenerated: jobs.find((job) => job.status === 'Ready')?.file_name ?? null,
    },
  };
}

async function createComplianceExportJob(ctx: WorkerRequestContext, tenantId: string) {
  const userId = requireUser(ctx);
  if (userId instanceof Response) {
    return userId;
  }

  const body = await readJson<CreateComplianceExportJobInput>(ctx.request);
  const option = complianceExportCatalog.find((item) => item.id === body.optionId);
  if (!option) {
    return json({ error: 'compliance_export_option_not_found' }, { status: 404 });
  }

  const readiness = await buildComplianceReadiness(ctx.env, tenantId);
  const evaluated = evaluateComplianceOption(option, readiness);
  const folderId = await getFirstFolderId(ctx.env, tenantId);
  const createdAt = nowIso();
  const jobId = crypto.randomUUID();
  const reportExportId = evaluated.ready ? crypto.randomUUID() : null;
  const status: ComplianceExportStatus = evaluated.ready ? 'Ready' : 'Blocked';
  const sourceRecord = body.sourceRecord?.trim() || 'primary-security-plan';
  const fileName = `${option.id}-${new Date().toISOString().slice(0, 10)}${option.extension}`;
  const artifactKey = evaluated.ready ? `compliance-exports/${tenantId}/${jobId}/${fileName}` : null;

  if (reportExportId) {
    await ctx.env.D1_MAIN.prepare(
      `
      INSERT INTO report_exports (
        id,
        tenant_id,
        folder_id,
        created_by_user_id,
        report_id,
        name,
        format,
        status,
        filter_json,
        summary_json,
        content_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, ?)
      `,
    )
      .bind(
        reportExportId,
        tenantId,
        folderId,
        userId,
        `compliance-export:${option.id}`,
        option.title,
        option.extension === '.json' ? 'json' : 'csv',
        JSON.stringify({ sourceRecord, family: option.family, format: option.format }),
        JSON.stringify({
          ready: evaluated.ready,
          section: option.section,
          readinessRows: readiness.rows.length,
        }),
        JSON.stringify({
          filename: fileName,
          rows: [
            ['field', 'value'],
            ['title', option.title],
            ['family', option.family],
            ['format', `${option.format}${option.extension}`],
            ['sourceRecord', sourceRecord],
            ['generatedAt', createdAt],
          ],
        }),
      )
      .run();
  }

  await ctx.env.D1_MAIN.prepare(
    `
    INSERT INTO ai_compliance_export_jobs (
      id,
      tenant_id,
      folder_id,
      option_id,
      family,
      format,
      title,
      description,
      source_record,
      file_name,
      status,
      readiness_json,
      artifact_key,
      report_export_id,
      queue_depth,
      created_by_user_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      jobId,
      tenantId,
      folderId,
      option.id,
      option.family,
      option.format,
      option.title,
      option.description,
      sourceRecord,
      fileName,
      status,
      JSON.stringify(readiness.rows),
      artifactKey,
      reportExportId,
      evaluated.ready ? 0 : 0,
      userId,
      createdAt,
      createdAt,
    )
    .run();

  return json(
    {
      data: {
        job: toComplianceExportJobResponse((await getComplianceExportJob(ctx.env, tenantId, jobId)) as ComplianceExportJobRow),
        pipeline: buildCompliancePipeline(status),
      },
    },
    { status: 201 },
  );
}

export async function handleAiRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource] = segments;
  const aiAccess =
    resource === 'evidence-mapping'
      ? await requireAnyPermission(
          ctx,
          ctx.request.method === 'GET'
            ? ['view_evidence', 'collect_evidence']
            : ['collect_evidence'],
          ctx.request.method === 'GET'
            ? 'AI evidence mapping requires evidence-view permissions.'
            : 'AI evidence mapping changes require evidence-collection permissions.',
        )
      : await requireAnyPermission(
          ctx,
          ctx.request.method === 'GET'
            ? ['view_framework', 'add_framework', 'change_framework']
            : ['add_framework', 'change_framework'],
          ctx.request.method === 'GET'
            ? 'AI governance access requires framework-view permissions.'
            : 'AI governance changes require framework management permissions.',
        );
  if (aiAccess instanceof Response) {
    return aiAccess;
  }

  const tenantId = requireTenant(ctx);
  if (tenantId instanceof Response) {
    return tenantId;
  }

  const [, collection, id, action] = segments;

  if (resource === 'policy-builder') {
    if (!collection && ctx.request.method === 'GET') {
      return json({ data: await buildPolicyBuilderWorkspace(ctx, tenantId) });
    }

    if (collection === 'sessions' && !id && ctx.request.method === 'POST') {
      return createPolicyBuilderSession(ctx, tenantId);
    }

    if (collection === 'sessions' && id && !action && ctx.request.method === 'GET') {
      const detail = await buildPolicyBuilderDetail(ctx, tenantId, id);
      return detail
        ? json({ data: detail })
        : json({ error: 'policy_builder_session_not_found' }, { status: 404 });
    }

    if (collection === 'sessions' && id && !action && ctx.request.method === 'PUT') {
      return updatePolicyBuilderSession(ctx, tenantId, id);
    }

    if (collection === 'sessions' && id && action === 'queue-profile' && ctx.request.method === 'POST') {
      return queuePolicyProfile(ctx, tenantId, id);
    }

    if (collection === 'sessions' && id && action === 'queue-control' && ctx.request.method === 'POST') {
      return queuePolicyControl(ctx, tenantId, id);
    }

    if (collection === 'sessions' && id && action === 'queue' && ctx.request.method === 'DELETE') {
      return clearPolicyBuilderQueue(ctx, tenantId, id);
    }

    if (collection === 'sessions' && id && action === 'finish' && ctx.request.method === 'POST') {
      return finishPolicyBuilderSession(ctx, tenantId, id);
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'compliance-exports') {
    if (!collection && ctx.request.method === 'GET') {
      return json({ data: await buildComplianceExportsWorkspace(ctx, tenantId) });
    }

    if (collection === 'jobs' && !id && ctx.request.method === 'POST') {
      return createComplianceExportJob(ctx, tenantId);
    }

    if (collection === 'jobs' && id && !action && ctx.request.method === 'GET') {
      const job = await getComplianceExportJob(ctx.env, tenantId, id);
      if (!job) {
        return json({ error: 'compliance_export_job_not_found' }, { status: 404 });
      }

      return json({
        data: {
          job: toComplianceExportJobResponse(job),
          pipeline: buildCompliancePipeline(job.status),
        },
      });
    }

    if (collection === 'jobs' && id && action === 'download' && ctx.request.method === 'GET') {
      const job = await getComplianceExportJob(ctx.env, tenantId, id);
      if (!job) {
        return json({ error: 'compliance_export_job_not_found' }, { status: 404 });
      }

      if (job.status !== 'Ready') {
        return json(
          {
            error: 'compliance_export_not_ready',
            message: 'Only completed export jobs can be downloaded.',
          },
          { status: 409 },
        );
      }

      const option = complianceExportCatalog.find((item) => item.id === job.option_id);
      if (!option) {
        return json({ error: 'compliance_export_option_not_found' }, { status: 404 });
      }

      const artifact = getDownloadContent(job, option);
      return new Response(artifact.content, {
        headers: {
          'content-type': artifact.contentType,
          'content-disposition': `attachment; filename="${job.file_name}"`,
        },
      });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (resource === 'response-automation') {
    return handleResponseAutomationRoutes(segments.slice(1), ctx);
  }

  if (resource === 'evidence-mapping') {
    return handleEvidenceMappingRoutes(segments.slice(1), ctx);
  }

  if (resource === 'regml') {
    return handleRegmlRoutes(segments.slice(1), ctx);
  }

  return json({ error: 'not_found', path: segments.join('/') }, { status: 404 });
}
