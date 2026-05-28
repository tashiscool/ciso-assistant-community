import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { listSharedWorkspaceModules, type ModuleCatalogEntry } from '../core/moduleRegistry';

type FormTabSort = 'alphabetical' | 'manual';

type FormFieldChoice = {
  id: string;
  label: string;
  value: string;
  active: boolean;
};

type FormFieldValidation = {
  id: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'HAS_VALUE'
    | 'NO_VALUE'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'BEFORE'
    | 'AFTER'
    | 'WITHIN_LAST'
    | 'WITHIN_NEXT';
  valueSource: 'constant' | 'field';
  value: string;
  errorMessage?: string | null;
};

type FormField = {
  id: string;
  displayName: string;
  systemName: string;
  fieldType:
    | 'Text Field'
    | 'Text Area'
    | 'Rich Text'
    | 'Email'
    | 'Phone'
    | 'URL'
    | 'IP Address'
    | 'MAC Address'
    | 'Number'
    | 'Whole Number'
    | 'Dollar'
    | 'Range'
    | 'Date'
    | 'Date Time Hour'
    | 'Select'
    | 'Users'
    | 'Organizations'
    | 'Facilities'
    | 'Risk Probability'
    | 'Risk Consequence'
    | 'Compliance Settings'
    | 'Checkbox'
    | 'Toggle'
    | 'Label'
    | 'HTML'
    | 'Section Header'
    | 'Button';
  required: boolean;
  active: boolean;
  editable: boolean;
  helpText?: string | null;
  pattern?: string | null;
  min?: number | null;
  max?: number | null;
  selectType?: string | null;
  sectionId: string;
  choices: FormFieldChoice[];
  validations: FormFieldValidation[];
  lockedType?: boolean;
};

type FormSection = {
  id: string;
  displayName: string;
  active: boolean;
  isDefault: boolean;
  isSystem: boolean;
  fields: FormField[];
};

type FormRuleCondition = {
  id: string;
  conditionType: 'Field' | 'System - NO_PARENT' | 'System - NO_CONDITION' | 'Tenant Feature' | 'Module';
  target: string;
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'HAS_VALUE'
    | 'NO_VALUE'
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'BEFORE'
    | 'AFTER'
    | 'WITHIN_LAST'
    | 'WITHIN_NEXT'
    | 'ENABLED'
    | 'DISABLED';
  valueSource: 'constant' | 'field' | 'system';
  value: string;
};

type FormRuleAction = {
  id: string;
  actionType: 'SHOW' | 'HIDE' | 'REQUIRE' | 'NOT_REQUIRE' | 'ENABLE' | 'DISABLE' | 'SET_VALUE' | 'VALIDATE';
  targetType: 'Field' | 'Tab';
  target: string;
  operator?: string | null;
  value?: string | null;
  bypassExistingValue?: boolean;
  allowExternalValue?: boolean;
};

type FormRule = {
  id: string;
  name: string;
  logic: 'AND' | 'OR';
  conditions: FormRuleCondition[];
  actions: FormRuleAction[];
};

type FormBuilderDiagnostic = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

