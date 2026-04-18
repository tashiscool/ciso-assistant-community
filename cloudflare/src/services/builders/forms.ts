import type { WorkerRequestContext } from '../../router';
import { json, methodNotAllowed, readJson } from '../../utils/http';

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

function sectionWithFields(
  displayName: string,
  options: {
    isDefault?: boolean;
    isSystem?: boolean;
    fields?: Array<Partial<FormField> & { displayName: string; systemName: string; fieldType: FormField['fieldType'] }>;
  } = {},
): FormSection {
  const sectionId = crypto.randomUUID();
  return {
    id: sectionId,
    displayName,
    active: true,
    isDefault: options.isDefault ?? false,
    isSystem: options.isSystem ?? false,
    fields:
      options.fields?.map((field, index) => ({
        ...emptyField(sectionId, index + 1),
        ...field,
        id: crypto.randomUUID(),
        sectionId,
        choices: field.choices ?? [],
        validations: field.validations ?? [],
        lockedType: field.lockedType ?? true,
      })) ?? [],
  };
}

function buildSeedModules() {
  const securitySections = [
    sectionWithFields('Overview', {
      isDefault: true,
      isSystem: true,
      fields: [
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
      ],
    }),
    sectionWithFields('Cloud Info', {
      isSystem: true,
      fields: [
        {
          displayName: 'Cloud Computing',
          systemName: 'cloud_computing',
          fieldType: 'Select',
          choices: [
            { id: crypto.randomUUID(), label: 'Yes', value: 'yes', active: true },
            { id: crypto.randomUUID(), label: 'No', value: 'no', active: true },
          ],
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
        },
        {
          displayName: 'Severity',
          systemName: 'severity',
          fieldType: 'Select',
          required: true,
          choices: [
            { id: crypto.randomUUID(), label: 'Low', value: 'Low', active: true },
            { id: crypto.randomUUID(), label: 'Moderate', value: 'Moderate', active: true },
            { id: crypto.randomUUID(), label: 'High', value: 'High', active: true },
            { id: crypto.randomUUID(), label: 'Critical', value: 'Critical', active: true },
          ],
        },
      ],
    }),
    sectionWithFields('Remediation', {
      isSystem: true,
      fields: [
        {
          displayName: 'Remediation Plan',
          systemName: 'remediation_plan',
          fieldType: 'Text Area',
        },
        {
          displayName: 'Closed Date',
          systemName: 'closed_date',
          fieldType: 'Date',
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
  ];

  const issueRules: FormRule[] = [
    {
      id: crypto.randomUUID(),
      name: 'Require remediation plan for high severity',
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
      ],
    },
    {
      id: crypto.randomUUID(),
      name: 'Set closed date when severity workflow closes',
      logic: 'AND',
      conditions: [
        {
          id: crypto.randomUUID(),
          conditionType: 'Field',
          target: 'severity',
          operator: 'HAS_VALUE',
          valueSource: 'system',
          value: '',
        },
      ],
      actions: [
        {
          id: crypto.randomUUID(),
          actionType: 'SET_VALUE',
          targetType: 'Field',
          target: 'closed_date',
          value: 'TODAY',
          bypassExistingValue: true,
          allowExternalValue: false,
        },
      ],
    },
  ];

  return [
    {
      moduleKey: 'security-plans',
      moduleName: 'Security Plan',
      pluralName: 'Security Plans',
      tabSort: 'manual' as FormTabSort,
      status: 'active',
      description: 'Configure SSP sections, cloud details, and implementation statements.',
      sections: securitySections,
      rules: securityRules,
    },
    {
      moduleKey: 'issues',
      moduleName: 'Issue',
      pluralName: 'Issues',
      tabSort: 'manual' as FormTabSort,
      status: 'active',
      description: 'Control issue intake, remediation workflows, and action-plan exports.',
      sections: issueSections,
      rules: issueRules,
    },
  ];
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
  const row = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS module_count FROM form_builder_modules WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<{ module_count: number | null }>();

  if (Number(row?.module_count ?? 0) > 0) {
    return;
  }

  const createdAt = nowIso();
  const statements = buildSeedModules().map((module) =>
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
  );

  await env.D1_MAIN.batch(statements);
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