type FormBuilderModuleRow = {
  id: string;
  tenant_id: string;
  module_key: string;
  module_name: string;
  plural_name: string;
  tab_sort: string;
  status: string;
  description: string | null;
  sections_json: string;
  rules_json: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type FormBuilderSummary = {
  id: string;
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  tabSort: FormTabSort;
  status: string;
  sectionCount: number;
  fieldCount: number;
  ruleCount: number;
  updatedAt: string;
};

type FormBuilderDetail = {
  id: string;
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  tabSort: FormTabSort;
  status: string;
  description: string | null;
  sections: FormSection[];
  rules: FormRule[];
  diagnostics: FormBuilderDiagnostic[];
  createdAt: string;
  updatedAt: string;
};

type CreateFormModuleInput = {
  moduleName?: string;
  pluralName?: string;
  moduleKey?: string;
};

type SaveFormModuleInput = {
  moduleName?: string;
  pluralName?: string;
  tabSort?: FormTabSort;
  status?: string;
  description?: string | null;
  sections?: FormSection[];
  rules?: FormRule[];
};

type ValidateFormModuleInput = {
  sections?: FormSection[];
  rules?: FormRule[];
};

type SeedFieldDefinition = Partial<FormField> & {
  displayName: string;
  systemName: string;
  fieldType: FormField['fieldType'];
};

type SeedModuleDefinition = {
  moduleKey: string;
  moduleName: string;
  pluralName: string;
  tabSort: FormTabSort;
  status: string;
  description: string;
  sections: FormSection[];
  rules: FormRule[];
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `module-${crypto.randomUUID().slice(0, 8)}`;
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

function emptyField(sectionId: string, index: number): FormField {
  return {
    id: crypto.randomUUID(),
    displayName: `Field ${index}`,
    systemName: `field_${index}`,
    fieldType: 'Text Field',
    required: false,
    active: true,
    editable: true,
    helpText: '',
    pattern: null,
    min: null,
    max: null,
    selectType: null,
    sectionId,
    choices: [],
    validations: [],
    lockedType: false,
  };
}

function seedFieldForSection(sectionId: string, index: number, field: SeedFieldDefinition): FormField {
  return {
    ...emptyField(sectionId, index + 1),
    ...field,
    id: crypto.randomUUID(),
    sectionId,
    choices: field.choices ?? [],
    validations: field.validations ?? [],
    lockedType: field.lockedType ?? true,
  };
}

function sectionWithFields(
  displayName: string,
  options: {
    isDefault?: boolean;
    isSystem?: boolean;
    fields?: SeedFieldDefinition[];
  } = {},
): FormSection {
  const sectionId = crypto.randomUUID();
  return {
    id: sectionId,
    displayName,
    active: true,
    isDefault: options.isDefault ?? false,
    isSystem: options.isSystem ?? false,
    fields: options.fields?.map((field, index) => seedFieldForSection(sectionId, index, field)) ?? [],
  };
}

function seedChoice(label: string, value = label): FormFieldChoice {
  return {
    id: crypto.randomUUID(),
    label,
    value,
    active: true,
  };
}

function genericFieldDefinitionForModuleField(
  field: NonNullable<ModuleCatalogEntry['starterFields']>[number],
): SeedFieldDefinition {
  return {
    displayName: field.displayName,
    systemName: field.systemName,
    fieldType: field.fieldType,
    required: field.required ?? false,
    helpText: field.helpText,
    choices: field.choices?.map((choice) => seedChoice(choice)),
  };
}

function buildGenericSeedModule(entry: ModuleCatalogEntry): SeedModuleDefinition {
  const starterFields = entry.starterFields ?? [];
  const descriptionField = starterFields.find((field) => field.systemName === 'description');
  const overviewFields = starterFields
    .filter((field) => field.systemName !== 'description')
    .map(genericFieldDefinitionForModuleField);
  const narrativeFields = descriptionField ? [genericFieldDefinitionForModuleField(descriptionField)] : [];

  return {
    moduleKey: entry.moduleKey,
    moduleName: entry.moduleName,
    pluralName: entry.pluralName,
    tabSort: 'manual',
    status: 'active',
    description: entry.description,
    sections: [
      sectionWithFields(`${entry.moduleName} Overview`, {
        isDefault: true,
        isSystem: true,
        fields: overviewFields,
      }),
      ...(narrativeFields.length > 0
        ? [
            sectionWithFields('Narrative', {
              isSystem: true,
              fields: narrativeFields,
            }),
          ]
        : []),
    ],
    rules: [],
  };
}

function buildSeedModules(): SeedModuleDefinition[] {
  const securityPlanSections = [
    sectionWithFields('Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Plan Name',
          systemName: 'plan_name',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Reusable plan title for module lists, exports, and workspace summaries.',
        },
        {
          displayName: 'System Name',
          systemName: 'system_name',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Authoritative system label used in exports and headers.',
        },
        {
          displayName: 'System Owner',
          systemName: 'system_owner',
          fieldType: 'Users',
          required: true,
          selectType: 'users',
        },
        {
          displayName: 'Other Identifier',
          systemName: 'other_identifier',
          fieldType: 'Text Field',
          helpText: 'Alternate identifier, package short-code, or external tracking reference.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          required: true,
          choices: [
            seedChoice('Under Development'),
            seedChoice('Operational'),
            seedChoice('In Transition'),
            seedChoice('Decommissioned'),
          ],
        },
        {
          displayName: 'System Type',
          systemName: 'system_type',
          fieldType: 'Select',
          required: true,
          choices: [seedChoice('Major Application'), seedChoice('General Support System'), seedChoice('Minor Application')],
        },
        {
          displayName: 'Risk Maturity Level',
          systemName: 'risk_maturity_level',
          fieldType: 'Select',
          choices: [
            seedChoice('Tier 1: Risk Based'),
            seedChoice('Tier 2: Risk Informed'),
            seedChoice('Tier 3: Risk Aware'),
          ],
        },
        {
          displayName: 'Facility',
          systemName: 'facility',
          fieldType: 'Facilities',
          selectType: 'facilities',
        },
        {
          displayName: 'Organization',
          systemName: 'organization',
          fieldType: 'Organizations',
          selectType: 'organizations',
        },
        {
          displayName: 'Boundary Summary',
          systemName: 'boundary_summary',
          fieldType: 'Text Area',
          helpText: 'Describe the logical boundary, major assets or components, and the operating environment covered by this security plan.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Business, mission, and boundary summary for the plan.',
        },
      ],
    }),
    sectionWithFields('Authorization & Classification', {
      isSystem: true,
      fields: [
        {
          displayName: 'ATO Date',
          systemName: 'ato_date',
          fieldType: 'Date',
          helpText: 'Date the current authorization or approval became effective.',
        },
        {
          displayName: 'ATO Expiration',
          systemName: 'ato_expiration',
          fieldType: 'Date',
          helpText: 'Planned or approved authorization end date.',
        },
        {
          displayName: 'Confidentiality Impact',
          systemName: 'confidentiality_impact',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High')],
          helpText: 'Categorize confidentiality impact for the boundary as part of system categorization and authorization packaging.',
        },
        {
          displayName: 'Integrity Impact',
          systemName: 'integrity_impact',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High')],
          helpText: 'Categorize integrity impact for the boundary as part of system categorization and authorization packaging.',
        },
        {
          displayName: 'Availability Impact',
          systemName: 'availability_impact',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High')],
          helpText: 'Categorize availability impact for the boundary as part of system categorization and authorization packaging.',
        },
        {
          displayName: 'Overall Impact Level',
          systemName: 'overall_impact_level',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High')],
          helpText: 'Summarize the overall impact level used for the SSP and related control expectations.',
        },
        {
          displayName: 'Authorizing Official',
          systemName: 'authorizing_official',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Authorizing official or senior decision maker accountable for accepting residual risk for the boundary.',
        },
        {
          displayName: 'Authorization Status',
          systemName: 'authorization_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Submitted'),
            seedChoice('Authorized'),
            seedChoice('Interim Authorized'),
            seedChoice('Expired'),
            seedChoice('Revoked'),
          ],
          helpText: 'Track where the boundary currently sits in its authorization lifecycle.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Next scheduled review or most recent formal authorization review date for the plan.',
        },
        {
          displayName: 'Last Control Assessed On',
          systemName: 'last_control_assessed_on',
          fieldType: 'Date',
          helpText: 'Most recent date that the control set or major control population was assessed or tested.',
        },
        {
          displayName: 'Assessment Cadence',
          systemName: 'assessment_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Semi-Annual'),
            seedChoice('Annual'),
            seedChoice('On Change'),
          ],
          helpText: 'Track how often the security plan or its control population is expected to be formally assessed or refreshed.',
        },
        {
          displayName: 'FIPS Category',
          systemName: 'fips_category',
          fieldType: 'Text Field',
          helpText: 'System categorization or impact notation used in authorization packages.',
        },
      ],
    }),
    sectionWithFields('Cloud Info', {
      isSystem: true,
      fields: [
        {
          displayName: 'Cloud Computing',
          systemName: 'cloud_computing',
          fieldType: 'Select',
          choices: [seedChoice('Yes', 'yes'), seedChoice('No', 'no')],
        },
        {
          displayName: 'Broker eMASS ID',
          systemName: 'broker_emass_id',
          fieldType: 'Text Field',
        },
      ],
    }),
    sectionWithFields('Implementation Narrative', {
      isSystem: false,
      fields: [
        {
          displayName: 'Implementation Statement',
          systemName: 'implementation_statement',
          fieldType: 'Rich Text',
          editable: true,
          helpText: 'Narrative used in SSP and control exports.',
        },
        {
          displayName: 'Control Inheritance Summary',
          systemName: 'control_inheritance_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize inherited controls, common-control providers, or shared-service dependencies that influence the SSP boundary.',
        },
        {
          displayName: 'Risk Acceptance Summary',
          systemName: 'risk_acceptance_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the review, approval, or residual-risk posture associated with the current authorization cycle.',
        },
      ],
    }),
    sectionWithFields('Record Metadata', {
      isSystem: true,
      fields: [
        {
          displayName: 'Created At',
          systemName: 'created_at',
          fieldType: 'Date Time Hour',
          editable: false,
          helpText: 'System-maintained creation timestamp for downstream reporting and audit trails.',
        },
        {
          displayName: 'Updated At',
          systemName: 'updated_at',
          fieldType: 'Date Time Hour',
          editable: false,
          helpText: 'System-maintained last updated timestamp for downstream reporting and audit trails.',
        },
      ],
    }),
  ];

  const securityControlSections = [
    sectionWithFields('Control Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        { displayName: 'Control ID', systemName: 'control_id', fieldType: 'Text Field', required: true },
        { displayName: 'Title', systemName: 'title', fieldType: 'Text Field', required: true },
        { displayName: 'Family', systemName: 'family', fieldType: 'Text Field', required: true },
        {
          displayName: 'Implementation Status',
          systemName: 'implementation_status',
          fieldType: 'Select',
          required: true,
          choices: [
            seedChoice('Implemented'),
            seedChoice('Partially Implemented'),
            seedChoice('Planned'),
            seedChoice('Not Implemented'),
            seedChoice('Not Applicable'),
          ],
        },
        { displayName: 'Responsible Role', systemName: 'responsible_role', fieldType: 'Text Field' },
        {
          displayName: 'Assessment Status',
          systemName: 'assessment_status',
          fieldType: 'Select',
          choices: [seedChoice('Satisfied'), seedChoice('Other Than Satisfied'), seedChoice('Not Assessed')],
        },
        { displayName: 'Last Assessed', systemName: 'last_assessed', fieldType: 'Date' },
        { displayName: 'Evidence Count', systemName: 'evidence_count', fieldType: 'Whole Number', editable: false },
      ],
    }),
    sectionWithFields('Implementation Narrative', {
      isSystem: true,
      fields: [
        { displayName: 'Description', systemName: 'description', fieldType: 'Text Area' },
        {
          displayName: 'Guidance',
          systemName: 'guidance',
          fieldType: 'Rich Text',
          helpText: 'Control guidance, testing notes, or framework-specific commentary.',
        },
        {
          displayName: 'Test Procedure',
          systemName: 'test_procedure',
          fieldType: 'Rich Text',
          helpText: 'Reusable assessment steps or control test script.',
        },
      ],
    }),
  ];

  const riskSections = [
    sectionWithFields('Risk Profile', {
      isDefault: true,
      isSystem: true,
      fields: [
        { displayName: 'Risk ID', systemName: 'risk_id', fieldType: 'Text Field', required: true },
        { displayName: 'Title', systemName: 'title', fieldType: 'Text Field', required: true },
        {
          displayName: 'Risk Category',
          systemName: 'risk_category',
          fieldType: 'Select',
          choices: [
            seedChoice('Strategic'),
            seedChoice('Operational'),
            seedChoice('Safety'),
            seedChoice('Security'),
            seedChoice('Quality'),
            seedChoice('Environmental'),
            seedChoice('Reputation'),
            seedChoice('Compliance'),
            seedChoice('Financial'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the risk so reporting and treatment decisions can be grouped consistently.',
        },
        {
          displayName: 'Risk Statement',
          systemName: 'risk_statement',
          fieldType: 'Text Area',
          helpText: 'Describe the situation that could expose the organization to loss, danger, or another negative consequence.',
        },
        {
          displayName: 'Risk Source',
          systemName: 'risk_source',
          fieldType: 'Text Field',
          helpText: 'Capture the originating source, driver, program, vendor, system, or business context for this risk.',
        },
        {
          displayName: 'Threat Summary',
          systemName: 'threat_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the threat, hazard, or evolving condition that could realize this risk or change its posture over time.',
        },
        {
          displayName: 'Trigger Events',
          systemName: 'trigger_events',
          fieldType: 'Text Area',
          helpText: 'List the events or conditions that could realize the risk if left unmanaged.',
        },
        { displayName: 'Likelihood', systemName: 'likelihood', fieldType: 'Risk Probability' },
        { displayName: 'Impact', systemName: 'impact', fieldType: 'Risk Consequence' },
        {
          displayName: 'Risk Level',
          systemName: 'risk_level',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [seedChoice('Open'), seedChoice('Accepted'), seedChoice('Mitigating'), seedChoice('Closed')],
        },
        { displayName: 'Owner', systemName: 'owner', fieldType: 'Users', selectType: 'users' },
      ],
    }),
    sectionWithFields('Treatment & Decision', {
      isSystem: true,
      fields: [
        {
          displayName: 'Treatment Strategy',
          systemName: 'treatment_strategy',
          fieldType: 'Select',
          choices: [seedChoice('Accept'), seedChoice('Avoid'), seedChoice('Mitigate'), seedChoice('Transfer')],
          helpText: 'Document the chosen risk response strategy.',
        },
        {
          displayName: 'Mitigation',
          systemName: 'mitigation',
          fieldType: 'Text Area',
          helpText: 'Primary mitigation, response, or transfer strategy for the risk record.',
        },
        {
          displayName: 'Mitigation Progress',
          systemName: 'mitigation_progress',
          fieldType: 'Select',
          choices: [seedChoice('Not Started'), seedChoice('In Progress'), seedChoice('Complete'), seedChoice('Blocked')],
          helpText: 'Track how far the mitigation effort has progressed through implementation.',
        },
        {
          displayName: 'Risk Tolerance',
          systemName: 'risk_tolerance',
          fieldType: 'Select',
          choices: [seedChoice('Within Tolerance'), seedChoice('Near Threshold'), seedChoice('Out of Tolerance')],
          helpText: 'Indicate whether the current risk posture remains inside tolerance, is nearing the threshold, or exceeds what the organization is willing to carry.',
        },
        {
          displayName: 'Mitigation Owner',
          systemName: 'mitigation_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team responsible for carrying out the mitigation or transfer actions.',
        },
        {
          displayName: 'Decision Maker',
          systemName: 'decision_maker',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or role authorized to accept, avoid, transfer, or direct mitigation of the risk.',
        },
        {
          displayName: 'Approval Status',
          systemName: 'approval_status',
          fieldType: 'Select',
          choices: [seedChoice('Pending Review'), seedChoice('Approved'), seedChoice('Rejected'), seedChoice('Not Required')],
          helpText: 'Capture whether the risk decision has been reviewed and approved by the appropriate decision maker.',
        },
        {
          displayName: 'Acceptance Rationale',
          systemName: 'acceptance_rationale',
          fieldType: 'Text Area',
          helpText: 'Explain why the residual risk is acceptable to the organization when the strategy is to accept it.',
        },
        {
          displayName: 'Review Summary',
          systemName: 'review_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the review discussion, approval notes, or rationale behind the current risk decision.',
        },
        { displayName: 'Due Date', systemName: 'due_date', fieldType: 'Date' },
        {
          displayName: 'Review Frequency',
          systemName: 'review_frequency',
          fieldType: 'Select',
          choices: [
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Semi-Annual'),
            seedChoice('Annual'),
            seedChoice('On Change'),
          ],
          helpText: 'Define how often the risk should be reviewed, refreshed, or re-evaluated.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Record the next or most recent formal review point for the risk.',
        },
        {
          displayName: 'Accepted On',
          systemName: 'accepted_on',
          fieldType: 'Date',
          helpText: 'Record when an authorized decision maker formally accepted the residual risk.',
        },
        {
          displayName: 'Realized On',
          systemName: 'realized_on',
          fieldType: 'Date',
          helpText: 'Record when the triggering event actually materialized into a realized loss, issue, or operational event.',
        },
        {
          displayName: 'Residual Likelihood',
          systemName: 'residual_likelihood',
          fieldType: 'Risk Probability',
          helpText: 'Expected probability after mitigation or acceptance decisions are applied.',
        },
        {
          displayName: 'Residual Impact',
          systemName: 'residual_impact',
          fieldType: 'Risk Consequence',
          helpText: 'Expected consequence after mitigation or acceptance decisions are applied.',
        },
        {
          displayName: 'Residual Risk Level',
          systemName: 'residual_risk_level',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Overall residual risk rating after the planned treatment is considered.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize supporting evidence, proofs, or artifacts used in the risk decision or mitigation plan.',
        },
      ],
    }),
    sectionWithFields('Lenses & Trend', {
      isSystem: true,
      fields: [
        {
          displayName: 'Assessment Reference',
          systemName: 'assessment_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the assessment, analysis, or review package that informed the current risk rating.',
        },
        {
          displayName: 'Project Cost Impact',
          systemName: 'project_cost_impact',
          fieldType: 'Text Area',
          helpText: 'Capture how the risk could affect project cost, budget posture, or investment decisions.',
        },
        {
          displayName: 'Project Schedule Impact',
          systemName: 'project_schedule_impact',
          fieldType: 'Text Area',
          helpText: 'Capture how the risk could affect delivery dates, milestones, or schedule confidence.',
        },
        {
          displayName: 'Control Implementation Impact',
          systemName: 'control_implementation_impact',
          fieldType: 'Text Area',
          helpText: 'Describe how the risk affects security-control implementation, effectiveness, or sustainment decisions.',
        },
        {
          displayName: 'Budget Decision Summary',
          systemName: 'budget_decision_summary',
          fieldType: 'Text Area',
          helpText: 'Explain how the current risk posture influences budgeting, investment, or prioritization decisions.',
        },
        {
          displayName: 'Contingency Plan',
          systemName: 'contingency_plan',
          fieldType: 'Text Area',
          helpText: 'Document the fallback response, continuity steps, or management actions that should be executed if the risk is realized.',
        },
        {
          displayName: 'Realized Event Summary',
          systemName: 'realized_event_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize what happened if the risk materialized, including the impact, incident context, or key lessons learned.',
        },
        {
          displayName: 'Business Risk Lens',
          systemName: 'business_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score business impact separately when the risk affects mission delivery, cost, or strategic goals.',
        },
        {
          displayName: 'Operational Risk Lens',
          systemName: 'operational_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score operational impact when the risk affects service delivery, reliability, or throughput.',
        },
        {
          displayName: 'Safety Risk Lens',
          systemName: 'safety_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score safety implications for personnel, facilities, or physical operations.',
        },
        {
          displayName: 'Security Risk Lens',
          systemName: 'security_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score security implications for confidentiality, integrity, and availability.',
        },
        {
          displayName: 'Quality Risk Lens',
          systemName: 'quality_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score product, process, or service quality implications separately from overall impact.',
        },
        {
          displayName: 'Environmental Risk Lens',
          systemName: 'environmental_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score sustainability or environmental consequences when they matter for this risk.',
        },
        {
          displayName: 'Reputation Risk Lens',
          systemName: 'reputation_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score brand, trust, or stakeholder confidence impacts separately from operational effects.',
        },
        {
          displayName: 'Compliance Risk Lens',
          systemName: 'compliance_regulatory_risk_lens',
          fieldType: 'Select',
          choices: [seedChoice('No Material Impact'), seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Score compliance or regulatory exposure when fines, findings, or contract loss are possible.',
        },
        {
          displayName: 'Trend Snapshot Date',
          systemName: 'trend_snapshot_date',
          fieldType: 'Date',
          helpText: 'Record the snapshot date used to compare the current risk posture to a prior point in time.',
        },
        {
          displayName: 'Previous Risk Level',
          systemName: 'previous_risk_level',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Document the prior overall rating when trend analysis is being performed.',
        },
        {
          displayName: 'Trend Direction',
          systemName: 'trend_direction',
          fieldType: 'Select',
          choices: [seedChoice('Increasing'), seedChoice('Stable'), seedChoice('Decreasing'), seedChoice('New')],
          helpText: 'Summarize whether the risk is getting worse, staying stable, improving, or newly identified.',
        },
        {
          displayName: 'Next Trend Snapshot Due',
          systemName: 'next_trend_snapshot_due',
          fieldType: 'Date',
          helpText: 'Track when the next formal trend snapshot should be captured to keep the risk evergreen.',
        },
        {
          displayName: 'Trend Summary',
          systemName: 'trend_summary',
          fieldType: 'Text Area',
          helpText: 'Explain what changed since the prior snapshot and why the current posture differs from the previous one.',
        },
      ],
    }),
  ];

  const riskRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require risk statement, owner, likelihood, impact, and level when risk is active',
      logic: 'OR',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'status', operator: 'EQUALS', valueSource: 'constant', value: 'Open' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'status', operator: 'EQUALS', valueSource: 'constant', value: 'Accepted' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'status', operator: 'EQUALS', valueSource: 'constant', value: 'Mitigating' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'risk_statement' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'owner' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'likelihood' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'impact' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'risk_level' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require treatment strategy, mitigation, and review cadence when risk is mitigating',
      logic: 'AND',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'status', operator: 'EQUALS', valueSource: 'constant', value: 'Mitigating' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'treatment_strategy' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'mitigation' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'mitigation_progress' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'mitigation_owner' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_frequency' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_date' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require decision maker and residual rating when risk is accepted',
      logic: 'OR',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'status', operator: 'EQUALS', valueSource: 'constant', value: 'Accepted' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'treatment_strategy', operator: 'EQUALS', valueSource: 'constant', value: 'Accept' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'decision_maker' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'approval_status' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'accepted_on' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'acceptance_rationale' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_summary' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'residual_risk_level' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require trigger events when risk level is high or critical',
      logic: 'OR',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'risk_level', operator: 'EQUALS', valueSource: 'constant', value: 'High' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'risk_level', operator: 'EQUALS', valueSource: 'constant', value: 'Critical' },
      ],
      actions: [{ id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'trigger_events' }],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require contingency planning when risk is high or worsening',
      logic: 'OR',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'risk_level', operator: 'EQUALS', valueSource: 'constant', value: 'High' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'risk_level', operator: 'EQUALS', valueSource: 'constant', value: 'Critical' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'trend_direction', operator: 'EQUALS', valueSource: 'constant', value: 'Increasing' },
      ],
      actions: [{ id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'contingency_plan' }],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require threat summary when assessment reference is recorded',
      logic: 'AND',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'assessment_reference', operator: 'HAS_VALUE', valueSource: 'constant', value: '' },
      ],
      actions: [{ id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'threat_summary' }],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require trend context when trend direction is tracked',
      logic: 'AND',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'trend_direction', operator: 'HAS_VALUE', valueSource: 'constant', value: '' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'trend_snapshot_date' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'previous_risk_level' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'next_trend_snapshot_due' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'trend_summary' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require review summary when approval status is set',
      logic: 'OR',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'approval_status', operator: 'EQUALS', valueSource: 'constant', value: 'Pending Review' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'approval_status', operator: 'EQUALS', valueSource: 'constant', value: 'Approved' },
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'approval_status', operator: 'EQUALS', valueSource: 'constant', value: 'Rejected' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_summary' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_date' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'decision_maker' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require escalation context when risk is out of tolerance',
      logic: 'AND',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'risk_tolerance', operator: 'EQUALS', valueSource: 'constant', value: 'Out of Tolerance' },
      ],
      actions: [
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'decision_maker' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'review_summary' },
        { id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'contingency_plan' },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require realized date when realized event summary is recorded',
      logic: 'AND',
      conditions: [
        { id: crypto.randomUUID(), conditionType: 'Field', target: 'realized_event_summary', operator: 'HAS_VALUE', valueSource: 'constant', value: '' },
      ],
      actions: [{ id: crypto.randomUUID(), actionType: 'REQUIRE', targetType: 'Field', target: 'realized_on' }],
    },
  ];

  const assetSections = [
    sectionWithFields('Asset Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        { displayName: 'Asset ID', systemName: 'asset_id', fieldType: 'Text Field', required: true },
        { displayName: 'Name', systemName: 'name', fieldType: 'Text Field', required: true },
        {
          displayName: 'Type',
          systemName: 'type',
          fieldType: 'Select',
          choices: [
            seedChoice('Server'),
            seedChoice('Workstation'),
            seedChoice('Network Device'),
            seedChoice('Application'),
            seedChoice('Database'),
            seedChoice('Service'),
          ],
        },
        { displayName: 'IP Address', systemName: 'ip_address', fieldType: 'IP Address' },
        { displayName: 'Operating System', systemName: 'os', fieldType: 'Text Field' },
        { displayName: 'Platform', systemName: 'platform', fieldType: 'Text Field' },
        { displayName: 'Location', systemName: 'location', fieldType: 'Text Field' },
        { displayName: 'Owner', systemName: 'owner', fieldType: 'Users', selectType: 'users' },
        { displayName: 'Custodian', systemName: 'custodian', fieldType: 'Text Field' },
        {
          displayName: 'Classification',
          systemName: 'classification',
          fieldType: 'Select',
          choices: [seedChoice('Public'), seedChoice('Internal'), seedChoice('Confidential'), seedChoice('Restricted')],
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [seedChoice('Active'), seedChoice('Planned'), seedChoice('In Maintenance'), seedChoice('Retired')],
        },
        { displayName: 'Purchase Date', systemName: 'purchase_date', fieldType: 'Date' },
        { displayName: 'End of Life Date', systemName: 'end_of_life_date', fieldType: 'Date' },
        {
          displayName: 'Lifecycle Status',
          systemName: 'lifecycle_status',
          fieldType: 'Select',
          choices: [seedChoice('Planned'), seedChoice('Active'), seedChoice('In Maintenance'), seedChoice('Retired')],
        },
        {
          displayName: 'Inventory Status',
          systemName: 'inventory_status',
          fieldType: 'Select',
          choices: [seedChoice('Discovered'), seedChoice('Verified'), seedChoice('Needs Review'), seedChoice('Archived')],
        },
        { displayName: 'Description', systemName: 'description', fieldType: 'Text Area' },
      ],
    }),
  ];

  const issueSections = [
    sectionWithFields('Issue Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the issue, finding, or non-compliance so responders can identify it quickly.',
        },
        {
          displayName: 'Issue Reference',
          systemName: 'issue_reference',
          fieldType: 'Text Field',
          helpText: 'Optional identifier for the finding, POA&M item, or internal issue-tracking record.',
        },
        {
          displayName: 'Issue Type',
          systemName: 'issue_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Finding'),
            seedChoice('Deficiency'),
            seedChoice('POA&M'),
            seedChoice('Opportunity for Improvement'),
            seedChoice('Weakness'),
            seedChoice('Other'),
          ],
          helpText: 'Choose the closest issue synonym so reporting stays consistent across audits and programs.',
        },
        {
          displayName: 'Severity',
          systemName: 'severity',
          fieldType: 'Select',
          required: true,
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Use severity to communicate urgency and prioritize remediation work.',
        },
        {
          displayName: 'Discovered On',
          systemName: 'discovered_on',
          fieldType: 'Date',
          helpText: 'Record when the issue was identified or formally logged.',
        },
        {
          displayName: 'Source Record',
          systemName: 'source_record',
          fieldType: 'Text Field',
          helpText: 'Reference the assessment, audit, review, incident, or other source that discovered the issue.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for driving the issue toward remediation and closure.',
        },
        {
          displayName: 'Due Date',
          systemName: 'due_date',
          fieldType: 'Date',
          helpText: 'Target date for remediation completion or issue closure.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Open'),
            seedChoice('In Progress'),
            seedChoice('Pending Validation'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the issue from intake through remediation validation and final closure.',
        },
      ],
    }),
    sectionWithFields('Analysis & Evidence', {
      isSystem: true,
      fields: [
        {
          displayName: 'Requirement or Policy Reference',
          systemName: 'requirement_or_policy_reference',
          fieldType: 'Text Field',
          helpText: 'Identify the law, regulation, policy, procedure, requirement, or control that was not met.',
        },
        {
          displayName: 'Impact Summary',
          systemName: 'impact_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the compliance, operational, customer, or regulatory impact created by the issue.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Document the evidence, proof points, or supporting artifacts that substantiate the issue.',
        },
        {
          displayName: 'Root Cause',
          systemName: 'root_cause',
          fieldType: 'Text Area',
          helpText: 'Describe the underlying cause once investigation or causal analysis identifies why the issue occurred.',
        },
      ],
    }),
    sectionWithFields('Remediation', {
      isSystem: true,
      fields: [
        {
          displayName: 'Corrective Action Owner',
          systemName: 'corrective_action_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for implementing the corrective action plan or POA&M workstream.',
        },
        {
          displayName: 'Remediation Plan',
          systemName: 'remediation_plan',
          fieldType: 'Text Area',
          helpText: 'Describe the corrective actions, milestones, or work plan needed to resolve the issue.',
        },
        {
          displayName: 'Verification Plan',
          systemName: 'verification_plan',
          fieldType: 'Text Area',
          helpText: 'Explain how the team will validate the issue was remediated and will not recur.',
        },
        {
          displayName: 'Closed Date',
          systemName: 'closed_date',
          fieldType: 'Date',
          helpText: 'Date the issue was formally closed after remediation and validation were complete.',
        },
        {
          displayName: 'Closure Summary',
          systemName: 'closure_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize how the issue was resolved, what was validated, and any remaining obligations.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general notes, broader remediation context, or administrative comments.',
        },
      ],
    }),
  ];

  const caseManagementSections = [
    sectionWithFields('Case Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the case so investigators and responders can identify it quickly.',
        },
        {
          displayName: 'Case Reference',
          systemName: 'case_reference',
          fieldType: 'Text Field',
          helpText: 'Optional legal, HR, or security case identifier.',
        },
        {
          displayName: 'Case Type',
          systemName: 'case_type',
          fieldType: 'Select',
          choices: [
            seedChoice('HR'),
            seedChoice('Legal'),
            seedChoice('Security'),
            seedChoice('Compliance'),
            seedChoice('Other'),
          ],
        },
        {
          displayName: 'Severity',
          systemName: 'severity',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
        },
        {
          displayName: 'Reported At',
          systemName: 'reported_at',
          fieldType: 'Date',
        },
        {
          displayName: 'Reported By',
          systemName: 'reported_by',
          fieldType: 'Text Field',
        },
        {
          displayName: 'Response Due Date',
          systemName: 'response_due_date',
          fieldType: 'Date',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('In Review'),
            seedChoice('Closed'),
          ],
        },
        {
          displayName: 'Phase',
          systemName: 'phase',
          fieldType: 'Select',
          choices: [
            seedChoice('Reported'),
            seedChoice('Triage'),
            seedChoice('Investigation'),
            seedChoice('Mitigation'),
            seedChoice('Disposition'),
            seedChoice('Closed'),
          ],
        },
      ],
    }),
    sectionWithFields('Investigation & Risk', {
      isSystem: true,
      fields: [
        {
          displayName: 'Risk Summary',
          systemName: 'risk_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the primary risk, severity trend, or potential exposure created by the case.',
        },
        {
          displayName: 'Legal Exposure',
          systemName: 'legal_exposure',
          fieldType: 'Text Area',
          helpText: 'Capture regulatory, contractual, personnel, or legal implications.',
        },
        {
          displayName: 'Root Cause',
          systemName: 'root_cause',
          fieldType: 'Text Area',
          helpText: 'Document the root cause once investigation or causal analysis identifies it.',
        },
        {
          displayName: 'Forensic Timeline Summary',
          systemName: 'forensic_timeline_summary',
          fieldType: 'Text Area',
          helpText: 'Key events, event ordering, or timeline highlights collected during the case.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize evidence collected, requested, or turned over for this case.',
        },
      ],
    }),
    sectionWithFields('Disposition & Corrective Action', {
      isSystem: true,
      fields: [
        {
          displayName: 'Disposition',
          systemName: 'disposition',
          fieldType: 'Text Area',
          helpText: 'Final or proposed case disposition and resolution summary.',
        },
        {
          displayName: 'Disposition Date',
          systemName: 'disposition_date',
          fieldType: 'Date',
        },
        {
          displayName: 'Mitigation Actions',
          systemName: 'mitigation_actions',
          fieldType: 'Text Area',
          helpText: 'Corrective actions, mitigations, or response follow-up steps tied to the case.',
        },
      ],
    }),
  ];

  const changeManagementSections = [
    sectionWithFields('RFC Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the request for change so the affected service, system, or release is immediately clear.',
        },
        {
          displayName: 'RFC ID',
          systemName: 'rfc_id',
          fieldType: 'Text Field',
          helpText: 'Optional request-for-change identifier used by the change-management team.',
        },
        {
          displayName: 'Change Type',
          systemName: 'change_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Standard'),
            seedChoice('Normal'),
            seedChoice('Emergency'),
            seedChoice('Major'),
            seedChoice('Minor'),
            seedChoice('Routine'),
          ],
          helpText: 'Classify the change so approvals, risk posture, and reporting remain consistent.',
        },
        {
          displayName: 'Priority',
          systemName: 'priority',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Medium'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
        },
        {
          displayName: 'Requested By',
          systemName: 'requested_by',
          fieldType: 'Text Field',
          helpText: 'Capture the requester, sponsor, or team that initiated the RFC.',
        },
        {
          displayName: 'Affected Service',
          systemName: 'affected_service',
          fieldType: 'Text Field',
          helpText: 'Identify the service, application, or product area impacted by the change.',
        },
        {
          displayName: 'Affected System',
          systemName: 'affected_system',
          fieldType: 'Text Field',
          helpText: 'Capture the system, platform, environment, or infrastructure component being changed.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Identify the person or team accountable for coordinating the change end to end.',
        },
        {
          displayName: 'Change Phase',
          systemName: 'change_phase',
          fieldType: 'Select',
          choices: [
            seedChoice('RFC'),
            seedChoice('Assessment'),
            seedChoice('Approval'),
            seedChoice('Implementation'),
            seedChoice('Review'),
            seedChoice('Closure'),
          ],
          helpText: 'Track the current ITIL-style phase from intake through closure.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('In Review'),
            seedChoice('Closed'),
          ],
        },
        {
          displayName: 'Business Justification',
          systemName: 'business_justification',
          fieldType: 'Text Area',
          helpText: 'Explain why the change is needed and what business or compliance value it is expected to deliver.',
        },
        {
          displayName: 'Expected Benefits',
          systemName: 'expected_benefits',
          fieldType: 'Text Area',
          helpText: 'Describe the expected operational, service, or compliance outcome of the change.',
        },
      ],
    }),
    sectionWithFields('Assessment & Approval', {
      isSystem: true,
      fields: [
        {
          displayName: 'Risk Rating',
          systemName: 'risk_rating',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Rate the risk of service disruption, security exposure, or business impact during implementation.',
        },
        {
          displayName: 'Change Assessment',
          systemName: 'change_assessment',
          fieldType: 'Text Area',
          helpText: 'Capture impact, dependency, service, cost, and benefit analysis performed before approval.',
        },
        {
          displayName: 'Approval Status',
          systemName: 'approval_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending'),
            seedChoice('Approved'),
            seedChoice('Rejected'),
          ],
        },
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Text Field',
          helpText: 'Record the approving authority, CAB, or delegated reviewer.',
        },
        {
          displayName: 'Change Board',
          systemName: 'change_board',
          fieldType: 'Text Field',
          helpText: 'Capture the CAB, governance board, or service-review body responsible for the approval path.',
        },
        {
          displayName: 'Implementation Plan',
          systemName: 'implementation_plan',
          fieldType: 'Text Area',
          helpText: 'Document testing, training, stakeholder communications, and execution steps for the change.',
        },
        {
          displayName: 'Testing Plan',
          systemName: 'testing_plan',
          fieldType: 'Text Area',
          helpText: 'Describe validation and testing required before the change can be considered ready to implement.',
        },
        {
          displayName: 'Communication Plan',
          systemName: 'communication_plan',
          fieldType: 'Text Area',
          helpText: 'Record service notices, stakeholder communication steps, and coordination expectations.',
        },
        {
          displayName: 'Training Plan',
          systemName: 'training_plan',
          fieldType: 'Text Area',
          helpText: 'Capture any operator, support, or end-user training required before or after rollout.',
        },
        {
          displayName: 'Outage Window',
          systemName: 'outage_window',
          fieldType: 'Text Field',
          helpText: 'Document the maintenance or approved service interruption window tied to the change.',
        },
        {
          displayName: 'Rollback Plan',
          systemName: 'rollback_plan',
          fieldType: 'Text Area',
          helpText: 'Describe how the team will back out the change if implementation introduces unacceptable disruption.',
        },
      ],
    }),
    sectionWithFields('Implementation & Review', {
      isSystem: true,
      fields: [
        {
          displayName: 'Planned Start',
          systemName: 'planned_start',
          fieldType: 'Date',
        },
        {
          displayName: 'Planned Finish',
          systemName: 'planned_finish',
          fieldType: 'Date',
        },
        {
          displayName: 'Actual Start',
          systemName: 'actual_start',
          fieldType: 'Date',
        },
        {
          displayName: 'Actual Finish',
          systemName: 'actual_finish',
          fieldType: 'Date',
        },
        {
          displayName: 'Implementation Status',
          systemName: 'implementation_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Ready'),
            seedChoice('In Progress'),
            seedChoice('Completed'),
            seedChoice('Rolled Back'),
            seedChoice('Cancelled'),
          ],
        },
        {
          displayName: 'Review Outcome',
          systemName: 'review_outcome',
          fieldType: 'Text Area',
          helpText: 'Summarize whether the change succeeded, whether incidents occurred, and whether follow-up work is required.',
        },
        {
          displayName: 'Post-Implementation Review Date',
          systemName: 'post_implementation_review_date',
          fieldType: 'Date',
          helpText: 'Schedule or capture the formal post-implementation review checkpoint for the change.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Capture implementation evidence, testing records, stakeholder communications, or other validation material.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for any additional narrative about the change, affected environment, or follow-up notes.',
        },
      ],
    }),
  ];

  const componentSections = [
    sectionWithFields('Component Definition', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the hardware, software, service, policy, process, or procedure component being documented.',
        },
        {
          displayName: 'Component ID',
          systemName: 'component_id',
          fieldType: 'Text Field',
          helpText: 'Optional OSCAL or tenant-specific component identifier.',
        },
        {
          displayName: 'Component Type',
          systemName: 'component_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Hardware'),
            seedChoice('Software'),
            seedChoice('Service'),
            seedChoice('Policy'),
            seedChoice('Process'),
            seedChoice('Procedure'),
            seedChoice('Compliance Artifact'),
            seedChoice('Common Control'),
          ],
          helpText: 'Classify the implementation artifact the component definition represents.',
        },
        {
          displayName: 'Vendor',
          systemName: 'vendor',
          fieldType: 'Text Field',
          helpText: 'Record the vendor, provider, or source organization responsible for the component implementation.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Identify the person or SME team accountable for maintaining this component definition.',
        },
        {
          displayName: 'Capability',
          systemName: 'capability',
          fieldType: 'Text Field',
          helpText: 'Link the component to a broader capability or grouped implementation set.',
        },
        {
          displayName: 'Security Plan',
          systemName: 'security_plan',
          fieldType: 'Text Field',
          helpText: 'Capture the SSP or implementation boundary this component most directly supports.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Describe what the component is and how it contributes to the broader implementation.',
        },
      ],
    }),
    sectionWithFields('Control Support & Implementation', {
      isSystem: true,
      fields: [
        {
          displayName: 'Supported Controls Count',
          systemName: 'supported_controls_count',
          fieldType: 'Whole Number',
          helpText: 'Track how many controls the component helps satisfy or partially satisfy.',
        },
        {
          displayName: 'Control Coverage Summary',
          systemName: 'control_coverage_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize supported controls, partial responsibilities, or common-control layering for the component.',
        },
        {
          displayName: 'Implementation Statement',
          systemName: 'implementation_statement',
          fieldType: 'Rich Text',
          helpText: 'Capture reusable implementation details that can accelerate SSP authoring and evidence gathering.',
        },
        {
          displayName: 'Assessment Status',
          systemName: 'assessment_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Assessed'),
            seedChoice('Planned'),
            seedChoice('In Progress'),
            seedChoice('Validated'),
            seedChoice('Deficient'),
          ],
          helpText: 'Record the current validation or assessment posture for the component.',
        },
        {
          displayName: 'Last Tested Date',
          systemName: 'last_tested_date',
          fieldType: 'Date',
        },
      ],
    }),
    sectionWithFields('Authorization & Lifecycle', {
      isSystem: true,
      fields: [
        {
          displayName: 'Authorization Status',
          systemName: 'authorization_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Authorized'),
            seedChoice('Conditionally Authorized'),
            seedChoice('Expired'),
            seedChoice('Retired'),
          ],
          helpText: 'Capture the current authorization or approval posture for the component.',
        },
        {
          displayName: 'Authorization Expiration',
          systemName: 'authorization_expiration',
          fieldType: 'Date',
        },
        {
          displayName: 'Common Control Provider',
          systemName: 'common_control_provider',
          fieldType: 'Text Field',
          helpText: 'Document the internal or external provider responsible for common control implementation, if applicable.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize key documentation, validation artifacts, or provider evidence that supports this component.',
        },
      ],
    }),
  ];

  const dataCallSections = [
    sectionWithFields('Request Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the data call, request for information, or evidence collection effort.',
        },
        {
          displayName: 'Request Reference',
          systemName: 'request_reference',
          fieldType: 'Text Field',
          helpText: 'Optional internal tracking code, regulator request ID, or audit-prep reference.',
        },
        {
          displayName: 'Request Type',
          systemName: 'request_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Request for Information'),
            seedChoice('Discovery'),
            seedChoice('Pre-Read'),
            seedChoice('Evidence Collection'),
            seedChoice('Regulatory Response'),
            seedChoice('Recurring Deliverable'),
          ],
          helpText: 'Describe the type of information or evidence request this data call represents.',
        },
        {
          displayName: 'Requested By',
          systemName: 'requested_by',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Internal requester, assessor, or stakeholder that initiated the data call.',
        },
        {
          displayName: 'Requested To',
          systemName: 'requested_to',
          fieldType: 'Text Field',
          helpText: 'Person, team, site, or external party expected to provide the requested material.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Internal owner responsible for coordinating the request and tracking delivery.',
        },
        {
          displayName: 'Requested At',
          systemName: 'requested_at',
          fieldType: 'Date',
          required: true,
        },
        {
          displayName: 'Due Date',
          systemName: 'due_date',
          fieldType: 'Date',
          required: true,
        },
        {
          displayName: 'Site or Facility',
          systemName: 'site_or_facility',
          fieldType: 'Text Field',
          helpText: 'Facility, site, or operating location associated with the request.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Requested'),
            seedChoice('In Collection'),
            seedChoice('Delivered'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the current delivery posture for the data call.',
        },
      ],
    }),
    sectionWithFields('Evidence & Delivery', {
      isSystem: true,
      fields: [
        {
          displayName: 'Assessment or Matter',
          systemName: 'assessment_or_matter',
          fieldType: 'Text Field',
          helpText: 'Assessment, audit, compliance matter, or regulatory request this data call supports.',
        },
        {
          displayName: 'Pre-Read Objective',
          systemName: 'pre_read_objective',
          fieldType: 'Text Area',
          helpText: 'Describe why the evidence is needed and how it supports audit preparation or assessment planning.',
        },
        {
          displayName: 'Provided To',
          systemName: 'provided_to',
          fieldType: 'Text Field',
          helpText: 'Record the regulator, assessor, customer, or internal party that ultimately received the response.',
        },
        {
          displayName: 'Delivery Method',
          systemName: 'delivery_method',
          fieldType: 'Select',
          choices: [
            seedChoice('Portal Upload'),
            seedChoice('Email'),
            seedChoice('API'),
            seedChoice('Secure Transfer'),
            seedChoice('Live Review'),
          ],
          helpText: 'How the response package or evidence set was delivered.',
        },
        {
          displayName: 'Delivery Date',
          systemName: 'delivery_date',
          fieldType: 'Date',
          helpText: 'Date the requested material was actually delivered or made available.',
        },
        {
          displayName: 'Evidence Count',
          systemName: 'evidence_count',
          fieldType: 'Whole Number',
          helpText: 'Track how many evidence items or files have been collected for this request.',
        },
        {
          displayName: 'Completion Percent',
          systemName: 'completion_percent',
          fieldType: 'Whole Number',
          helpText: 'Progress indicator for evidence collection or response readiness, typically from 0 to 100.',
        },
        {
          displayName: 'Request Details',
          systemName: 'request_details',
          fieldType: 'Text Area',
          helpText: 'Summarize the requested material, pre-read needs, and response expectations.',
        },
        {
          displayName: 'Response Package Summary',
          systemName: 'response_package_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the delivered package, included artifacts, and any important caveats for reviewers.',
        },
      ],
    }),
    sectionWithFields('Recurrence & Audit Trail', {
      isSystem: true,
      fields: [
        {
          displayName: 'Recurrence',
          systemName: 'recurrence',
          fieldType: 'Select',
          choices: [
            seedChoice('One-time'),
            seedChoice('Weekly'),
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Annually'),
          ],
          helpText: 'Use recurrence for routine regulator, customer, or internal evidence requests.',
        },
        {
          displayName: 'Next Due Date',
          systemName: 'next_due_date',
          fieldType: 'Date',
          helpText: 'Next planned delivery date when the data call recurs.',
        },
        {
          displayName: 'Audit Trail Summary',
          systemName: 'audit_trail_summary',
          fieldType: 'Text Area',
          helpText: 'Document who provided what, to whom, and when so the response remains audit-ready.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general notes, escalation context, or supporting narrative.',
        },
      ],
    }),
  ];

  const evidenceLockerSections = [
    sectionWithFields('Evidence Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the evidence item so teams can recognize and reuse it across audit activities.',
        },
        {
          displayName: 'Evidence Owner',
          systemName: 'evidence_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for maintaining the evidence and responding to update requests.',
        },
        {
          displayName: 'Evidence Type',
          systemName: 'evidence_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Policy'),
            seedChoice('Procedure'),
            seedChoice('Report'),
            seedChoice('Configuration'),
            seedChoice('Screenshot'),
            seedChoice('Log Extract'),
            seedChoice('Attestation'),
            seedChoice('Other'),
          ],
          helpText: 'Describe the kind of artifact stored in the evidence locker.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('In Review'),
            seedChoice('Closed'),
          ],
          helpText: 'Track whether the evidence item is active, under review, or retired from use.',
        },
        {
          displayName: 'Related Record',
          systemName: 'related_record',
          fieldType: 'Text Field',
          helpText: 'Optional source request, assessment, or other originating record for this evidence item.',
        },
      ],
    }),
    sectionWithFields('Reuse & Mapping', {
      isSystem: true,
      fields: [
        {
          displayName: 'Related System',
          systemName: 'related_system',
          fieldType: 'Text Field',
          helpText: 'System, boundary, or program that leverages this evidence.',
        },
        {
          displayName: 'Related Component',
          systemName: 'related_component',
          fieldType: 'Text Field',
          helpText: 'Component or shared service associated with the evidence item.',
        },
        {
          displayName: 'Shared Service Scope',
          systemName: 'shared_service_scope',
          fieldType: 'Text Area',
          helpText: 'Describe the shared-service or cross-system scope where this evidence can be reused.',
        },
        {
          displayName: 'Mapped Control Summary',
          systemName: 'mapped_control_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the controls, implementations, or requirements satisfied by this evidence.',
        },
        {
          displayName: 'Control Count',
          systemName: 'control_count',
          fieldType: 'Whole Number',
          helpText: 'Track how many control implementations are mapped to this evidence item.',
        },
        {
          displayName: 'Attestation Scope',
          systemName: 'attestation_scope',
          fieldType: 'Text Area',
          helpText: 'Document the attestation boundary, reusable assertion, or cross-system compliance scope.',
        },
      ],
    }),
    sectionWithFields('Lifecycle & Audit Readiness', {
      isSystem: true,
      fields: [
        {
          displayName: 'Update Frequency',
          systemName: 'update_frequency',
          fieldType: 'Select',
          choices: [
            seedChoice('Ad Hoc'),
            seedChoice('Every 30 Days'),
            seedChoice('Every 60 Days'),
            seedChoice('Every 90 Days'),
            seedChoice('Quarterly'),
            seedChoice('Semi-Annually'),
            seedChoice('Annually'),
          ],
          helpText: 'Cadence for refreshing the evidence so audit-readiness timelines stay current.',
        },
        {
          displayName: 'Last Updated On',
          systemName: 'last_updated_on',
          fieldType: 'Date',
          helpText: 'Most recent evidence refresh or upload date.',
        },
        {
          displayName: 'Next Due Date',
          systemName: 'next_due_date',
          fieldType: 'Date',
          helpText: 'Next planned refresh date based on the update cadence.',
        },
        {
          displayName: 'File Count',
          systemName: 'file_count',
          fieldType: 'Whole Number',
          helpText: 'Number of attached files or evidence artifacts currently associated with this item.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize what the evidence contains and any important context for reviewers.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general notes, handling context, or lifecycle commentary.',
        },
      ],
    }),
  ];

  const exceptionSections = [
    sectionWithFields('Exception Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the exception request so reviewers can identify the affected requirement or control quickly.',
        },
        {
          displayName: 'Exception Reference',
          systemName: 'exception_reference',
          fieldType: 'Text Field',
          helpText: 'Optional internal tracking ID, waiver number, or auditor-facing reference.',
        },
        {
          displayName: 'Exception Type',
          systemName: 'exception_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Policy'),
            seedChoice('Control'),
            seedChoice('Requirement'),
            seedChoice('Procedure'),
            seedChoice('Configuration'),
            seedChoice('Other'),
          ],
          helpText: 'Describe the kind of requirement, policy, or control relief being requested.',
        },
        {
          displayName: 'Control or Requirement Reference',
          systemName: 'control_or_requirement_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the specific control, requirement, policy section, or standard involved.',
        },
        {
          displayName: 'Exception Scope',
          systemName: 'exception_scope',
          fieldType: 'Text Area',
          helpText: 'Document the affected system, process, site, or operational boundary for the exception.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for the exception, compensating controls, and renewal actions.',
        },
        {
          displayName: 'Requested By',
          systemName: 'requested_by',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Requester, system owner, or stakeholder sponsoring the exception request.',
        },
        {
          displayName: 'Requested At',
          systemName: 'requested_at',
          fieldType: 'Date',
          required: true,
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending Approval'),
            seedChoice('Approved'),
            seedChoice('Expired'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the lifecycle of the exception request from draft through expiration or closure.',
        },
        {
          displayName: 'Approval Status',
          systemName: 'approval_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending'),
            seedChoice('Approved'),
            seedChoice('Rejected'),
          ],
          helpText: 'Approval workflow state for the exception.',
        },
      ],
    }),
    sectionWithFields('Justification & Risk', {
      isSystem: true,
      fields: [
        {
          displayName: 'Justification',
          systemName: 'justification',
          fieldType: 'Text Area',
          helpText: 'Explain why temporary relief is needed and why immediate compliance is not feasible.',
        },
        {
          displayName: 'Technical Feasibility',
          systemName: 'technical_feasibility',
          fieldType: 'Text Area',
          helpText: 'Describe technical constraints or implementation barriers relevant to the request.',
        },
        {
          displayName: 'Cost Feasibility',
          systemName: 'cost_feasibility',
          fieldType: 'Text Area',
          helpText: 'Capture cost, funding, or resource constraints that influence the exception request.',
        },
        {
          displayName: 'Risk Rating',
          systemName: 'risk_rating',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Overall risk posture associated with the temporary non-compliance.',
        },
        {
          displayName: 'Business Impact',
          systemName: 'business_impact',
          fieldType: 'Text Area',
          helpText: 'Describe operational, customer, contractual, or mission impact if the exception is denied or delayed.',
        },
        {
          displayName: 'Risk Assessment Summary',
          systemName: 'risk_assessment_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the formal or informal risk assessment supporting the exception request.',
        },
        {
          displayName: 'Residual Risk Statement',
          systemName: 'residual_risk_statement',
          fieldType: 'Text Area',
          helpText: 'Document the residual risk being accepted while the exception remains active.',
        },
        {
          displayName: 'Compensating Controls',
          systemName: 'compensating_controls',
          fieldType: 'Text Area',
          helpText: 'Document mitigating safeguards or alternate controls that reduce risk while the exception is active.',
        },
        {
          displayName: 'Mitigation Plan',
          systemName: 'mitigation_plan',
          fieldType: 'Text Area',
          helpText: 'Describe the plan for closing the compliance gap or transitioning off the exception.',
        },
      ],
    }),
    sectionWithFields('Approval & Lifecycle', {
      isSystem: true,
      fields: [
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Approver responsible for accepting, rejecting, or renewing the exception.',
        },
        {
          displayName: 'Approval Date',
          systemName: 'approval_date',
          fieldType: 'Date',
          helpText: 'Date the exception request was formally approved or rejected.',
        },
        {
          displayName: 'Expiration Date',
          systemName: 'expiration_date',
          fieldType: 'Date',
          helpText: 'Date the temporary relief expires and requires renewal, closure, or remediation.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Next planned review date for renewal, reassessment, or closeout.',
        },
        {
          displayName: 'Renewal Decision',
          systemName: 'renewal_decision',
          fieldType: 'Select',
          choices: [
            seedChoice('Renew'),
            seedChoice('Remediate'),
            seedChoice('Close'),
            seedChoice('Reject'),
          ],
          helpText: 'Decision taken at renewal or expiration time.',
        },
        {
          displayName: 'Renewal Rationale',
          systemName: 'renewal_rationale',
          fieldType: 'Text Area',
          helpText: 'Capture why the exception was renewed, closed, rejected, or transitioned to remediation.',
        },
        {
          displayName: 'Closure Notes',
          systemName: 'closure_notes',
          fieldType: 'Text Area',
          helpText: 'Capture closeout rationale, expiration handling, or auditor-facing summary notes.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general administrative notes, workflow context, or additional lifecycle commentary.',
        },
      ],
    }),
  ];

  const incidentSections = [
    sectionWithFields('Incident Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the incident so responders can identify and triage it quickly.',
        },
        {
          displayName: 'Incident Reference',
          systemName: 'incident_reference',
          fieldType: 'Text Field',
          helpText: 'Optional SOC ticket, incident number, or external case reference.',
        },
        {
          displayName: 'Incident Type',
          systemName: 'incident_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Cyber Security'),
            seedChoice('Physical Security'),
            seedChoice('Safety'),
            seedChoice('Privacy'),
            seedChoice('Insider Threat'),
            seedChoice('Service Disruption'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the type of negative event being managed.',
        },
        {
          displayName: 'Severity',
          systemName: 'severity',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Capture the severity so response and escalation can be prioritized.',
        },
        {
          displayName: 'Reported At',
          systemName: 'reported_at',
          fieldType: 'Date',
          helpText: 'When the incident was first reported or raised into the response workflow.',
        },
        {
          displayName: 'Detected At',
          systemName: 'detected_at',
          fieldType: 'Date',
          helpText: 'When the incident was detected or confirmed by the organization.',
        },
        {
          displayName: 'Response Phase',
          systemName: 'response_phase',
          fieldType: 'Select',
          choices: [
            seedChoice('Reported'),
            seedChoice('Triage'),
            seedChoice('Containment'),
            seedChoice('Investigation'),
            seedChoice('Recovery'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the incident through the response lifecycle from triage to recovery.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Responder or team accountable for coordinating the incident response.',
        },
        {
          displayName: 'Affected Asset or System',
          systemName: 'affected_asset_or_system',
          fieldType: 'Text Field',
          helpText: 'Primary asset, system, service, or operational domain affected by the incident.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Open'),
            seedChoice('Active'),
            seedChoice('Contained'),
            seedChoice('Recovered'),
            seedChoice('Closed'),
          ],
          helpText: 'Current response state for the incident record.',
        },
      ],
    }),
    sectionWithFields('Response & Impact', {
      isSystem: true,
      fields: [
        {
          displayName: 'Business Impact',
          systemName: 'business_impact',
          fieldType: 'Text Area',
          helpText: 'Describe operational, safety, service, or customer impact caused by the incident.',
        },
        {
          displayName: 'Mitigation Actions',
          systemName: 'mitigation_actions',
          fieldType: 'Text Area',
          helpText: 'Immediate containment or mitigation actions taken to reduce harm and restore stability.',
        },
        {
          displayName: 'Response Summary',
          systemName: 'response_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the triage, containment, escalation, and communication actions taken.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize logs, artifacts, witness statements, or technical evidence collected for the incident.',
        },
      ],
    }),
    sectionWithFields('Forensics & Recovery', {
      isSystem: true,
      fields: [
        {
          displayName: 'Forensic Timeline Summary',
          systemName: 'forensic_timeline_summary',
          fieldType: 'Text Area',
          helpText: 'Document the event sequence, key timestamps, and investigative observations.',
        },
        {
          displayName: 'Root Cause',
          systemName: 'root_cause',
          fieldType: 'Text Area',
          helpText: 'Capture the underlying cause once the investigation or causal analysis is complete.',
        },
        {
          displayName: 'Recovery Date',
          systemName: 'recovery_date',
          fieldType: 'Date',
          helpText: 'Date services, systems, or operations were recovered or restored.',
        },
        {
          displayName: 'Closure Notes',
          systemName: 'closure_notes',
          fieldType: 'Text Area',
          helpText: 'Document closeout conclusions, residual concerns, or follow-up actions after recovery.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general administrative notes, supporting narrative, or extra lifecycle commentary.',
        },
      ],
    }),
  ];

  const interconnectionSections = [
    sectionWithFields('Interconnection Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the interconnection so owners can identify the exchange quickly.',
        },
        {
          displayName: 'Interconnection Reference',
          systemName: 'interconnection_reference',
          fieldType: 'Text Field',
          helpText: 'Optional ticket, agreement, interface, or architecture reference for the exchange.',
        },
        {
          displayName: 'Connection Type',
          systemName: 'connection_type',
          fieldType: 'Select',
          choices: [
            seedChoice('API'),
            seedChoice('Web Service'),
            seedChoice('FTP/Batch Processing'),
            seedChoice('File Transfer'),
            seedChoice('Database Link'),
            seedChoice('Message Queue'),
            seedChoice('Other'),
          ],
          helpText: 'Describe the technical exchange pattern or interface type.',
        },
        {
          displayName: 'System A',
          systemName: 'system_a',
          fieldType: 'Text Field',
          helpText: 'First system boundary participating in the exchange.',
        },
        {
          displayName: 'System B',
          systemName: 'system_b',
          fieldType: 'Text Field',
          helpText: 'Second system boundary participating in the exchange.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for the interconnection lifecycle and data-exchange stewardship.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Active'),
            seedChoice('Expired'),
            seedChoice('Closed'),
          ],
          helpText: 'Operational lifecycle state for the interconnection.',
        },
      ],
    }),
    sectionWithFields('Data Exchange & Approval', {
      isSystem: true,
      fields: [
        {
          displayName: 'Purpose of Exchange',
          systemName: 'purpose_of_exchange',
          fieldType: 'Text Area',
          helpText: 'Explain why the two systems exchange data and what operational or business need it supports.',
        },
        {
          displayName: 'Data Shared',
          systemName: 'data_shared',
          fieldType: 'Text Area',
          helpText: 'Summarize the data elements, payloads, files, or records exchanged across the boundary.',
        },
        {
          displayName: 'Data Classification',
          systemName: 'data_classification',
          fieldType: 'Text Field',
          helpText: 'Sensitivity or classification level of the data exchanged.',
        },
        {
          displayName: 'Data Owner',
          systemName: 'data_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for the data being exchanged across the boundary.',
        },
        {
          displayName: 'Authentication Method',
          systemName: 'authentication_method',
          fieldType: 'Select',
          choices: [
            seedChoice('Mutual TLS'),
            seedChoice('OAuth/OIDC'),
            seedChoice('API Key'),
            seedChoice('SSH Key'),
            seedChoice('VPN/Tunnel'),
            seedChoice('Service Account Credentials'),
            seedChoice('Other'),
          ],
          helpText: 'Describe how the two systems authenticate the exchange or establish trust.',
        },
        {
          displayName: 'Encryption in Transit',
          systemName: 'encryption_in_transit',
          fieldType: 'Select',
          choices: [
            seedChoice('Required'),
            seedChoice('Optional'),
            seedChoice('Not Applicable'),
            seedChoice('Unknown'),
          ],
          helpText: 'Capture whether the exchange must be protected in transit across the boundary.',
        },
        {
          displayName: 'Exchange Frequency',
          systemName: 'exchange_frequency',
          fieldType: 'Select',
          choices: [
            seedChoice('Real-time'),
            seedChoice('Near Real-time'),
            seedChoice('Daily'),
            seedChoice('Weekly'),
            seedChoice('Monthly'),
            seedChoice('Event-driven'),
            seedChoice('On Demand'),
            seedChoice('Other'),
          ],
          helpText: 'Document how often data is exchanged so dependency and operating expectations are clear.',
        },
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Approving authority for the data exchange.',
        },
        {
          displayName: 'Agreement Status',
          systemName: 'agreement_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending Approval'),
            seedChoice('Approved'),
            seedChoice('Rejected'),
            seedChoice('Expired'),
          ],
          helpText: 'Formal approval posture for the interconnection agreement.',
        },
        {
          displayName: 'Approval Date',
          systemName: 'approval_date',
          fieldType: 'Date',
          helpText: 'Date the interconnection was approved or formally decided.',
        },
      ],
    }),
    sectionWithFields('Lifecycle & Resilience', {
      isSystem: true,
      fields: [
        {
          displayName: 'Expiration Date',
          systemName: 'expiration_date',
          fieldType: 'Date',
          helpText: 'Date the interconnection approval or agreement expires.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Planned date to reassess the exchange, its approvals, and its continuing need.',
        },
        {
          displayName: 'Availability Expectation',
          systemName: 'availability_expectation',
          fieldType: 'Text Area',
          helpText: 'Describe uptime, maintenance-window, or service-level expectations for the connected exchange.',
        },
        {
          displayName: 'Downtime Impact',
          systemName: 'downtime_impact',
          fieldType: 'Text Area',
          helpText: 'Describe cascading impacts or dependency risk if either connected system becomes unavailable.',
        },
        {
          displayName: 'Least Privilege Notes',
          systemName: 'least_privilege_notes',
          fieldType: 'Text Area',
          helpText: 'Explain how the exchange is scoped to only the minimum necessary data and access.',
        },
        {
          displayName: 'Closure Notes',
          systemName: 'closure_notes',
          fieldType: 'Text Area',
          helpText: 'Capture retirement, expiry, or closeout handling for the interconnection.',
        },
        {
          displayName: 'Renewal Decision',
          systemName: 'renewal_decision',
          fieldType: 'Select',
          choices: [
            seedChoice('Renew'),
            seedChoice('Renew with Changes'),
            seedChoice('Retire'),
            seedChoice('Pending Review'),
          ],
          helpText: 'Document whether the interconnection will be renewed, changed, or retired at the end of its lifecycle.',
        },
        {
          displayName: 'Renewal Rationale',
          systemName: 'renewal_rationale',
          fieldType: 'Text Area',
          helpText: 'Explain the rationale for the renewal decision, including any needed conditions or design changes.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general architectural, workflow, or lifecycle notes.',
        },
      ],
    }),
  ];

  const policySections = [
    sectionWithFields('Policy Definition', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the governing policy, standard, procedure, or protocol being managed.',
        },
        {
          displayName: 'Policy Reference',
          systemName: 'policy_reference',
          fieldType: 'Text Field',
          helpText: 'Optional document number, publication reference, or internal identifier.',
        },
        {
          displayName: 'Policy Type',
          systemName: 'policy_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Policy'),
            seedChoice('Standard'),
            seedChoice('Procedure'),
            seedChoice('Protocol'),
            seedChoice('Regulation'),
            seedChoice('Guideline'),
            seedChoice('Other'),
          ],
          helpText: 'Use the closest governing-document type so policy reporting remains consistent.',
        },
        {
          displayName: 'Governing Source',
          systemName: 'governing_source',
          fieldType: 'Text Field',
          helpText: 'Capture the law, regulation, business driver, or authority that necessitates this policy.',
        },
        {
          displayName: 'Version',
          systemName: 'version',
          fieldType: 'Text Field',
          helpText: 'Document version or revision number for the active policy artifact.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for policy maintenance and downstream compliance.',
        },
        {
          displayName: 'Policy Scope',
          systemName: 'policy_scope',
          fieldType: 'Text Area',
          helpText: 'Describe which teams, processes, technologies, or operating domains are governed by this policy.',
        },
        {
          displayName: 'Target Audience',
          systemName: 'target_audience',
          fieldType: 'Text Field',
          helpText: 'Identify the employees, contractors, vendors, or other audiences expected to follow the policy.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending Approval'),
            seedChoice('Approved'),
            seedChoice('In Review'),
            seedChoice('Expired'),
            seedChoice('Retired'),
          ],
          helpText: 'Track the policy from drafting and approval through periodic review or retirement.',
        },
      ],
    }),
    sectionWithFields('Governance & Lifecycle', {
      isSystem: true,
      fields: [
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Approving authority responsible for issuing or ratifying the policy.',
        },
        {
          displayName: 'Review Cadence',
          systemName: 'review_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('Quarterly'),
            seedChoice('Bi-annually'),
            seedChoice('Annually'),
            seedChoice('Every 2 Years'),
            seedChoice('Ad Hoc'),
          ],
          helpText: 'Expected cadence for formal review so policies stay current and auditable.',
        },
        {
          displayName: 'Approval Date',
          systemName: 'approval_date',
          fieldType: 'Date',
          helpText: 'Date the policy was formally approved.',
        },
        {
          displayName: 'Effective Date',
          systemName: 'effective_date',
          fieldType: 'Date',
          helpText: 'Date the policy becomes enforceable or operationally active.',
        },
        {
          displayName: 'Last Review Date',
          systemName: 'last_review_date',
          fieldType: 'Date',
          helpText: 'Most recent completed review date for the policy.',
        },
        {
          displayName: 'Expiration Date',
          systemName: 'expiration_date',
          fieldType: 'Date',
          helpText: 'Date the policy should be reviewed, renewed, or retired.',
        },
        {
          displayName: 'Review Outcome',
          systemName: 'review_outcome',
          fieldType: 'Select',
          choices: [
            seedChoice('Reapproved'),
            seedChoice('Updated'),
            seedChoice('Changes Required'),
            seedChoice('Retire'),
            seedChoice('Superseded'),
          ],
          helpText: 'Capture the result of the latest formal review or renewal decision.',
        },
        {
          displayName: 'Implementation Status',
          systemName: 'implementation_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Partially Implemented'),
            seedChoice('Implemented'),
            seedChoice('Needs Review'),
          ],
          helpText: 'Summarize how fully the policy requirements are implemented in practice.',
        },
        {
          displayName: 'Assessment Cadence',
          systemName: 'assessment_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Bi-annually'),
            seedChoice('Annually'),
            seedChoice('As Needed'),
          ],
          helpText: 'Describe how often the policy or its requirements are assessed for adherence.',
        },
      ],
    }),
    sectionWithFields('Implementation & Flowdown', {
      isSystem: true,
      fields: [
        {
          displayName: 'Distribution Method',
          systemName: 'distribution_method',
          fieldType: 'Select',
          choices: [
            seedChoice('Portal'),
            seedChoice('Email'),
            seedChoice('Training Session'),
            seedChoice('Vendor Package'),
            seedChoice('Contract Attachment'),
            seedChoice('Other'),
          ],
          helpText: 'Record how the policy is distributed or published to the people and partners who must follow it.',
        },
        {
          displayName: 'Attestation Required',
          systemName: 'attestation_required',
          fieldType: 'Select',
          choices: [
            seedChoice('Required'),
            seedChoice('Recommended'),
            seedChoice('Not Required'),
          ],
          helpText: 'Use this when policy acknowledgement, training sign-off, or formal attestation is part of governance.',
        },
        {
          displayName: 'Attestation Due Date',
          systemName: 'attestation_due_date',
          fieldType: 'Date',
          helpText: 'Target date for policy acknowledgement, training completion, or required attestation.',
        },
        {
          displayName: 'Third-Party Flowdown',
          systemName: 'third_party_flowdown',
          fieldType: 'Select',
          choices: [
            seedChoice('Required'),
            seedChoice('Recommended'),
            seedChoice('Not Applicable'),
          ],
          helpText: 'Indicate whether the policy must be flowed to vendors, subcontractors, or other third parties.',
        },
        {
          displayName: 'Flowdown Scope',
          systemName: 'flowdown_scope',
          fieldType: 'Text Area',
          helpText: 'Describe how policy requirements are flowed down to third parties and what obligations they inherit.',
        },
        {
          displayName: 'Requirement Implementation Summary',
          systemName: 'requirement_implementation_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize how requirements are implemented through controls, procedures, training, or operating practices.',
        },
        {
          displayName: 'Noncompliance Tracking',
          systemName: 'noncompliance_tracking',
          fieldType: 'Text Area',
          helpText: 'Document how policy violations, deficiencies, or issue records are monitored and escalated.',
        },
        {
          displayName: 'Superseded By',
          systemName: 'superseded_by',
          fieldType: 'Text Field',
          helpText: 'Reference the replacement policy when this document is retired or superseded.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for scope notes, supporting narrative, or document-management commentary.',
        },
      ],
    }),
  ];

  const programSections = [
    sectionWithFields('Program Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the coordinated program, mission area, business unit, or initiative.',
        },
        {
          displayName: 'Program Type',
          systemName: 'program_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Program'),
            seedChoice('Mission Area'),
            seedChoice('Business Unit'),
            seedChoice('Initiative'),
            seedChoice('Portfolio'),
          ],
          helpText: 'Use the closest organizational synonym so program reporting stays consistent.',
        },
        {
          displayName: 'Business Unit',
          systemName: 'business_unit',
          fieldType: 'Text Field',
          helpText: 'Business unit, mission owner, or operating area responsible for the program.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Program lead accountable for coordination, delivery, and reporting.',
        },
        {
          displayName: 'Executive Sponsor',
          systemName: 'executive_sponsor',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Senior stakeholder sponsoring the program and its outcomes.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('At Risk'),
            seedChoice('On Hold'),
            seedChoice('Completed'),
          ],
          helpText: 'Track the program from planning through active coordination and completion.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Concise narrative describing what the program coordinates and why it matters.',
        },
      ],
    }),
    sectionWithFields('Strategy & Outcomes', {
      isSystem: true,
      fields: [
        {
          displayName: 'Objective',
          systemName: 'objective',
          fieldType: 'Text Area',
          helpText: 'Describe the target business outcome or strategic objective the program is expected to deliver.',
        },
        {
          displayName: 'Strategic Alignment',
          systemName: 'strategic_alignment',
          fieldType: 'Text Area',
          helpText: 'Capture the mission, strategy, or enterprise priority this program supports.',
        },
        {
          displayName: 'Stakeholder Group',
          systemName: 'stakeholder_group',
          fieldType: 'Text Field',
          helpText: 'Primary stakeholder group, customer segment, or community affected by the program.',
        },
        {
          displayName: 'Value Summary',
          systemName: 'value_summary',
          fieldType: 'Text Area',
          helpText: 'Describe the value delivered or expected business benefits for stakeholders.',
        },
      ],
    }),
    sectionWithFields('Enablement & Portfolio', {
      isSystem: true,
      fields: [
        {
          displayName: 'Supporting Capabilities',
          systemName: 'supporting_capabilities',
          fieldType: 'Text Area',
          helpText: 'Summarize the capabilities, projects, or workstreams coordinated by the program.',
        },
        {
          displayName: 'Supporting Technologies',
          systemName: 'supporting_technologies',
          fieldType: 'Text Area',
          helpText: 'Technologies, applications, or tooling that enable the program.',
        },
        {
          displayName: 'Supporting Platforms',
          systemName: 'supporting_platforms',
          fieldType: 'Text Area',
          helpText: 'Major platforms, providers, or infrastructure dependencies coordinated by the program.',
        },
        {
          displayName: 'Resource Utilization',
          systemName: 'resource_utilization',
          fieldType: 'Text Area',
          helpText: 'Document staffing, funding, or capacity considerations across the program portfolio.',
        },
      ],
    }),
    sectionWithFields('Risk & Delivery', {
      isSystem: true,
      fields: [
        {
          displayName: 'Start Date',
          systemName: 'start_date',
          fieldType: 'Date',
          helpText: 'Planned or actual program start date.',
        },
        {
          displayName: 'Target Date',
          systemName: 'target_date',
          fieldType: 'Date',
          helpText: 'Target completion or major-value-delivery date for the program.',
        },
        {
          displayName: 'Risk Rollup',
          systemName: 'risk_rollup',
          fieldType: 'Text Area',
          helpText: 'Summarize the portfolio risk view, major exposures, or rollup assessments for the program.',
        },
        {
          displayName: 'Stakeholder Satisfaction',
          systemName: 'stakeholder_satisfaction',
          fieldType: 'Text Area',
          helpText: 'Capture stakeholder sentiment, adoption posture, or satisfaction indicators for the program.',
        },
        {
          displayName: 'Milestone Summary',
          systemName: 'milestone_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize major milestones, coordination checkpoints, or delivery status across the program.',
        },
      ],
    }),
  ];

  const projectSections = [
    sectionWithFields('Project Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the discrete project, initiative, or delivery effort being managed.',
        },
        {
          displayName: 'Project Reference',
          systemName: 'project_reference',
          fieldType: 'Text Field',
          helpText: 'Optional PMO, portfolio, customer, or ticketing identifier for the project.',
        },
        {
          displayName: 'Project Type',
          systemName: 'project_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Project'),
            seedChoice('Initiative'),
            seedChoice('Implementation'),
            seedChoice('Remediation'),
            seedChoice('Transformation'),
            seedChoice('Other'),
          ],
        },
        {
          displayName: 'Methodology',
          systemName: 'methodology',
          fieldType: 'Select',
          choices: [
            seedChoice('Waterfall'),
            seedChoice('Agile'),
            seedChoice('Hybrid'),
            seedChoice('Kanban'),
            seedChoice('Other'),
          ],
          helpText: 'Capture the primary project-delivery methodology or operating model.',
        },
        {
          displayName: 'Parent Program',
          systemName: 'parent_program',
          fieldType: 'Text Field',
          helpText: 'Program, portfolio, or larger initiative this project contributes to.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Project owner or lead accountable for delivery.',
        },
        {
          displayName: 'Deliverable Owner',
          systemName: 'deliverable_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person accountable for final deliverable acceptance, operational transition, or handoff.',
        },
        {
          displayName: 'Executive Sponsor',
          systemName: 'executive_sponsor',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Senior stakeholder sponsoring the project and its outcomes.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('At Risk'),
            seedChoice('On Hold'),
            seedChoice('Completed'),
          ],
          helpText: 'Track the project from planning through active delivery and completion.',
        },
      ],
    }),
    sectionWithFields('Scope & Drivers', {
      isSystem: true,
      fields: [
        {
          displayName: 'Objective',
          systemName: 'objective',
          fieldType: 'Text Area',
          helpText: 'Describe the business outcome, scope, or result this project is expected to deliver.',
        },
        {
          displayName: 'Driver',
          systemName: 'driver',
          fieldType: 'Select',
          choices: [
            seedChoice('Mandate'),
            seedChoice('Audit Finding'),
            seedChoice('Strategic Driver'),
            seedChoice('Cost Savings'),
            seedChoice('Risk Reduction'),
            seedChoice('Revenue Generation'),
            seedChoice('Other'),
          ],
          helpText: 'Document the main business driver or mandate for the project.',
        },
        {
          displayName: 'Requirement Summary',
          systemName: 'requirement_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the project scope, core requirements, or committed deliverables.',
        },
        {
          displayName: 'Acceptance Criteria',
          systemName: 'acceptance_criteria',
          fieldType: 'Text Area',
          helpText: 'Document what must be true for the customer, sponsor, or PMO to accept delivery.',
        },
        {
          displayName: 'Scope Change Summary',
          systemName: 'scope_change_summary',
          fieldType: 'Text Area',
          helpText: 'Capture approved scope changes, requirement drift, or delivery tradeoffs that emerged during execution.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general project narrative, scope notes, or administrative context.',
        },
      ],
    }),
    sectionWithFields('Cost, Schedule & Delivery', {
      isSystem: true,
      fields: [
        {
          displayName: 'Budget',
          systemName: 'budget',
          fieldType: 'Dollar',
          helpText: 'Approved or planned project budget.',
        },
        {
          displayName: 'Spent to Date',
          systemName: 'spent_to_date',
          fieldType: 'Dollar',
          helpText: 'Current project expenses or spend recorded against the budget.',
        },
        {
          displayName: 'Start Date',
          systemName: 'start_date',
          fieldType: 'Date',
          helpText: 'Planned or actual project start date.',
        },
        {
          displayName: 'End Date',
          systemName: 'end_date',
          fieldType: 'Date',
          helpText: 'Target delivery or scheduled completion date for the project.',
        },
        {
          displayName: 'Percent Complete',
          systemName: 'percent_complete',
          fieldType: 'Whole Number',
          helpText: 'Delivery progress, typically from 0 to 100 percent complete.',
        },
        {
          displayName: 'Schedule Health',
          systemName: 'schedule_health',
          fieldType: 'Select',
          choices: [
            seedChoice('On Track'),
            seedChoice('At Risk'),
            seedChoice('Delayed'),
          ],
          helpText: 'Current schedule posture for meeting committed delivery dates.',
        },
        {
          displayName: 'Budget Health',
          systemName: 'budget_health',
          fieldType: 'Select',
          choices: [
            seedChoice('On Budget'),
            seedChoice('At Risk'),
            seedChoice('Over Budget'),
            seedChoice('Unknown'),
          ],
          helpText: 'Current budget posture relative to approved funding or financial expectations.',
        },
        {
          displayName: 'Milestone Summary',
          systemName: 'milestone_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize major milestones, delivery checkpoints, or release expectations.',
        },
        {
          displayName: 'Dependency Summary',
          systemName: 'dependency_summary',
          fieldType: 'Text Area',
          helpText: 'Capture prerequisite work, external coordination, or portfolio dependencies affecting delivery.',
        },
        {
          displayName: 'Schedule Variance',
          systemName: 'schedule_variance',
          fieldType: 'Text Area',
          helpText: 'Explain slippage, missed milestones, or other schedule variance when the project is not on track.',
        },
        {
          displayName: 'Budget Variance',
          systemName: 'budget_variance',
          fieldType: 'Text Area',
          helpText: 'Explain cost variance, overrun drivers, or funding pressure when the budget posture changes.',
        },
      ],
    }),
    sectionWithFields('Quality & Risk', {
      isSystem: true,
      fields: [
        {
          displayName: 'Risk Summary',
          systemName: 'risk_summary',
          fieldType: 'Text Area',
          helpText: 'Capture major delivery, scope, stakeholder, or quality risks affecting the project.',
        },
        {
          displayName: 'Quality Summary',
          systemName: 'quality_summary',
          fieldType: 'Text Area',
          helpText: 'Describe quality expectations, acceptance posture, or known concerns about deliverables.',
        },
        {
          displayName: 'Delivery Outcome',
          systemName: 'delivery_outcome',
          fieldType: 'Select',
          choices: [
            seedChoice('Delivered On Time'),
            seedChoice('Delivered Late'),
            seedChoice('Partially Delivered'),
            seedChoice('Cancelled'),
            seedChoice('Transitioned to Operations'),
          ],
          helpText: 'Capture how delivery concluded once the project completes or is otherwise closed out.',
        },
        {
          displayName: 'Benefits Realization',
          systemName: 'benefits_realization',
          fieldType: 'Text Area',
          helpText: 'Describe realized benefits, adoption results, or business value captured from the project.',
        },
        {
          displayName: 'Value Summary',
          systemName: 'value_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the value delivered or expected from the project once complete.',
        },
      ],
    }),
  ];

  const taskSections = [
    sectionWithFields('Task Assignment', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Briefly describe the task, action, or corrective work that must be completed.',
        },
        {
          displayName: 'Task Reference',
          systemName: 'task_reference',
          fieldType: 'Text Field',
          helpText: 'Optional task, ticket, action-item, or corrective-action reference.',
        },
        {
          displayName: 'Task Type',
          systemName: 'task_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Action'),
            seedChoice('Assignment'),
            seedChoice('Corrective Action'),
            seedChoice('Review'),
            seedChoice('Evidence Request'),
            seedChoice('Approval Follow-up'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the task so reporting and accountability views stay consistent.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person accountable for completing the task or coordinating the work.',
        },
        {
          displayName: 'Assigned By',
          systemName: 'assigned_by',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person who assigned, requested, or formally created the task.',
        },
        {
          displayName: 'Related Record',
          systemName: 'related_record',
          fieldType: 'Text Field',
          helpText: 'Reference the assessment, issue, exception, incident, change, or other record this task supports.',
        },
        {
          displayName: 'Priority',
          systemName: 'priority',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Medium'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Use priority to communicate urgency and support workbench triage.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('Blocked'),
            seedChoice('In Review'),
            seedChoice('Completed'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the task from planning through execution, review, and closure.',
        },
      ],
    }),
    sectionWithFields('Schedule & Progress', {
      isSystem: true,
      fields: [
        {
          displayName: 'Start Date',
          systemName: 'start_date',
          fieldType: 'Date',
          helpText: 'Planned or actual start date for the task.',
        },
        {
          displayName: 'Due Date',
          systemName: 'due_date',
          fieldType: 'Date',
          helpText: 'Date the task should be completed by.',
        },
        {
          displayName: 'Date Completed',
          systemName: 'date_completed',
          fieldType: 'Date',
          helpText: 'Date the task was finished and handed off for review or closure.',
        },
        {
          displayName: 'Percent Complete',
          systemName: 'percent_complete',
          fieldType: 'Whole Number',
          helpText: 'Progress from 0 to 100 percent complete.',
        },
        {
          displayName: 'Recurrence',
          systemName: 'recurrence',
          fieldType: 'Select',
          choices: [
            seedChoice('One-time'),
            seedChoice('Weekly'),
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Annually'),
          ],
          helpText: 'Use recurrence for routine assignments, reviews, or repeated corrective actions.',
        },
        {
          displayName: 'Next Due Date',
          systemName: 'next_due_date',
          fieldType: 'Date',
          helpText: 'Next scheduled due date when the task recurs on a defined cadence.',
        },
        {
          displayName: 'Dependency Summary',
          systemName: 'dependency_summary',
          fieldType: 'Text Area',
          helpText: 'Capture prerequisite work, blockers, or dependency context affecting task completion.',
        },
        {
          displayName: 'Blocked Reason',
          systemName: 'blocked_reason',
          fieldType: 'Text Area',
          helpText: 'Explain what is preventing the task from moving forward when it becomes blocked or stalled.',
        },
      ],
    }),
    sectionWithFields('Closure & Evidence', {
      isSystem: true,
      fields: [
        {
          displayName: 'Success Criteria',
          systemName: 'success_criteria',
          fieldType: 'Text Area',
          helpText: 'Describe what must be true for the task to be considered complete and acceptable.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize evidence, artifacts, or proof of completion associated with the task.',
        },
        {
          displayName: 'Completion Notes',
          systemName: 'completion_notes',
          fieldType: 'Text Area',
          helpText: 'Document what was done, what changed, and any remaining observations at completion time.',
        },
        {
          displayName: 'Reviewer',
          systemName: 'reviewer',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person who reviews, verifies, or accepts the completed work before closure.',
        },
        {
          displayName: 'Completion Outcome',
          systemName: 'completion_outcome',
          fieldType: 'Select',
          choices: [
            seedChoice('Completed On Time'),
            seedChoice('Completed Late'),
            seedChoice('Partially Completed'),
            seedChoice('Reopened'),
            seedChoice('Cancelled'),
          ],
          helpText: 'Describe how the task actually concluded once work was completed or closed.',
        },
        {
          displayName: 'Verification Date',
          systemName: 'verification_date',
          fieldType: 'Date',
          helpText: 'Date the completed work was checked, reviewed, or accepted.',
        },
        {
          displayName: 'Notes',
          systemName: 'notes',
          fieldType: 'Text Area',
          helpText: 'Use for administrative comments, handoff notes, or audit-trail context.',
        },
      ],
    }),
  ];

  const threatSections = [
    sectionWithFields('Threat Profile', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Briefly describe the threat, warning, or hazard that could cause harm or disruption.',
        },
        {
          displayName: 'Threat Reference',
          systemName: 'threat_reference',
          fieldType: 'Text Field',
          helpText: 'Optional threat, advisory, watchlist, or internal tracking identifier.',
        },
        {
          displayName: 'Threat Type',
          systemName: 'threat_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Cyber'),
            seedChoice('Physical'),
            seedChoice('Insider'),
            seedChoice('Supply Chain'),
            seedChoice('Fraud'),
            seedChoice('Safety'),
            seedChoice('Environmental'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the threat so triage and reporting stay consistent across the threat landscape.',
        },
        {
          displayName: 'Source',
          systemName: 'source',
          fieldType: 'Text Field',
          helpText: 'Capture the feed, intelligence source, report, customer, regulator, or team that raised the threat.',
        },
        {
          displayName: 'Threat Actor',
          systemName: 'threat_actor',
          fieldType: 'Text Field',
          helpText: 'Describe the actor, hazard source, or originating condition behind the threat when known.',
        },
        {
          displayName: 'Environment or Domain',
          systemName: 'environment_or_domain',
          fieldType: 'Text Field',
          helpText: 'Identify the business environment, system domain, facility, or program area this threat affects.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for evaluating and coordinating the threat response.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Open'),
            seedChoice('Under Analysis'),
            seedChoice('Mitigating'),
            seedChoice('Monitoring'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the threat from initial logging through analysis, mitigation, monitoring, and closure.',
        },
        {
          displayName: 'Identified On',
          systemName: 'identified_on',
          fieldType: 'Date',
          helpText: 'Record when the threat was first observed, reported, or identified.',
        },
      ],
    }),
    sectionWithFields('Exposure & Triage', {
      isSystem: true,
      fields: [
        {
          displayName: 'Exposed Asset or System',
          systemName: 'exposed_asset_or_system',
          fieldType: 'Text Field',
          helpText: 'Reference the asset, boundary, service, or operating context exposed to this threat.',
        },
        {
          displayName: 'Related Vulnerability',
          systemName: 'related_vulnerability',
          fieldType: 'Text Area',
          helpText: 'Document the weakness, gap, or exploitable condition the threat could use.',
        },
        {
          displayName: 'Vulnerability Analysis',
          systemName: 'vulnerability_analysis',
          fieldType: 'Text Area',
          helpText: 'Summarize how the environment was analyzed for exploitable weaknesses and what was learned.',
        },
        {
          displayName: 'Exposure Summary',
          systemName: 'exposure_summary',
          fieldType: 'Text Area',
          helpText: 'Describe the likely exposure path, affected interest, or business consequence if the threat were realized.',
        },
        {
          displayName: 'Likelihood',
          systemName: 'likelihood',
          fieldType: 'Risk Probability',
          helpText: 'Estimate how likely the threat is to affect the organization or a given system boundary.',
        },
        {
          displayName: 'Exploitability',
          systemName: 'exploitability',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Active')],
          helpText: 'Capture how easily the threat can exploit the identified weakness in the current environment.',
        },
        {
          displayName: 'Triage Status',
          systemName: 'triage_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Triage Pending'),
            seedChoice('Under Triage'),
            seedChoice('Validated'),
            seedChoice('False Positive'),
            seedChoice('Monitoring'),
          ],
          helpText: 'Track the triage state from initial intake through validation and longer-term monitoring.',
        },
        {
          displayName: 'Risk Assessment Summary',
          systemName: 'risk_assessment_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize how the threat informs related risk assessments, controls, or decision-making.',
        },
        {
          displayName: 'Linked Risk Reference',
          systemName: 'linked_risk_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the risk record, assessment package, or risk statement tied to this threat condition.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Record the next or most recent formal review point for the threat.',
        },
      ],
    }),
    sectionWithFields('Mitigation & Monitoring', {
      isSystem: true,
      fields: [
        {
          displayName: 'Mitigation Status',
          systemName: 'mitigation_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Started'),
            seedChoice('In Progress'),
            seedChoice('Implemented'),
            seedChoice('Monitoring'),
            seedChoice('Not Required'),
          ],
          helpText: 'Track whether mitigations have started, completed, or shifted into monitoring.',
        },
        {
          displayName: 'Mitigation Summary',
          systemName: 'mitigation_summary',
          fieldType: 'Text Area',
          helpText: 'Describe the triage action, mitigation, or operational change being used to reduce the threat.',
        },
        {
          displayName: 'Mitigation Owner',
          systemName: 'mitigation_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for carrying out the mitigation or containment action.',
        },
        {
          displayName: 'Vulnerability Response Status',
          systemName: 'vulnerability_response_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Started'),
            seedChoice('Investigating'),
            seedChoice('Remediating'),
            seedChoice('Compensating Control Applied'),
            seedChoice('Accepted'),
            seedChoice('Closed'),
          ],
          helpText: 'Track whether the underlying vulnerability is being investigated, remediated, compensated, accepted, or fully closed.',
        },
        {
          displayName: 'Mitigation Due Date',
          systemName: 'mitigation_due_date',
          fieldType: 'Date',
          helpText: 'Planned date for completing the current mitigation or containment action.',
        },
        {
          displayName: 'Monitoring Cadence',
          systemName: 'monitoring_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('Daily'),
            seedChoice('Weekly'),
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('On Change'),
          ],
          helpText: 'Define how often the threat should be re-evaluated once it enters active monitoring.',
        },
        {
          displayName: 'Next Intelligence Review Due',
          systemName: 'next_intelligence_review_due',
          fieldType: 'Date',
          helpText: 'Next expected intelligence, watchlist, or monitoring review checkpoint for this threat.',
        },
        {
          displayName: 'Threat Intelligence Summary',
          systemName: 'threat_intelligence_summary',
          fieldType: 'Text Area',
          helpText: 'Capture intelligence, warning indicators, contextual updates, or watchlist notes relevant to the threat.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize supporting evidence, observations, or artifacts used to validate the threat and the selected response.',
        },
        {
          displayName: 'Notes',
          systemName: 'notes',
          fieldType: 'Text Area',
          helpText: 'Use for analyst notes, watchlist context, or closeout commentary.',
        },
      ],
    }),
  ];

  const requestSections = [
    sectionWithFields('Request Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Briefly describe the service, resource, or action being requested.',
        },
        {
          displayName: 'Request Reference',
          systemName: 'request_reference',
          fieldType: 'Text Field',
          helpText: 'Optional ticket, work-order, or service-delivery tracking identifier.',
        },
        {
          displayName: 'Request Channel',
          systemName: 'request_channel',
          fieldType: 'Select',
          choices: [
            seedChoice('Portal'),
            seedChoice('Email'),
            seedChoice('API'),
            seedChoice('Batch'),
            seedChoice('Manual'),
          ],
          helpText: 'Capture how the request entered the system or service workflow.',
        },
        {
          displayName: 'Request Type',
          systemName: 'request_type',
          fieldType: 'Select',
          required: true,
          choices: [
            seedChoice('Service Ticket'),
            seedChoice('Work Order'),
            seedChoice('Service Task'),
            seedChoice('Standard Service'),
            seedChoice('Access Request'),
            seedChoice('Information Request'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the request so routing, reporting, and fulfillment workflows stay consistent.',
        },
        {
          displayName: 'Priority',
          systemName: 'priority',
          fieldType: 'Select',
          required: true,
          choices: [seedChoice('Low'), seedChoice('Standard'), seedChoice('Urgent')],
          helpText: 'Use priority to triage the request and communicate expected urgency.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          required: true,
          choices: [
            seedChoice('Draft'),
            seedChoice('Submitted'),
            seedChoice('Approved'),
            seedChoice('In Progress'),
            seedChoice('On Hold'),
            seedChoice('Completed'),
            seedChoice('Cancelled'),
          ],
          helpText: 'Track the request from draft through submission, fulfillment, and completion.',
        },
        {
          displayName: 'Requestor',
          systemName: 'requestor',
          fieldType: 'Users',
          selectType: 'users',
          required: true,
          helpText: 'Person formally submitting the request.',
        },
        {
          displayName: 'Fulfiller',
          systemName: 'fulfiller',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team responsible for fulfilling the request.',
        },
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team approving the request before fulfillment starts.',
        },
        {
          displayName: 'Organization',
          systemName: 'organization',
          fieldType: 'Text Field',
          helpText: 'Owning organization, service domain, or business area the request belongs to.',
        },
      ],
    }),
    sectionWithFields('Schedule & Fulfillment', {
      isSystem: true,
      fields: [
        {
          displayName: 'Date Requested',
          systemName: 'date_requested',
          fieldType: 'Date',
          required: true,
          helpText: 'When the request was formally submitted or opened.',
        },
        {
          displayName: 'Approval Date',
          systemName: 'approval_date',
          fieldType: 'Date',
          helpText: 'When the request was approved for fulfillment.',
        },
        {
          displayName: 'Need Date',
          systemName: 'need_date',
          fieldType: 'Date',
          helpText: 'When the requested service or resource is needed.',
        },
        {
          displayName: 'Date Completed',
          systemName: 'date_completed',
          fieldType: 'Date',
          helpText: 'When the request was fully fulfilled and closed out.',
        },
        {
          displayName: 'Service Level Target',
          systemName: 'service_level_target',
          fieldType: 'Text Field',
          helpText: 'Document the expected service level, SLA, or response target for fulfilling this request.',
        },
        {
          displayName: 'Parent Request Reference',
          systemName: 'parent_request_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the parent request when this work item is part of a broader service-delivery hierarchy.',
        },
        {
          displayName: 'Key Stakeholders',
          systemName: 'key_stakeholders',
          fieldType: 'Text Area',
          helpText: 'List the requestor, approvers, customers, or other stakeholders who need visibility into fulfillment.',
        },
        {
          displayName: 'Milestone Summary',
          systemName: 'milestone_summary',
          fieldType: 'Text Area',
          helpText: 'Capture important checkpoints, deliverables, or phased fulfillment steps for complex requests.',
        },
        {
          displayName: 'Child Request Summary',
          systemName: 'child_request_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize linked child requests, dependent service tasks, or parent-child request rollups.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Detailed request information, service expectations, and fulfillment context.',
        },
        {
          displayName: 'Justification',
          systemName: 'justification',
          fieldType: 'Text Area',
          helpText: 'Business justification for the request, including why the service is needed and what outcome it supports.',
        },
      ],
    }),
    sectionWithFields('Compliance & Related Work', {
      isSystem: true,
      fields: [
        {
          displayName: 'Issue / POAM Summary',
          systemName: 'issue_poam_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize related issues, POA&Ms, or remediation items connected to this request.',
        },
        {
          displayName: 'Risk Summary',
          systemName: 'risk_summary',
          fieldType: 'Text Area',
          helpText: 'Document any identified risks, tradeoffs, or risk-treatment considerations associated with the request.',
        },
        {
          displayName: 'Questionnaire Summary',
          systemName: 'questionnaire_summary',
          fieldType: 'Text Area',
          helpText: 'Reference linked questionnaires or structured information-gathering steps that support fulfillment.',
        },
        {
          displayName: 'Batch Operation Summary',
          systemName: 'batch_operation_summary',
          fieldType: 'Text Area',
          helpText: 'Document bulk create or bulk update context when the request is fulfilled through batch operations.',
        },
        {
          displayName: 'Fulfillment Outcome',
          systemName: 'fulfillment_outcome',
          fieldType: 'Text Area',
          helpText: 'Summarize what was delivered, any constraints encountered, and the final service outcome.',
        },
        {
          displayName: 'Notes',
          systemName: 'notes',
          fieldType: 'Text Area',
          helpText: 'Use for general comments, service-delivery notes, or audit-trail context.',
        },
      ],
    }),
  ];

  const supplyChainSections = [
    sectionWithFields('Vendor & Contract', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the vendor relationship, contract, subcontract, or third-party engagement being managed.',
        },
        {
          displayName: 'Vendor Name',
          systemName: 'vendor_name',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the vendor, subcontractor, or third-party organization involved in the relationship.',
        },
        {
          displayName: 'Contract ID',
          systemName: 'contract_id',
          fieldType: 'Text Field',
          helpText: 'Optional contract, purchase, agreement, or procurement reference.',
        },
        {
          displayName: 'Contract Type',
          systemName: 'contract_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Prime Contract'),
            seedChoice('Subcontract'),
            seedChoice('Purchase Order'),
            seedChoice('MSA / SOW'),
            seedChoice('Support Agreement'),
            seedChoice('Other'),
          ],
          helpText: 'Capture the kind of contract or agreement being governed.',
        },
        {
          displayName: 'Vendor Type',
          systemName: 'vendor_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Prime Contractor'),
            seedChoice('Subcontractor'),
            seedChoice('Software Vendor'),
            seedChoice('Cloud Service Provider'),
            seedChoice('Managed Service Provider'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the type of third party so reporting and oversight stay consistent.',
        },
        {
          displayName: 'Service Category',
          systemName: 'service_category',
          fieldType: 'Text Field',
          helpText: 'Summarize the goods, services, platform, or operating function the vendor provides.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Internal owner accountable for the vendor relationship, contract handling, and lifecycle oversight.',
        },
        {
          displayName: 'Contract Value',
          systemName: 'contract_value',
          fieldType: 'Dollar',
          helpText: 'Capture the known or estimated contract value when it matters for prioritization or reporting.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Active'),
            seedChoice('Under Review'),
            seedChoice('Renewal Pending'),
            seedChoice('Closed'),
            seedChoice('Terminated'),
          ],
          helpText: 'Track the lifecycle of the vendor relationship or contract record.',
        },
      ],
    }),
    sectionWithFields('Risk, Flowdown & Assessment', {
      isSystem: true,
      fields: [
        {
          displayName: 'Service Criticality',
          systemName: 'service_criticality',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Mission Critical'),
          ],
          helpText: 'Describe how important this third party is to operations, mission delivery, or customer obligations.',
        },
        {
          displayName: 'Vendor Risk Rating',
          systemName: 'vendor_risk_rating',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Capture the current third-party risk posture for the vendor or contract.',
        },
        {
          displayName: 'Risk Assessment Summary',
          systemName: 'risk_assessment_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize the risk review, key concerns, or compensating factors associated with the vendor relationship.',
        },
        {
          displayName: 'Vendor Assessment Status',
          systemName: 'vendor_assessment_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Started'),
            seedChoice('Scheduled'),
            seedChoice('In Progress'),
            seedChoice('Complete'),
            seedChoice('Needs Follow-up'),
          ],
          helpText: 'Track the state of vendor due diligence, audit, or assessment activity.',
        },
        {
          displayName: 'Assessment Cadence',
          systemName: 'assessment_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('Monthly'),
            seedChoice('Quarterly'),
            seedChoice('Semi-Annual'),
            seedChoice('Annual'),
            seedChoice('On Renewal'),
            seedChoice('On Change'),
          ],
          helpText: 'Document how often the vendor should be reassessed so recurring oversight stays predictable.',
        },
        {
          displayName: 'Next Assessment Due',
          systemName: 'next_assessment_due',
          fieldType: 'Date',
          helpText: 'Planned next assessment, audit, or reassessment due date for the vendor.',
        },
        {
          displayName: 'Last Vendor Assessed On',
          systemName: 'last_vendor_assessed_on',
          fieldType: 'Date',
          helpText: 'Date the vendor was last assessed, audited, or formally reviewed.',
        },
        {
          displayName: 'Vendor Compliance Status',
          systemName: 'vendor_compliance_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Unknown'),
            seedChoice('Compliant'),
            seedChoice('Partially Compliant'),
            seedChoice('Non-Compliant'),
            seedChoice('Waiver / Exception Required'),
          ],
          helpText: 'Capture whether the vendor is meeting flowed-down obligations or still has open compliance gaps.',
        },
        {
          displayName: 'Third-Party Flowdown',
          systemName: 'third_party_flowdown',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Required'),
            seedChoice('Planned'),
            seedChoice('In Progress'),
            seedChoice('Complete'),
          ],
          helpText: 'Capture whether policy, compliance, or requirement obligations must be flowed down to the vendor.',
        },
        {
          displayName: 'Flowdown Scope',
          systemName: 'flowdown_scope',
          fieldType: 'Text Area',
          helpText: 'Describe the requirements, policies, or contractual obligations being flowed down.',
        },
        {
          displayName: 'Flowdown Summary',
          systemName: 'flowdown_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize how flowdown obligations are communicated, tracked, and verified.',
        },
        {
          displayName: 'Questionnaire Summary',
          systemName: 'questionnaire_summary',
          fieldType: 'Text Area',
          helpText: 'Reference questionnaires, attestation packets, or information-gathering workflows used during vendor oversight.',
        },
        {
          displayName: 'Noncompliance Tracking',
          systemName: 'noncompliance_tracking',
          fieldType: 'Text Area',
          helpText: 'Document identified deficiencies, open follow-up items, or vendor compliance gaps that still require action.',
        },
        {
          displayName: 'Corrective Action Summary',
          systemName: 'corrective_action_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize remediation expectations, corrective actions, or closeout work needed for vendor findings or compliance issues.',
        },
      ],
    }),
    sectionWithFields('Lifecycle & Approval', {
      isSystem: true,
      fields: [
        {
          displayName: 'Start Date',
          systemName: 'start_date',
          fieldType: 'Date',
          helpText: 'Contract or relationship start date.',
        },
        {
          displayName: 'End Date',
          systemName: 'end_date',
          fieldType: 'Date',
          helpText: 'Contract end date, termination date, or expected relationship closeout date.',
        },
        {
          displayName: 'Renewal Date',
          systemName: 'renewal_date',
          fieldType: 'Date',
          helpText: 'Next renewal, option exercise, or re-compete decision date.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Planned date for vendor review, contract review, or third-party reassessment.',
        },
        {
          displayName: 'Approval Status',
          systemName: 'approval_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Pending Approval'),
            seedChoice('Approved'),
            seedChoice('Rejected'),
          ],
          helpText: 'Track approval posture for the relationship, contract action, or oversight decision.',
        },
        {
          displayName: 'Approver',
          systemName: 'approver',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Approving authority responsible for the contract action, renewal, or vendor decision.',
        },
        {
          displayName: 'Approval Date',
          systemName: 'approval_date',
          fieldType: 'Date',
          helpText: 'Date the vendor relationship, renewal, or decision was formally approved or rejected.',
        },
        {
          displayName: 'Renewal Strategy',
          systemName: 'renewal_strategy',
          fieldType: 'Text Area',
          helpText: 'Capture renewal posture, re-compete approach, exit considerations, or follow-on planning for the vendor relationship.',
        },
        {
          displayName: 'Renewal Decision',
          systemName: 'renewal_decision',
          fieldType: 'Select',
          choices: [
            seedChoice('Renew'),
            seedChoice('Renew with Conditions'),
            seedChoice('Recompete'),
            seedChoice('Terminate'),
            seedChoice('Pending Review'),
          ],
          helpText: 'Document the current contract-decision posture as the relationship approaches renewal or closeout.',
        },
        {
          displayName: 'Notes',
          systemName: 'notes',
          fieldType: 'Text Area',
          helpText: 'Use for contract administration notes, review commentary, or general workflow context.',
        },
      ],
    }),
  ];

  const requirementSections = [
    sectionWithFields('Requirement Definition', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the need, want, scope item, or mandatory obligation that must be implemented.',
        },
        {
          displayName: 'Requirement ID',
          systemName: 'requirement_id',
          fieldType: 'Text Field',
          helpText: 'Optional identifier for the requirement, clause, scope item, or internal tracking reference.',
        },
        {
          displayName: 'Requirement Type',
          systemName: 'requirement_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Need'),
            seedChoice('Want'),
            seedChoice('Scope'),
            seedChoice('Policy Requirement'),
            seedChoice('Project Requirement'),
            seedChoice('Vendor Requirement'),
            seedChoice('Other'),
          ],
          helpText: 'Classify the requirement so implementation and reporting stay consistent across programs.',
        },
        {
          displayName: 'Requirement Priority',
          systemName: 'requirement_priority',
          fieldType: 'Select',
          choices: [seedChoice('Low'), seedChoice('Moderate'), seedChoice('High'), seedChoice('Critical')],
          helpText: 'Use priority to indicate the business, audit, or regulatory criticality of the requirement.',
        },
        {
          displayName: 'Source Reference',
          systemName: 'source_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the law, regulation, standard, policy, project artifact, or other source that defines the requirement.',
        },
        {
          displayName: 'Governing Source',
          systemName: 'governing_source',
          fieldType: 'Text Field',
          helpText: 'Capture the broader law, regulation, policy family, or project context the requirement belongs to.',
        },
        {
          displayName: 'Applicable Law or Regulation',
          systemName: 'applicable_law_or_regulation',
          fieldType: 'Text Field',
          helpText: 'Record any governing law, regulation, or external obligation this requirement helps satisfy.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for implementing and maintaining the requirement.',
        },
        {
          displayName: 'Implementation Owner',
          systemName: 'implementation_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team primarily responsible for putting the requirement into operation day to day.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Draft'),
            seedChoice('Active'),
            seedChoice('In Review'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the requirement through definition, implementation, review, and closure.',
        },
      ],
    }),
    sectionWithFields('Implementation & Traceability', {
      isSystem: true,
      fields: [
        {
          displayName: 'Requirement Scope',
          systemName: 'requirement_scope',
          fieldType: 'Text Area',
          helpText: 'Describe the mandatory need, desired outcome, or scope that the requirement represents.',
        },
        {
          displayName: 'Related Policy or Project',
          systemName: 'related_policy_or_project',
          fieldType: 'Text Field',
          helpText: 'Reference the policy, project, or broader initiative this requirement supports.',
        },
        {
          displayName: 'Implementation Status',
          systemName: 'implementation_status',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Started'),
            seedChoice('Planned'),
            seedChoice('In Progress'),
            seedChoice('Partially Implemented'),
            seedChoice('Implemented'),
            seedChoice('Not Applicable'),
          ],
          helpText: 'Track the current implementation posture for the requirement.',
        },
        {
          displayName: 'Implementation Summary',
          systemName: 'implementation_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize how the requirement is being implemented, tracked, or maintained.',
        },
        {
          displayName: 'Control Mapping Summary',
          systemName: 'control_mapping_summary',
          fieldType: 'Text Area',
          helpText: 'Describe which controls, procedures, or implementation artifacts satisfy this requirement.',
        },
        {
          displayName: 'Linked Record',
          systemName: 'linked_record',
          fieldType: 'Text Field',
          helpText: 'Reference the policy, project, contract, control, or other record that currently carries this requirement.',
        },
      ],
    }),
    sectionWithFields('Review & Flowdown', {
      isSystem: true,
      fields: [
        {
          displayName: 'Assessment Cadence',
          systemName: 'assessment_cadence',
          fieldType: 'Select',
          choices: [
            seedChoice('On Demand'),
            seedChoice('Quarterly'),
            seedChoice('Semi-Annual'),
            seedChoice('Annual'),
            seedChoice('Per Release'),
          ],
          helpText: 'Define how often the requirement should be assessed or reviewed.',
        },
        {
          displayName: 'Assessment Reference',
          systemName: 'assessment_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the assessment, audit, or review package used to validate this requirement.',
        },
        {
          displayName: 'Assessment Method',
          systemName: 'assessment_method',
          fieldType: 'Select',
          choices: [
            seedChoice('Document Review'),
            seedChoice('Control Test'),
            seedChoice('Assessment'),
            seedChoice('Vendor Attestation'),
            seedChoice('Project Gate'),
            seedChoice('Other'),
          ],
          helpText: 'Describe how compliance with the requirement is evaluated or attested.',
        },
        {
          displayName: 'Assessment Owner',
          systemName: 'assessment_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team expected to run, coordinate, or validate requirement assessments.',
        },
        {
          displayName: 'Last Assessed On',
          systemName: 'last_assessed_on',
          fieldType: 'Date',
          helpText: 'Record the most recent date this requirement was explicitly assessed or attested.',
        },
        {
          displayName: 'Review Date',
          systemName: 'review_date',
          fieldType: 'Date',
          helpText: 'Next or most recent review date used to keep the requirement implementation current.',
        },
        {
          displayName: 'Review Outcome',
          systemName: 'review_outcome',
          fieldType: 'Select',
          choices: [
            seedChoice('Pending'),
            seedChoice('Effective'),
            seedChoice('Needs Update'),
            seedChoice('Non-Compliant'),
            seedChoice('Superseded'),
          ],
          helpText: 'Capture the result of the most recent review or assessment activity.',
        },
        {
          displayName: 'Third-Party Flowdown',
          systemName: 'third_party_flowdown',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Required'),
            seedChoice('Planned'),
            seedChoice('In Progress'),
            seedChoice('Complete'),
          ],
          helpText: 'Track whether the requirement has been flowed down to vendors, subcontractors, or other third parties.',
        },
        {
          displayName: 'Third-Party Acknowledgement',
          systemName: 'third_party_acknowledgement',
          fieldType: 'Select',
          choices: [
            seedChoice('Not Required'),
            seedChoice('Pending'),
            seedChoice('Received'),
            seedChoice('Exception Granted'),
          ],
          helpText: 'Capture whether the third party has formally acknowledged or accepted the flowed-down requirement.',
        },
        {
          displayName: 'Third-Party Reference',
          systemName: 'third_party_reference',
          fieldType: 'Text Field',
          helpText: 'Reference the contract, supplier artifact, or acknowledgement identifier supporting the flowdown.',
        },
        {
          displayName: 'Flowdown Scope',
          systemName: 'flowdown_scope',
          fieldType: 'Text Area',
          helpText: 'List the vendors, subcontractors, contracts, or third parties that must inherit this requirement.',
        },
        {
          displayName: 'Flowdown Summary',
          systemName: 'flowdown_summary',
          fieldType: 'Text Area',
          helpText: 'Describe how the requirement is being flowed down, communicated, or contractually enforced.',
        },
        {
          displayName: 'Noncompliance Tracking',
          systemName: 'noncompliance_tracking',
          fieldType: 'Text Area',
          helpText: 'Document findings, gaps, or corrective-action notes when the requirement is not being met.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Capture evidence, proof points, or artifacts showing the requirement is implemented and maintained.',
        },
        {
          displayName: 'Superseded By',
          systemName: 'superseded_by',
          fieldType: 'Text Field',
          helpText: 'Reference the replacement requirement, policy, clause, or project artifact if this one has been superseded.',
        },
        {
          displayName: 'Notes',
          systemName: 'notes',
          fieldType: 'Text Area',
          helpText: 'Use for general comments, implementation caveats, or additional governance notes.',
        },
      ],
    }),
  ];

  const causalAnalysisSections = [
    sectionWithFields('Analysis Intake', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the causal analysis effort so teams can connect it to the triggering issue or non-conformance.',
        },
        {
          displayName: 'Source Record',
          systemName: 'source_record',
          fieldType: 'Text Field',
          helpText: 'Reference the assessment, case, incident, audit, or issue that triggered this analysis.',
        },
        {
          displayName: 'Analysis Method',
          systemName: 'analysis_method',
          fieldType: 'Select',
          choices: [
            seedChoice('Event Analysis'),
            seedChoice('Change Analysis'),
            seedChoice('Barrier Analysis'),
            seedChoice('Risk Tree Analysis'),
            seedChoice('Kepner-Tregoe'),
            seedChoice('Pareto Analysis'),
            seedChoice('Fishbone Diagram'),
            seedChoice('Failure Mode and Effects Analysis'),
            seedChoice('5 Whys'),
          ],
          helpText: 'Choose the method or tool used to establish the cause-and-effect relationship.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team responsible for completing the analysis and coordinating corrective action.',
        },
        {
          displayName: 'Analysis Phase',
          systemName: 'analysis_phase',
          fieldType: 'Select',
          choices: [
            seedChoice('Intake'),
            seedChoice('Investigation'),
            seedChoice('Cause Validation'),
            seedChoice('Corrective Action'),
            seedChoice('Verification'),
            seedChoice('Closed'),
          ],
          helpText: 'Track the current stage of the root-cause effort from intake through effectiveness verification.',
        },
        {
          displayName: 'Started On',
          systemName: 'started_on',
          fieldType: 'Date',
        },
        {
          displayName: 'Due Date',
          systemName: 'due_date',
          fieldType: 'Date',
        },
        {
          displayName: 'Completed On',
          systemName: 'completed_on',
          fieldType: 'Date',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('In Review'),
            seedChoice('Closed'),
          ],
        },
        {
          displayName: 'Problem Statement',
          systemName: 'problem_statement',
          fieldType: 'Text Area',
          helpText: 'Describe the non-conformance, compliance deficiency, or failure mode being analyzed.',
        },
      ],
    }),
    sectionWithFields('Cause & Effect', {
      isSystem: true,
      fields: [
        {
          displayName: 'Cause Type',
          systemName: 'cause_type',
          fieldType: 'Select',
          choices: [
            seedChoice('People'),
            seedChoice('Process'),
            seedChoice('Technology'),
            seedChoice('Policy'),
            seedChoice('Training'),
            seedChoice('Environment'),
            seedChoice('Third Party'),
            seedChoice('Other'),
          ],
          helpText: 'Use cause type for broad trending; cause codes hold the specific reusable value within that category.',
        },
        {
          displayName: 'Cause Code',
          systemName: 'cause_code',
          fieldType: 'Text Field',
          helpText: 'Record the specific reusable cause value selected from your cause-code library or analysis standard.',
        },
        {
          displayName: 'Root Cause',
          systemName: 'root_cause',
          fieldType: 'Text Area',
          helpText: 'Document the underlying issue that ultimately led to the non-conformance or system breakdown.',
        },
        {
          displayName: 'Failure Timeline Summary',
          systemName: 'failure_timeline_summary',
          fieldType: 'Text Area',
          helpText: 'Capture the event sequence, barrier failures, or timeline of contributing conditions.',
        },
        {
          displayName: 'Evidence Summary',
          systemName: 'evidence_summary',
          fieldType: 'Text Area',
          helpText: 'Summarize interviews, evidence, or investigative data used to support the root-cause conclusion.',
        },
      ],
    }),
    sectionWithFields('Corrective Action & Improvement', {
      isSystem: true,
      fields: [
        {
          displayName: 'Corrective Action Count',
          systemName: 'corrective_action_count',
          fieldType: 'Whole Number',
          helpText: 'Track how many corrective actions or CAP tasks were created from this analysis.',
        },
        {
          displayName: 'Corrective Action Owner',
          systemName: 'corrective_action_owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Record who is accountable for implementing the corrective action or CAP workstream.',
        },
        {
          displayName: 'Corrective Action Plan',
          systemName: 'corrective_action_plan',
          fieldType: 'Text Area',
          helpText: 'Describe the permanent corrective actions designed to eliminate recurrence.',
        },
        {
          displayName: 'Recurrence Risk',
          systemName: 'recurrence_risk',
          fieldType: 'Select',
          choices: [
            seedChoice('Low'),
            seedChoice('Moderate'),
            seedChoice('High'),
            seedChoice('Critical'),
          ],
          helpText: 'Estimate the risk of recurrence if corrective actions are delayed or incomplete.',
        },
        {
          displayName: 'Trend Signal',
          systemName: 'trend_signal',
          fieldType: 'Text Area',
          helpText: 'Document systemic, cultural, or recurring themes discovered through trend analysis.',
        },
        {
          displayName: 'Effectiveness Check',
          systemName: 'effectiveness_check',
          fieldType: 'Text Area',
          helpText: 'Describe how the team will verify that the corrective actions actually removed the root cause.',
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Use for general narrative, cross-functional notes, or supplemental analysis context.',
        },
      ],
    }),
  ];

  const capabilitySections = [
    sectionWithFields('Capability Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
        {
          displayName: 'Title',
          systemName: 'title',
          fieldType: 'Text Field',
          required: true,
          helpText: 'Name the core business capability, function, or competency.',
        },
        {
          displayName: 'Capability Type',
          systemName: 'capability_type',
          fieldType: 'Select',
          choices: [
            seedChoice('Capability'),
            seedChoice('Competency'),
            seedChoice('Function'),
            seedChoice('Ability'),
          ],
        },
        {
          displayName: 'Business Unit',
          systemName: 'business_unit',
          fieldType: 'Text Field',
          helpText: 'Business unit, operating group, or organizational area accountable for the capability.',
        },
        {
          displayName: 'Parent Program',
          systemName: 'parent_program',
          fieldType: 'Text Field',
          helpText: 'Program, portfolio, or operating domain this capability belongs to.',
        },
        {
          displayName: 'Owner',
          systemName: 'owner',
          fieldType: 'Users',
          selectType: 'users',
          helpText: 'Person or team accountable for capability performance and stewardship.',
        },
        {
          displayName: 'Status',
          systemName: 'status',
          fieldType: 'Select',
          choices: [
            seedChoice('Planned'),
            seedChoice('Active'),
            seedChoice('Improving'),
            seedChoice('At Risk'),
            seedChoice('Retired'),
          ],
        },
        {
          displayName: 'Description',
          systemName: 'description',
          fieldType: 'Text Area',
          helpText: 'Concise narrative describing what the capability does and why it matters.',
        },
      ],
    }),
    sectionWithFields('Strategy & Outcomes', {
      isSystem: true,
      fields: [
        {
          displayName: 'Business Outcome',
          systemName: 'business_outcome',
          fieldType: 'Text Area',
          helpText: 'Strategic outcome this capability enables.',
        },
        {
          displayName: 'Strategic Alignment',
          systemName: 'strategic_alignment',
          fieldType: 'Text Area',
          helpText: 'Mission, strategy, or business objective this capability supports.',
        },
        {
          displayName: 'Objective',
          systemName: 'objective',
          fieldType: 'Text Area',
          helpText: 'Specific objective, target state, or success criteria for the capability.',
        },
      ],
    }),
    sectionWithFields('Enablement & Risk', {
      isSystem: true,
      fields: [
        {
          displayName: 'Supporting Technologies',
          systemName: 'supporting_technologies',
          fieldType: 'Text Area',
          helpText: 'Technologies, applications, or tooling that enable this capability.',
        },
        {
          displayName: 'Supporting Platforms',
          systemName: 'supporting_platforms',
          fieldType: 'Text Area',
          helpText: 'Shared platforms, infrastructure, or provider dependencies tied to this capability.',
        },
        {
          displayName: 'Risk Rollup',
          systemName: 'risk_rollup',
          fieldType: 'Text Area',
          helpText: 'Summarize the major risks, assessments, or exposure themes associated with the capability.',
        },
      ],
    }),
    sectionWithFields('Operational Improvement', {
      isSystem: true,
      fields: [
        {
          displayName: 'Resource Utilization',
          systemName: 'resource_utilization',
          fieldType: 'Text Area',
          helpText: 'Resource constraints, staffing posture, or utilization observations.',
        },
        {
          displayName: 'Operational Efficiency',
          systemName: 'operational_efficiency',
          fieldType: 'Text Area',
          helpText: 'Efficiency notes, bottlenecks, or current operating posture.',
        },
        {
          displayName: 'Continuous Improvement',
          systemName: 'continuous_improvement',
          fieldType: 'Text Area',
          helpText: 'Improvement roadmap, maturity actions, or next-step planning for the capability.',
        },
      ],
    }),
  ];

  const securityRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Show cloud broker id when cloud computing is enabled',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'cloud_computing',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'yes',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'SHOW',
          targetType: 'Field',
          target: 'broker_emass_id',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require authorization details when plan is operational or in transition',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Operational',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Transition',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'ato_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'ato_expiration',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'authorizing_official',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'authorization_status',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require implementation and assessment posture when plan is operational',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Operational',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_statement',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_cadence',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'last_control_assessed_on',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require review timing when authorization expires',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'ato_expiration',
          operator: 'HAS_VALUE',
          valueSource: 'constant',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require system categorization when plan is operational or in transition',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Operational',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Transition',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'confidentiality_impact',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'integrity_impact',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'availability_impact',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'overall_impact_level',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require risk acceptance summary when authorization is granted',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'authorization_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Authorized',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'authorization_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Interim Authorized',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_acceptance_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'control_inheritance_summary',
        },
      ],
    },
  ];

  const issueRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require remediation plan and due date for high severity issues',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'severity',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'severity',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'remediation_plan',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'due_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require source and requirement linkage when issue is active',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Open',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending Validation',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'source_record',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'requirement_or_policy_reference',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'due_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require root cause and evidence before validation or closure',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending Validation',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'root_cause',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'verification_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require closure details when issue is closed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'closed_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'closure_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'corrective_action_owner',
        },
      ],
    },
  ];

  const capabilityRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require risk rollup when capability is at risk',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_rollup',
        },
      ],
    },
  ];

  const caseManagementRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require disposition when case is closed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'disposition',
        },
      ],
    },
  ];

  const changeManagementRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require change assessment when approval is pending or approved',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'change_assessment',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require implementation plan when change is approved',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require approver when approval is decided',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Rejected',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require rollback plan for elevated risk changes',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'rollback_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require testing and communication plans when implementation is ready or active',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Ready',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'testing_plan',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'communication_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require actual start once implementation begins',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Rolled Back',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'actual_start',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require actual finish and post-implementation review date when implementation ends',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Rolled Back',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'actual_finish',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'post_implementation_review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require review outcome when change is closed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_outcome',
        },
      ],
    },
  ];

  const componentRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require vendor for externally provided implementation components',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'component_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Hardware',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'component_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Software',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'component_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Service',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vendor',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require control coverage summary when supported controls are tracked',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'supported_controls_count',
          operator: 'GREATER_THAN',
          valueSource: 'constant',
          value: '0',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'control_coverage_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require authorization expiration when component is authorized',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'authorization_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Authorized',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'authorization_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Conditionally Authorized',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'authorization_expiration',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require last tested date when assessment is validated or deficient',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Validated',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Deficient',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'last_tested_date',
        },
      ],
    },
  ];

  const dataCallRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require next due date when data call is recurring',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Weekly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monthly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Quarterly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Annually',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'next_due_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require delivery traceability when data call is delivered or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Delivered',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'provided_to',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'delivery_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'completion_percent',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'audit_trail_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require request details for pre-read or evidence collection calls',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'request_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pre-Read',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'request_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Evidence Collection',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'request_details',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require pre-read objective when request type is pre-read',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'request_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pre-Read',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'pre_read_objective',
        },
      ],
    },
  ];

  const evidenceLockerRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require next due date when evidence has a planned refresh cadence',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Every 30 Days',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Every 60 Days',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Every 90 Days',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Quarterly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Semi-Annually',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'update_frequency',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Annually',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'next_due_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require shared service scope when evidence maps broadly',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'control_count',
          operator: 'GREATER_THAN',
          valueSource: 'constant',
          value: '1',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mapped_control_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require file count and evidence summary when evidence is active',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'file_count',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
      ],
    },
  ];

  const exceptionRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require justification when exception type is selected',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'exception_type',
          operator: 'HAS_VALUE',
          valueSource: 'system',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'justification',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require risk rationale and compensating controls when exception is pending or approved',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_assessment_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'technical_feasibility',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'cost_feasibility',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'compensating_controls',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require approver, approval date, and expiration date when exception is approved',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'expiration_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require mitigation plan when risk is high or critical',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require closure notes when exception is expired or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Expired',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'closure_notes',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require renewal decision and rationale when exception is expired or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Expired',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_decision',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_rationale',
        },
      ],
    },
  ];

  const incidentRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require response summary and mitigation actions once active response begins',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'response_phase',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Containment',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'response_phase',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Recovery',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'response_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_actions',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require evidence summary and forensic timeline during investigation',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'response_phase',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Investigation',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'forensic_timeline_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require recovery date and root cause when incident is closed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'recovery_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'root_cause',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'closure_notes',
        },
      ],
    },
  ];

  const interconnectionRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require data shared and purpose when connection type is selected',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'connection_type',
          operator: 'HAS_VALUE',
          valueSource: 'system',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'data_shared',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'purpose_of_exchange',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require approver and lifecycle review dates when interconnection is approved',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'agreement_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'expiration_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require transport protection and dependency detail when interconnection is pending or approved',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'agreement_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending Approval',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'agreement_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'data_owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'authentication_method',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'encryption_in_transit',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'exchange_frequency',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'downtime_impact',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'least_privilege_notes',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'availability_expectation',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require closeout and renewal rationale when interconnection is expired or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Expired',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'closure_notes',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_decision',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_rationale',
        },
      ],
    },
  ];

  const policyRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require governance dates and approver when policy is approved',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'effective_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'last_review_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'expiration_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_cadence',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require implementation tracking when policy is approved or in review',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_cadence',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'policy_scope',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'requirement_implementation_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require flowdown scope when third-party flowdown is required or recommended',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Required',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Recommended',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'flowdown_scope',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'target_audience',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require attestation timing and audience when policy attestation is required or recommended',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'attestation_required',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Required',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'attestation_required',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Recommended',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'attestation_due_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'distribution_method',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'target_audience',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require noncompliance tracking when policy is active beyond draft',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Pending Approval',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'noncompliance_tracking',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require review outcome when policy is in review, expired, or retired',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Expired',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Retired',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_outcome',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require replacement reference when policy is superseded',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'review_outcome',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Superseded',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'superseded_by',
        },
      ],
    },
  ];

  const programRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require objective and strategic alignment when program is active or at risk',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'objective',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'strategic_alignment',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require risk rollup when program is at risk',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_rollup',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require target date and milestone summary when program is active or at risk',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'target_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'milestone_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require value and stakeholder summary when program is completed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'value_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'stakeholder_satisfaction',
        },
      ],
    },
  ];

  const projectRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require objective, driver, and scope when project is active or at risk',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'objective',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'driver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'requirement_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'deliverable_owner',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require budget and schedule tracking when project is active or at risk',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'budget',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'end_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'percent_complete',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'schedule_health',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'budget_health',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require acceptance criteria and dependency tracking when project is active or at risk',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'acceptance_criteria',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'dependency_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require risk and milestone detail when project is at risk',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'At Risk',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'milestone_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require schedule variance when project schedule is delayed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'schedule_health',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Delayed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'schedule_variance',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require budget variance when project is over budget',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'budget_health',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Over Budget',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'budget_variance',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require delivery value and quality summary when project is completed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'end_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'spent_to_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'quality_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'value_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'delivery_outcome',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'benefits_realization',
        },
      ],
    },
  ];

  const requestRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require submission details once request leaves draft',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Submitted',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'On Hold',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'request_type',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'priority',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'requestor',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'date_requested',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require fulfiller and schedule once request is approved or in progress',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'fulfiller',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'organization',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'need_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'service_level_target',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require approver and approval date once request is approved or fulfilled',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require justification and need date for urgent requests',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'priority',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Urgent',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'justification',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'need_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'service_level_target',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require batch context when request channel is batch',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'request_channel',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Batch',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'batch_operation_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require child summary when request references a parent request',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'parent_request_reference',
          operator: 'HAS_VALUE',
          valueSource: 'constant',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'child_request_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require completion date when request is completed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'date_completed',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'milestone_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'fulfillment_outcome',
        },
      ],
    },
  ];

  const taskRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require owner, due date, and priority once a task becomes active or blocked',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Blocked',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assigned_by',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'due_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'priority',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require start date and progress once a task is active or in review',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'start_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'percent_complete',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require next due date when a task is recurring',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Weekly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monthly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Quarterly',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Annually',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'next_due_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require blocked reason when task is blocked',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Blocked',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'blocked_reason',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require related record and success criteria when task is a corrective action or review',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'task_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Corrective Action',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'task_type',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Review',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'related_record',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'success_criteria',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require related record and success criteria for high-priority tasks',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'priority',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'priority',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'related_record',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'success_criteria',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require completion details when task is completed or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Completed',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'date_completed',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'completion_notes',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'completion_outcome',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require reviewer and verification date when task is in review or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'reviewer',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'verification_date',
        },
      ],
    },
  ];

  const threatRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require owner, source, likelihood, and exposure context when threat moves beyond open',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Under Analysis',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Mitigating',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monitoring',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'source',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'likelihood',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'triage_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'exposed_asset_or_system',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'related_vulnerability',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require vulnerability and risk analysis when triage is underway or validated',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'triage_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Under Triage',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'triage_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Validated',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'triage_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monitoring',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vulnerability_analysis',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'exploitability',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_assessment_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'linked_risk_reference',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require mitigation timing when mitigation is in progress',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'mitigation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vulnerability_response_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_due_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require monitoring cadence and next review when threat is monitoring',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monitoring',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'mitigation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monitoring',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'monitoring_cadence',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'next_intelligence_review_due',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'threat_intelligence_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require evidence and notes when threat is monitoring or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Monitoring',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'mitigation_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'notes',
        },
      ],
    },
  ];

  const supplyChainRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require vendor, owner, and lifecycle basics once a supply-chain record becomes active',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Under Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Renewal Pending',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vendor_name',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vendor_type',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'contract_type',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'service_criticality',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'start_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'end_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require approval details once a supply-chain record is active or approved',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Under Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Renewal Pending',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'approval_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Approved',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approver',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'approval_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require risk and assessment detail for elevated or critical vendors',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_risk_rating',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'service_criticality',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Mission Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'risk_assessment_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vendor_assessment_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'vendor_compliance_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'questionnaire_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require flowdown scope and summary when third-party flowdown is underway',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Planned',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'flowdown_scope',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'flowdown_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require assessment and review dates once vendor oversight is scheduled or complete',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Scheduled',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Needs Follow-up',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_cadence',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require next assessment due date when vendor oversight is scheduled or in progress',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Scheduled',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'next_assessment_due',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require corrective action detail when vendor compliance is partial, non-compliant, or exception-based',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_compliance_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Partially Compliant',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_compliance_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Non-Compliant',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_compliance_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Waiver / Exception Required',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'noncompliance_tracking',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'corrective_action_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require renewal decision when a contract is closed or terminated',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Terminated',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_decision',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require last assessed date and noncompliance tracking when vendor oversight is complete or needs follow-up',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'vendor_assessment_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Needs Follow-up',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'last_vendor_assessed_on',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'questionnaire_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'noncompliance_tracking',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require renewal planning when a contract is under review or renewal pending',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Under Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Renewal Pending',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'renewal_strategy',
        },
      ],
    },
  ];

  const requirementRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require source, owner, implementation owner, and implementation status when requirement is active or in review',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'source_reference',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_status',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_owner',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require review cadence, assessment method, assessment reference, and linked record when requirement is active',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Active',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_cadence',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_date',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_method',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_reference',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'linked_record',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require implementation summary and control mapping when requirement is in progress or implemented',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Partially Implemented',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Implemented',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'implementation_summary',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'control_mapping_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require flowdown summary when third-party flowdown is planned or underway',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Planned',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'flowdown_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require assessment owner, last assessed date, and review outcome when requirement is in review or closed',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Review',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'assessment_owner',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'review_outcome',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'last_assessed_on',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require flowdown scope and acknowledgement when third-party flowdown is underway or complete',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'In Progress',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'flowdown_scope',
        },
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'third_party_acknowledgement',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require third-party reference when requirement flowdown is complete',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'third_party_flowdown',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Complete',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'third_party_reference',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require evidence summary when requirement is implemented',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'implementation_status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Implemented',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'evidence_summary',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require noncompliance tracking when review outcome is non-compliant',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'review_outcome',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Non-Compliant',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'noncompliance_tracking',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require replacement reference when requirement is superseded',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'review_outcome',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Superseded',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'superseded_by',
        },
      ],
    },
  ];

  const causalAnalysisRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require root cause when causal analysis is closed',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'status',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Closed',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'root_cause',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require cause code when cause type is selected',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'cause_type',
          operator: 'HAS_VALUE',
          valueSource: 'system',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'cause_code',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require corrective action plan when corrective actions are tracked',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'corrective_action_count',
          operator: 'GREATER_THAN',
          valueSource: 'constant',
          value: '0',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'corrective_action_plan',
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Require effectiveness check when recurrence risk is elevated',
      logic: 'OR',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence_risk',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'High',
        },
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'recurrence_risk',
          operator: 'EQUALS',
          valueSource: 'constant',
          value: 'Critical',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'REQUIRE',
          targetType: 'Field',
          target: 'effectiveness_check',
        },
      ],
    },
  ];

  const baseModules: SeedModuleDefinition[] = [
    {
      moduleKey: 'security-plans',
      moduleName: 'Security Plan',
      pluralName: 'Security Plans',
      tabSort: 'manual',
      status: 'active',
      description:
        'Configure security plan metadata, SSP boundary details, system categorization, control inheritance, authorization and review cycles, and implementation narratives.',
      sections: securityPlanSections,
      rules: securityRules,
    },
    {
      moduleKey: 'security-controls',
      moduleName: 'Security Control',
      pluralName: 'Security Controls',
      tabSort: 'manual',
      status: 'active',
      description: 'Track implementation status, ownership, assessment posture, and control narratives.',
      sections: securityControlSections,
      rules: [],
    },
    {
      moduleKey: 'risks',
      moduleName: 'Risk',
      pluralName: 'Risks',
      tabSort: 'manual',
      status: 'active',
      description:
        'Track risk statements, threat context, triggers, probability and consequence, tolerance posture, contingency planning, realized events, review and approval posture, budgeting impacts, risk lenses, and trend snapshots across compliance and operational programs.',
      sections: riskSections,
      rules: riskRules,
    },
    {
      moduleKey: 'assets',
      moduleName: 'Asset',
      pluralName: 'Assets',
      tabSort: 'manual',
      status: 'active',
      description: 'Manage asset inventory records with identification, ownership, platform, and classification fields.',
      sections: assetSections,
      rules: [],
    },
    {
      moduleKey: 'issues',
      moduleName: 'Issue',
      pluralName: 'Issues',
      tabSort: 'manual',
      status: 'active',
      description: 'Control issue intake, remediation workflows, and action-plan exports.',
      sections: issueSections,
      rules: issueRules,
    },
    {
      moduleKey: 'capabilities',
      moduleName: 'Capability',
      pluralName: 'Capabilities',
      tabSort: 'manual',
      status: 'active',
      description:
        'Model business capabilities, their strategic outcomes, supporting technologies, and risk or improvement posture.',
      sections: capabilitySections,
      rules: capabilityRules,
    },
    {
      moduleKey: 'case-management',
      moduleName: 'Case',
      pluralName: 'Case Management',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate intake, investigation, evidence, forensic timeline notes, disposition, and corrective action for reported cases.',
      sections: caseManagementSections,
      rules: caseManagementRules,
    },
    {
      moduleKey: 'changes',
      moduleName: 'Change',
      pluralName: 'Changes',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate requests for change, assessment, approval, implementation, and review in one ITIL-aligned workspace.',
      sections: changeManagementSections,
      rules: changeManagementRules,
    },
    {
      moduleKey: 'components',
      moduleName: 'Component',
      pluralName: 'Components',
      tabSort: 'manual',
      status: 'active',
      description:
        'Document OSCAL-style implementation components, supported controls, and authorization posture in one reusable workspace.',
      sections: componentSections,
      rules: componentRules,
    },
    {
      moduleKey: 'data-calls',
      moduleName: 'Data Call',
      pluralName: 'Data Calls',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate evidence requests, due dates, recurring submissions, and audit-ready delivery tracking for assessments and related compliance matters.',
      sections: dataCallSections,
      rules: dataCallRules,
    },
    {
      moduleKey: 'evidence-locker',
      moduleName: 'Evidence Locker',
      pluralName: 'Evidence Locker',
      tabSort: 'manual',
      status: 'active',
      description:
        'Maintain a central repository of reusable audit evidence, mapped control coverage, update cadence, and audit-ready ownership across systems and components.',
      sections: evidenceLockerSections,
      rules: evidenceLockerRules,
    },
    {
      moduleKey: 'exceptions',
      moduleName: 'Exception',
      pluralName: 'Exceptions',
      tabSort: 'manual',
      status: 'active',
      description:
        'Manage temporary relief for non-compliant requirements or controls with justification, risk treatment, approval workflow, and expiration lifecycle tracking.',
      sections: exceptionSections,
      rules: exceptionRules,
    },
    {
      moduleKey: 'incidents',
      moduleName: 'Incident',
      pluralName: 'Incidents',
      tabSort: 'manual',
      status: 'active',
      description:
        'Manage negative events that threaten information, people, or assets with structured triage, response, forensic, and recovery tracking.',
      sections: incidentSections,
      rules: incidentRules,
    },
    {
      moduleKey: 'interconnections',
      moduleName: 'Interconnection',
      pluralName: 'Interconnections',
      tabSort: 'manual',
      status: 'active',
      description:
        'Document approved data exchanges between system boundaries, including interface method, shared data, responsibility, and lifecycle management.',
      sections: interconnectionSections,
      rules: interconnectionRules,
    },
    {
      moduleKey: 'policies',
      moduleName: 'Policy',
      pluralName: 'Policies',
      tabSort: 'manual',
      status: 'active',
      description:
        'Manage governing policies, standards, procedures, and related rules with lifecycle dates, implementation posture, distribution expectations, and third-party flow-down context.',
      sections: policySections,
      rules: policyRules,
    },
    {
      moduleKey: 'programs',
      moduleName: 'Program',
      pluralName: 'Programs',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate programs, mission areas, business units, and initiatives with strategic objectives, supporting capabilities, and portfolio risk rollups.',
      sections: programSections,
      rules: programRules,
    },
    {
      moduleKey: 'projects',
      moduleName: 'Project',
      pluralName: 'Projects',
      tabSort: 'manual',
      status: 'active',
      description:
        'Track discrete projects with scope, budget, schedule, drivers, ownership, and delivery quality across broader program investments.',
      sections: projectSections,
      rules: projectRules,
    },
    {
      moduleKey: 'requests',
      moduleName: 'Request',
      pluralName: 'Requests',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate formal service requests, requestor and fulfiller ownership, milestone tracking, and linked compliance work in one tenant workspace.',
      sections: requestSections,
      rules: requestRules,
    },
    {
      moduleKey: 'tasks',
      moduleName: 'Task',
      pluralName: 'Tasks',
      tabSort: 'manual',
      status: 'active',
      description:
        'Coordinate assignments, corrective actions, due dates, recurrence, and completion evidence across tenant workstreams.',
      sections: taskSections,
      rules: taskRules,
    },
    {
      moduleKey: 'threats',
      moduleName: 'Threat',
      pluralName: 'Threats',
      tabSort: 'manual',
      status: 'active',
      description:
        'Track evolving threats, exposed assets or systems, vulnerability analysis, triage actions, mitigation ownership, monitoring cadence, and linked risk context as conditions change.',
      sections: threatSections,
      rules: threatRules,
    },
    {
      moduleKey: 'supply-chain',
      moduleName: 'Supply Chain',
      pluralName: 'Supply Chain',
      tabSort: 'manual',
      status: 'active',
      description:
        'Manage vendors, contracts, renewals, requirement flowdown, vendor assessments, and third-party risk posture in one tenant workspace.',
      sections: supplyChainSections,
      rules: supplyChainRules,
    },
    {
      moduleKey: 'requirements',
      moduleName: 'Requirement',
      pluralName: 'Requirements',
      tabSort: 'manual',
      status: 'active',
      description:
        'Track requirement definition, regulatory or policy source, implementation ownership, control mappings, assessment context, and third-party flowdown across policies, projects, and compliance programs.',
      sections: requirementSections,
      rules: requirementRules,
    },
    {
      moduleKey: 'causal-analysis',
      moduleName: 'Causal Analysis',
      pluralName: 'Causal Analysis',
      tabSort: 'manual',
      status: 'active',
      description:
        'Document causal-analysis methods, root causes, failure timelines, and corrective actions for non-conformances.',
      sections: causalAnalysisSections,
      rules: causalAnalysisRules,
    },
  ];

  const seededKeys = new Set(baseModules.map((module) => module.moduleKey));
  const genericModules = listSharedWorkspaceModules()
    .filter((entry) => !seededKeys.has(entry.moduleKey))
    .map(buildGenericSeedModule);

  return [...baseModules, ...genericModules];
}

function normalizeSeedKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function cloneFieldChoice(choice: FormFieldChoice): FormFieldChoice {
  return {
    id: crypto.randomUUID(),
    label: choice.label,
    value: choice.value,
    active: choice.active,
  };
}

function cloneFieldValidation(validation: FormFieldValidation): FormFieldValidation {
  return {
    id: crypto.randomUUID(),
    operator: validation.operator,
    valueSource: validation.valueSource,
    value: validation.value,
    errorMessage: validation.errorMessage ?? null,
  };
}

function cloneField(field: FormField, sectionId = field.sectionId): FormField {
  return {
    ...field,
    id: crypto.randomUUID(),
    sectionId,
    choices: field.choices.map(cloneFieldChoice),
    validations: field.validations.map(cloneFieldValidation),
  };
}

function cloneSection(section: FormSection): FormSection {
  return {
    ...section,
    id: crypto.randomUUID(),
    fields: [],
  };
}

function cloneRule(rule: FormRule): FormRule {
  return {
    ...rule,
    id: crypto.randomUUID(),
    conditions: rule.conditions.map((condition) => ({ ...condition, id: crypto.randomUUID() })),
    actions: rule.actions.map((action) => ({ ...action, id: crypto.randomUUID() })),
  };
}

function findMatchingSection(existingSections: FormSection[], seedSection: FormSection): FormSection | null {
  const normalizedDisplay = normalizeSeedKey(seedSection.displayName);
  const seedFieldNames = new Set(seedSection.fields.map((field) => field.systemName));
  return (
    existingSections.find(
      (section) =>
        normalizeSeedKey(section.displayName) === normalizedDisplay ||
        section.fields.some((field) => seedFieldNames.has(field.systemName)),
    ) ?? null
  );
}

function mergeSeedSections(existingSections: FormSection[], seedSections: FormSection[]): FormSection[] {
  const merged = existingSections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({
      ...field,
      choices: [...field.choices],
      validations: [...field.validations],
    })),
  }));

  for (const seedSection of seedSections) {
    const matchingSection = findMatchingSection(merged, seedSection);
    if (!matchingSection) {
      const appendedSection = cloneSection(seedSection);
      appendedSection.fields = seedSection.fields.map((field) => cloneField(field, appendedSection.id));
      merged.push(appendedSection);
      continue;
    }

    matchingSection.isSystem = matchingSection.isSystem || seedSection.isSystem;
    matchingSection.isDefault = matchingSection.isDefault || seedSection.isDefault;
    const existingFieldNames = new Set(matchingSection.fields.map((field) => field.systemName));
    for (const seedField of seedSection.fields) {
      if (existingFieldNames.has(seedField.systemName)) {
        continue;
      }
      matchingSection.fields.push(cloneField(seedField, matchingSection.id));
    }
  }

  return merged;
}

function mergeSeedRules(existingRules: FormRule[], seedRules: FormRule[]): FormRule[] {
  const merged = existingRules.map((rule) => ({
    ...rule,
    conditions: rule.conditions.map((condition) => ({ ...condition })),
    actions: rule.actions.map((action) => ({ ...action })),
  }));
  const existingNames = new Set(merged.map((rule) => normalizeSeedKey(rule.name)));
  for (const seedRule of seedRules) {
    if (existingNames.has(normalizeSeedKey(seedRule.name))) {
      continue;
    }
    merged.push(cloneRule(seedRule));
  }
  return merged;
}

function countFields(sections: FormSection[]) {
  return sections.reduce((total, section) => total + section.fields.length, 0);
}

function buildFormDiagnostics(sections: FormSection[], rules: FormRule[]): FormBuilderDiagnostic[] {
  const diagnostics: FormBuilderDiagnostic[] = [];
  const fieldNames = new Set<string>();
  const sectionIds = new Set(sections.map((section) => section.id));
  const fieldSystemNames = new Set<string>();

  for (const section of sections) {
    if (!section.displayName.trim()) {
      diagnostics.push({
        id: `${section.id}-name`,
        severity: 'error',
        message: 'Every section needs a display name.',
      });
    }
    if (section.isDefault && !section.active) {
      diagnostics.push({
        id: `${section.id}-default`,
        severity: 'warning',
        message: `Default section "${section.displayName || 'Untitled'}" is hidden.`,
      });
    }

    for (const field of section.fields) {
      if (!field.displayName.trim()) {
        diagnostics.push({
          id: `${field.id}-display-name`,
          severity: 'error',
          message: 'Every field needs a display name.',
        });
      }
      if (!field.systemName.trim()) {
        diagnostics.push({
          id: `${field.id}-system-name`,
          severity: 'error',
          message: `Field "${field.displayName || 'Untitled'}" is missing a system name.`,
        });
      } else if (fieldSystemNames.has(field.systemName)) {
        diagnostics.push({
          id: `${field.id}-duplicate`,
          severity: 'error',
          message: `System field name "${field.systemName}" is duplicated.`,
        });
      } else {
        fieldSystemNames.add(field.systemName);
      }

      if (field.sectionId !== section.id && sectionIds.has(field.sectionId)) {
        diagnostics.push({
          id: `${field.id}-misplaced`,
          severity: 'warning',
          message: `Field "${field.displayName}" is assigned to a different section than where it is rendered.`,
        });
      }

      if (field.required && !field.active) {
        diagnostics.push({
          id: `${field.id}-hidden-required`,
          severity: 'warning',
          message: `Field "${field.displayName}" is hidden but still marked required.`,
        });
      }
      fieldNames.add(field.systemName);
    }
  }

  for (const rule of rules) {
    if (!rule.name.trim()) {
      diagnostics.push({
        id: `${rule.id}-name`,
        severity: 'error',
        message: 'Every rule needs a name.',
      });
    }
    if (rule.conditions.length === 0) {
      diagnostics.push({
        id: `${rule.id}-conditions`,
        severity: 'error',
        message: `Rule "${rule.name || 'Untitled'}" must have at least one condition.`,
      });
    }
    if (rule.actions.length === 0) {
      diagnostics.push({
        id: `${rule.id}-actions`,
        severity: 'error',
        message: `Rule "${rule.name || 'Untitled'}" must have at least one action.`,
      });
    }

    for (const condition of rule.conditions) {
      if (condition.conditionType === 'Field' && condition.target && !fieldNames.has(condition.target)) {
        diagnostics.push({
          id: `${condition.id}-target`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" references unknown field "${condition.target}".`,
        });
      }
    }

    for (const action of rule.actions) {
      if (action.targetType === 'Field' && action.target && !fieldNames.has(action.target)) {
        diagnostics.push({
          id: `${action.id}-target`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" targets unknown field "${action.target}".`,
        });
      }
      if (action.targetType === 'Tab' && action.target && !sections.some((section) => section.displayName === action.target)) {
        diagnostics.push({
          id: `${action.id}-tab-target`,
          severity: 'warning',
          message: `Rule "${rule.name || 'Untitled'}" targets unknown tab "${action.target}".`,
        });
      }
    }
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      id: 'form-valid',
      severity: 'info',
      message: 'Module sections, fields, and rules passed structural validation checks.',
    });
  }

  return diagnostics;
}

async function ensureSeedModules(
  env: WorkerRequestContext['env'],
  tenantId: string,
  userId: string | null,
): Promise<void> {
  const rows = await env.D1_MAIN.prepare(`SELECT * FROM form_builder_modules WHERE tenant_id = ?`)
    .bind(tenantId)
    .all<FormBuilderModuleRow>();
  const existingByKey = new Map(rows.results.map((row) => [row.module_key, row]));
  const createdAt = nowIso();
  const statements = buildSeedModules().flatMap((module) => {
    const current = existingByKey.get(module.moduleKey);
    if (!current) {
      return [
        env.D1_MAIN.prepare(
          `INSERT INTO form_builder_modules (
            id, tenant_id, module_key, module_name, plural_name, tab_sort, status, description,
            sections_json, rules_json, created_by_user_id, updated_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          tenantId,
          module.moduleKey,
          module.moduleName,
          module.pluralName,
          module.tabSort,
          module.status,
          module.description,
          JSON.stringify(module.sections),
          JSON.stringify(module.rules),
          userId,
          userId,
          createdAt,
          createdAt,
        ),
      ];
    }

    const currentSections = asJson<FormSection[]>(current.sections_json, []);
    const currentRules = asJson<FormRule[]>(current.rules_json, []);
    const mergedSections = mergeSeedSections(currentSections, module.sections);
    const mergedRules = mergeSeedRules(currentRules, module.rules);
    const nextDescription = current.description?.trim() ? current.description : module.description;
    const nextModuleName = current.module_name?.trim() || module.moduleName;
    const nextPluralName = current.plural_name?.trim() || module.pluralName;
    const sectionsChanged = JSON.stringify(currentSections) !== JSON.stringify(mergedSections);
    const rulesChanged = JSON.stringify(currentRules) !== JSON.stringify(mergedRules);
    const metadataChanged =
      nextDescription !== current.description ||
      nextModuleName !== current.module_name ||
      nextPluralName !== current.plural_name;

    if (!sectionsChanged && !rulesChanged && !metadataChanged) {
      return [];
    }

    return [
      env.D1_MAIN.prepare(
        `UPDATE form_builder_modules
            SET module_name = ?, plural_name = ?, description = ?, sections_json = ?, rules_json = ?,
                updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      ).bind(
        nextModuleName,
        nextPluralName,
        nextDescription,
        JSON.stringify(mergedSections),
        JSON.stringify(mergedRules),
        userId,
        nowIso(),
        tenantId,
        current.id,
      ),
    ];
  });

  if (statements.length > 0) {
    await env.D1_MAIN.batch(statements);
  }
}

function toSummary(row: FormBuilderModuleRow): FormBuilderSummary {
  const sections = asJson<FormSection[]>(row.sections_json, []);
  const rules = asJson<FormRule[]>(row.rules_json, []);
  return {
    id: row.id,
    moduleKey: row.module_key,
    moduleName: row.module_name,
    pluralName: row.plural_name,
    tabSort: (row.tab_sort as FormTabSort) || 'manual',
    status: row.status,
    sectionCount: sections.length,
    fieldCount: countFields(sections),
    ruleCount: rules.length,
    updatedAt: row.updated_at,
  };
}

function toDetail(row: FormBuilderModuleRow): FormBuilderDetail {
  const sections = asJson<FormSection[]>(row.sections_json, []);
  const rules = asJson<FormRule[]>(row.rules_json, []);
  return {
    id: row.id,
    moduleKey: row.module_key,
    moduleName: row.module_name,
    pluralName: row.plural_name,
    tabSort: (row.tab_sort as FormTabSort) || 'manual',
    status: row.status,
    description: row.description,
    sections,
    rules,
    diagnostics: buildFormDiagnostics(sections, rules),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listModules(env: WorkerRequestContext['env'], tenantId: string): Promise<FormBuilderSummary[]> {
  const rows = await env.D1_MAIN.prepare(
    `SELECT * FROM form_builder_modules WHERE tenant_id = ? ORDER BY updated_at DESC, module_name ASC`,
  )
    .bind(tenantId)
    .all<FormBuilderModuleRow>();

  return rows.results.map(toSummary);
}

async function getModuleRow(
  env: WorkerRequestContext['env'],
  tenantId: string,
  moduleId: string,
): Promise<FormBuilderModuleRow | null> {
  return env.D1_MAIN.prepare(
    `SELECT * FROM form_builder_modules WHERE tenant_id = ? AND id = ? LIMIT 1`,
  )
    .bind(tenantId, moduleId)
    .first<FormBuilderModuleRow>();
}

export async function handleFormBuilderRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const tenantIdOrResponse = requireTenant(ctx);
  if (tenantIdOrResponse instanceof Response) {
    return tenantIdOrResponse;
  }
  const tenantId = tenantIdOrResponse;

  await ensureSeedModules(ctx.env, tenantId, ctx.userId);

  const [resource, id, action] = segments;
  if (resource !== 'forms') {
    return json({ error: 'unknown_builder_resource', resource }, { status: 404 });
  }

  if (!id) {
    if (ctx.request.method === 'GET') {
      return json({ data: { modules: await listModules(ctx.env, tenantId) } });
    }

    if (ctx.request.method === 'POST') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }

      const body = await readJson<CreateFormModuleInput>(ctx.request);
      const createdAt = nowIso();
      const moduleId = crypto.randomUUID();
      const moduleName = body.moduleName?.trim() || 'Custom Module';
      const pluralName = body.pluralName?.trim() || `${moduleName}s`;
      const sections = [sectionWithFields('General', { isDefault: true, isSystem: false })];
      const rules: FormRule[] = [];

      await ctx.env.D1_MAIN.prepare(
        `INSERT INTO form_builder_modules (
          id, tenant_id, module_key, module_name, plural_name, tab_sort, status, description,
          sections_json, rules_json, created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          moduleId,
          tenantId,
          body.moduleKey?.trim() || slugify(moduleName),
          moduleName,
          pluralName,
          'manual',
          'draft',
          'Custom module created in the canonical Form Builder.',
          JSON.stringify(sections),
          JSON.stringify(rules),
          userIdOrResponse,
          userIdOrResponse,
          createdAt,
          createdAt,
        )
        .run();

      const row = await getModuleRow(ctx.env, tenantId, moduleId);
      return row
        ? json({ data: toDetail(row) }, { status: 201 })
        : json({ error: 'create_failed' }, { status: 500 });
    }

    return methodNotAllowed(['GET', 'POST']);
  }

  if (!action) {
    if (ctx.request.method === 'GET') {
      const row = await getModuleRow(ctx.env, tenantId, id);
      return row ? json({ data: toDetail(row) }) : json({ error: 'not_found' }, { status: 404 });
    }

    if (ctx.request.method === 'PUT') {
      const userIdOrResponse = requireUser(ctx);
      if (userIdOrResponse instanceof Response) {
        return userIdOrResponse;
      }
      const current = await getModuleRow(ctx.env, tenantId, id);
      if (!current) {
        return json({ error: 'not_found', message: 'Form Builder module not found.' }, { status: 404 });
      }

      const body = await readJson<SaveFormModuleInput>(ctx.request);
      const sections = body.sections ?? asJson<FormSection[]>(current.sections_json, []);
      const rules = body.rules ?? asJson<FormRule[]>(current.rules_json, []);

      await ctx.env.D1_MAIN.prepare(
        `UPDATE form_builder_modules
            SET module_name = ?, plural_name = ?, tab_sort = ?, status = ?, description = ?,
                sections_json = ?, rules_json = ?, updated_by_user_id = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
      )
        .bind(
          body.moduleName?.trim() || current.module_name,
          body.pluralName?.trim() || current.plural_name,
          body.tabSort?.trim() || current.tab_sort,
          body.status?.trim() || current.status,
          body.description?.trim() || current.description,
          JSON.stringify(sections),
          JSON.stringify(rules),
          userIdOrResponse,
          nowIso(),
          tenantId,
          id,
        )
        .run();

      const updated = await getModuleRow(ctx.env, tenantId, id);
      return updated ? json({ data: toDetail(updated) }) : json({ error: 'not_found' }, { status: 404 });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (action === 'validate') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const row = await getModuleRow(ctx.env, tenantId, id);
    if (!row) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    const body = await readJson<ValidateFormModuleInput>(ctx.request);
    const sections = body.sections ?? asJson<FormSection[]>(row.sections_json, []);
    const rules = body.rules ?? asJson<FormRule[]>(row.rules_json, []);
    return json({ data: { diagnostics: buildFormDiagnostics(sections, rules) } });
  }

  if (action === 'import') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }

    const current = await getModuleRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    const body = await readJson<SaveFormModuleInput>(ctx.request);
    const sections = body.sections ?? [];
    const rules = body.rules ?? [];
    const diagnostics = buildFormDiagnostics(sections, rules);
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      return json(
        {
          error: 'invalid_import',
          message: 'Imported module configuration failed validation.',
          diagnostics,
        },
        { status: 400 },
      );
    }

    await ctx.env.D1_MAIN.prepare(
      `UPDATE form_builder_modules
          SET module_name = ?, plural_name = ?, tab_sort = ?, status = ?, description = ?,
              sections_json = ?, rules_json = ?, updated_by_user_id = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
    )
      .bind(
        body.moduleName?.trim() || current.module_name,
        body.pluralName?.trim() || current.plural_name,
        body.tabSort?.trim() || current.tab_sort,
        body.status?.trim() || current.status,
        body.description?.trim() || current.description,
        JSON.stringify(sections),
        JSON.stringify(rules),
        userIdOrResponse,
        nowIso(),
        tenantId,
        id,
      )
      .run();

    const updated = await getModuleRow(ctx.env, tenantId, id);
    return updated ? json({ data: toDetail(updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  if (action === 'reset') {
    if (ctx.request.method !== 'POST') {
      return methodNotAllowed(['POST']);
    }

    const userIdOrResponse = requireUser(ctx);
    if (userIdOrResponse instanceof Response) {
      return userIdOrResponse;
    }

    const current = await getModuleRow(ctx.env, tenantId, id);
    if (!current) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    const seed = buildSeedModules().find((module) => module.moduleKey === current.module_key);
    const sections = seed?.sections ?? [sectionWithFields('General', { isDefault: true, isSystem: false })];
    const rules = seed?.rules ?? [];

    await ctx.env.D1_MAIN.prepare(
      `UPDATE form_builder_modules
          SET module_name = ?, plural_name = ?, tab_sort = ?, status = ?, description = ?,
              sections_json = ?, rules_json = ?, updated_by_user_id = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
    )
      .bind(
        seed?.moduleName ?? current.module_name,
        seed?.pluralName ?? current.plural_name,
        seed?.tabSort ?? current.tab_sort,
        seed?.status ?? 'draft',
        seed?.description ?? 'Factory reset completed from the canonical Form Builder.',
        JSON.stringify(sections),
        JSON.stringify(rules),
        userIdOrResponse,
        nowIso(),
        tenantId,
        id,
      )
      .run();

    const updated = await getModuleRow(ctx.env, tenantId, id);
    return updated ? json({ data: toDetail(updated) }) : json({ error: 'not_found' }, { status: 404 });
  }

  return json({ error: 'unknown_builder_action', action }, { status: 404 });
}
