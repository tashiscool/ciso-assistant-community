import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Factory,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  createFormBuilderModule,
  getFormBuilderModule,
  importFormBuilderModule,
  listFormBuilderModules,
  resetFormBuilderModule,
  saveFormBuilderModule,
  validateFormBuilderModule,
} from './formApi';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  FormBuilderDetail,
  FormBuilderDiagnostic,
  FormBuilderSummary,
  FormField,
  FormFieldChoice,
  FormFieldValidation,
  FormRule,
  FormRuleAction,
  FormRuleCondition,
  FormSection,
  FormTabSort,
} from './formTypes';

type BuilderTab = 'builder' | 'rules';

type Props = {
  initialTab?: BuilderTab;
};

const fieldTypes: FormField['fieldType'][] = [
  'Text Field',
  'Text Area',
  'Rich Text',
  'Email',
  'Phone',
  'URL',
  'IP Address',
  'MAC Address',
  'Number',
  'Whole Number',
  'Dollar',
  'Range',
  'Date',
  'Date Time Hour',
  'Select',
  'Users',
  'Organizations',
  'Facilities',
  'Risk Probability',
  'Risk Consequence',
  'Compliance Settings',
  'Checkbox',
  'Toggle',
  'Label',
  'HTML',
  'Section Header',
  'Button',
];

const validationOperators: FormFieldValidation['operator'][] = [
  'EQUALS',
  'NOT_EQUALS',
  'HAS_VALUE',
  'NO_VALUE',
  'GREATER_THAN',
  'LESS_THAN',
  'BEFORE',
  'AFTER',
  'WITHIN_LAST',
  'WITHIN_NEXT',
];

const conditionTypes: FormRuleCondition['conditionType'][] = [
  'Field',
  'System - NO_PARENT',
  'System - NO_CONDITION',
  'Tenant Feature',
  'Module',
];

const ruleOperators: FormRuleCondition['operator'][] = [
  'EQUALS',
  'NOT_EQUALS',
  'HAS_VALUE',
  'NO_VALUE',
  'GREATER_THAN',
  'LESS_THAN',
  'BEFORE',
  'AFTER',
  'WITHIN_LAST',
  'WITHIN_NEXT',
  'ENABLED',
  'DISABLED',
];

const actionTypes: FormRuleAction['actionType'][] = [
  'SHOW',
  'HIDE',
  'REQUIRE',
  'NOT_REQUIRE',
  'ENABLE',
  'DISABLE',
  'SET_VALUE',
  'VALIDATE',
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function reorder<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const next = [...items];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return next;
  }
  [next[index], next[target]] = [next[target], next[index]];
  return next;
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

function emptySection(index: number): FormSection {
  const sectionId = crypto.randomUUID();
  return {
    id: sectionId,
    displayName: `Custom Section ${index}`,
    active: true,
    isDefault: false,
    isSystem: false,
    fields: [],
  };
}

function emptyChoice(): FormFieldChoice {
  return {
    id: crypto.randomUUID(),
    label: 'New Choice',
    value: 'new_choice',
    active: true,
  };
}

function emptyValidation(): FormFieldValidation {
  return {
    id: crypto.randomUUID(),
    operator: 'EQUALS',
    valueSource: 'constant',
    value: '',
    errorMessage: '',
  };
}

function emptyCondition(): FormRuleCondition {
  return {
    id: crypto.randomUUID(),
    conditionType: 'Field',
    target: '',
    operator: 'EQUALS',
    valueSource: 'constant',
    value: '',
  };
}

function emptyAction(): FormRuleAction {
  return {
    id: crypto.randomUUID(),
    actionType: 'SHOW',
    targetType: 'Field',
    target: '',
    operator: '',
    value: '',
    bypassExistingValue: false,
    allowExternalValue: false,
  };
}

function emptyRule(): FormRule {
  return {
    id: crypto.randomUUID(),
    name: 'New rule',
    logic: 'AND',
    conditions: [emptyCondition()],
    actions: [emptyAction()],
  };
}

function severityClass(severity: FormBuilderDiagnostic['severity']) {
  if (severity === 'error') {
    return 'badge-danger';
  }
  if (severity === 'warning') {
    return 'badge-neutral';
  }
  return 'badge-success';
}

function isSelectLike(field: FormField) {
  return ['Select', 'Users', 'Organizations', 'Facilities', 'Risk Probability', 'Risk Consequence', 'Compliance Settings'].includes(
    field.fieldType,
  );
}

function exportPayload(module: FormBuilderDetail) {
  return {
    moduleName: module.moduleName,
    pluralName: module.pluralName,
    tabSort: module.tabSort,
    status: module.status,
    description: module.description,
    sections: module.sections,
    rules: module.rules,
  };
}

export function FormBuilderWorkspace({ initialTab = 'builder' }: Props) {
  const { identity } = useEdgeIdentity();
  const [modules, setModules] = useState<FormBuilderSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FormBuilderDetail | null>(null);
  const [draft, setDraft] = useState<FormBuilderDetail | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BuilderTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newModuleName, setNewModuleName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  async function loadModules() {
    try {
      setLoading(true);
      setError(null);
      const next = await listFormBuilderModules();
      setModules(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Form Builder modules.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(moduleId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      const next = await getFormBuilderModule(moduleId);
      setDetail(next);
      setDraft(clone(next));
      setSelectedSectionId(next.sections[0]?.id ?? null);
      setSelectedFieldId(next.sections[0]?.fields[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Form Builder module.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadModules();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!detail || !draft) {
      return false;
    }
    return JSON.stringify(exportPayload(detail)) !== JSON.stringify(exportPayload(draft));
  }, [detail, draft]);

  const metrics = useMemo(() => {
    return [
      {
        label: 'Modules',
        value: modules.length,
        detail: 'Tenant-scoped form packages available to every admin.',
      },
      {
        label: 'Sections',
        value: draft?.sections.length ?? 0,
        detail: 'Tabs and panels currently configured in the active module.',
      },
      {
        label: 'Fields',
        value: draft?.sections.reduce((total, section) => total + section.fields.length, 0) ?? 0,
        detail: 'Field definitions currently present in the active module.',
      },
      {
        label: 'Rules',
        value: draft?.rules.length ?? 0,
        detail: 'Embedded form-automation rules for visibility and validation behavior.',
      },
    ];
  }, [draft, modules.length]);

  const selectedSection = useMemo(
    () => draft?.sections.find((section) => section.id === selectedSectionId) ?? draft?.sections[0] ?? null,
    [draft, selectedSectionId],
  );

  const selectedField = useMemo(
    () => selectedSection?.fields.find((field) => field.id === selectedFieldId) ?? selectedSection?.fields[0] ?? null,
    [selectedFieldId, selectedSection],
  );

  async function handleCreateModule() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createFormBuilderModule({
        moduleName: newModuleName || undefined,
      });
      setNewModuleName('');
      await loadModules();
      setSelectedId(created.id);
      setNotice('New Form Builder module created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create module.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await saveFormBuilderModule(draft.id, exportPayload(draft));
      setDetail(saved);
      setDraft(clone(saved));
      await loadModules();
      setNotice('Form Builder changes saved globally.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save module.');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!draft) {
      return;
    }

    try {
      setValidating(true);
      setError(null);
      setNotice(null);
      const validation = await validateFormBuilderModule(draft.id, {
        sections: draft.sections,
        rules: draft.rules,
      });
      setDraft({
        ...draft,
        diagnostics: validation.diagnostics,
      });
      setNotice('Form Builder draft validated against canonical Cloudflare rules.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to validate Form Builder draft.');
    } finally {
      setValidating(false);
    }
  }

  function handleExport() {
    if (!draft) {
      return;
    }
    const blob = new Blob([JSON.stringify(exportPayload(draft), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.moduleKey}-form-builder.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('Form Builder configuration exported to JSON.');
  }

  async function handleImportFile(file: File) {
    if (!draft) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const text = await file.text();
      const parsed = JSON.parse(text) as ReturnType<typeof exportPayload>;
      const imported = await importFormBuilderModule(draft.id, parsed);
      setDetail(imported);
      setDraft(clone(imported));
      await loadModules();
      setNotice('Form Builder configuration imported and validated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import module configuration.');
    } finally {
      setSaving(false);
      if (importRef.current) {
        importRef.current.value = '';
      }
    }
  }

  async function handleFactoryReset() {
    if (!draft) {
      return;
    }
    const confirmation = window.prompt(`Type "${draft.moduleName}" to confirm factory reset.`);
    if (confirmation !== draft.moduleName) {
      setNotice('Factory reset cancelled.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const reset = await resetFormBuilderModule(draft.id);
      setDetail(reset);
      setDraft(clone(reset));
      await loadModules();
      setNotice('Module reset to its factory configuration.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset module.');
    } finally {
      setSaving(false);
    }
  }

  function updateDraftSection(sectionId: string, updater: (section: FormSection) => FormSection) {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
          }
        : current,
    );
  }

  function updateDraftField(fieldId: string, updater: (field: FormField) => FormField) {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section) => ({
              ...section,
              fields: section.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
            })),
          }
        : current,
    );
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading Form Builder...</div>;
  }

  return (
    <div className="space-y-6">
      <input
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImportFile(file);
          }
        }}
        ref={importRef}
        type="file"
        accept="application/json"
      />

      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Form Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Customize module forms by renaming modules, managing sections, controlling field order and
              visibility, editing validations, and keeping rules inside the same canonical builder surface.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/builders/form-builder">
              <ClipboardList className="mr-2 h-4 w-4" />
              Form Builder
            </Link>
            <Link className="button-secondary" to="/builders/rules-builder">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Rules Builder
            </Link>
            <button className="button-secondary" onClick={handleExport} type="button">
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
            <button className="button-secondary" onClick={() => importRef.current?.click()} type="button">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </button>
            <button className="button-secondary" onClick={() => void handleFactoryReset()} type="button">
              <Factory className="mr-2 h-4 w-4" />
              Factory Reset
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="mt-2 text-xs text-slate-500">{metric.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Module Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Builder Packages</h2>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateModule();
            }}
          >
            <input
              className="input"
              onChange={(event) => setNewModuleName(event.target.value)}
              placeholder="New custom module"
              value={newModuleName}
            />
            <button className="button-secondary w-full" disabled={saving} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Create Module
            </button>
          </form>
          <div className="space-y-3">
            {modules.map((module) => (
              <button
                key={module.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === module.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
                onClick={() => setSelectedId(module.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{module.moduleName}</div>
                    <div className="mt-1 text-sm text-slate-400">{module.pluralName}</div>
                  </div>
                  <span className="badge-neutral">{module.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge-neutral">{module.sectionCount} sections</span>
                  <span className="badge-neutral">{module.fieldCount} fields</span>
                  <span className="badge-neutral">{module.ruleCount} rules</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">Updated {formatDate(module.updatedAt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draft ? (
            <div className="text-sm text-slate-300">Loading module detail...</div>
          ) : (
            <div className="space-y-6">
              <div className="panel-subtle">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">Module Display Settings</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">{draft.moduleName}</h3>
                  </div>
                  <button className="button-secondary" disabled={validating} onClick={() => void handleValidate()} type="button">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {validating ? 'Validating...' : 'Validate Draft'}
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Module Name</label>
                    <input
                      className="input mt-2"
                      onChange={(event) => setDraft({ ...draft, moduleName: event.target.value })}
                      value={draft.moduleName}
                    />
                  </div>
                  <div>
                    <label className="label">Pluralized Module Name</label>
                    <input
                      className="input mt-2"
                      onChange={(event) => setDraft({ ...draft, pluralName: event.target.value })}
                      value={draft.pluralName}
                    />
                  </div>
                  <div>
                    <label className="label">Tab Sort</label>
                    <select
                      className="input mt-2"
                      onChange={(event) => setDraft({ ...draft, tabSort: event.target.value as FormTabSort })}
                      value={draft.tabSort}
                    >
                      <option value="alphabetical">Alphabetical</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input mt-2"
                      onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                      value={draft.status}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="review">In Review</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      className="input mt-2 min-h-[92px]"
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      value={draft.description ?? ''}
                    />
                  </div>
                </div>
              </div>

              <Tabs onValueChange={(value) => setActiveTab(value as BuilderTab)} value={activeTab}>
                <TabsList className="mb-6 w-fit rounded-2xl border border-white/10 bg-slate-950/70">
                  <TabsTrigger value="builder">Builder</TabsTrigger>
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                </TabsList>

                <TabsContent className="space-y-6" value="builder">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Sections / Tabs</div>
                          <h3 className="mt-2 text-lg font-semibold text-white">Section Layout</h3>
                        </div>
                        <button
                          className="button-secondary"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sections: [...draft.sections, emptySection(draft.sections.length + 1)],
                            })
                          }
                          type="button"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Section
                        </button>
                      </div>

                      {draft.sections.map((section, sectionIndex) => (
                        <div className="panel-subtle" key={section.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-medium text-white">{section.displayName}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {section.isSystem ? 'System section' : 'Custom section'} · {section.fields.length} fields
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="button-secondary px-3 py-2"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    sections: reorder(draft.sections, sectionIndex, 'up'),
                                  })
                                }
                                type="button"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                className="button-secondary px-3 py-2"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    sections: reorder(draft.sections, sectionIndex, 'down'),
                                  })
                                }
                                type="button"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              {!section.isSystem && (
                                <button
                                  className="button-secondary px-3 py-2 text-rose-200"
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      sections: draft.sections.filter((entry) => entry.id !== section.id),
                                    })
                                  }
                                  type="button"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="label">Display Name</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    displayName: event.target.value,
                                  }))
                                }
                                value={section.displayName}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-6 pt-7 text-sm text-slate-300">
                              <label className="flex items-center gap-2">
                                <input
                                  checked={section.active}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    updateDraftSection(section.id, (current) => ({
                                      ...current,
                                      active: event.target.checked,
                                    }))
                                  }
                                  type="checkbox"
                                />
                                Show
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  checked={section.isDefault}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      sections: draft.sections.map((entry) => ({
                                        ...entry,
                                        isDefault: entry.id === section.id ? event.target.checked : false,
                                      })),
                                    })
                                  }
                                  type="checkbox"
                                />
                                Default
                              </label>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="label">Fields</div>
                              <button
                                className="button-secondary"
                                onClick={() => {
                                  const nextField = emptyField(section.id, section.fields.length + 1);
                                  updateDraftSection(section.id, (current) => ({
                                    ...current,
                                    fields: [...current.fields, nextField],
                                  }));
                                  setSelectedSectionId(section.id);
                                  setSelectedFieldId(nextField.id);
                                }}
                                type="button"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Field
                              </button>
                            </div>
                            <div className="space-y-3">
                              {section.fields.map((field, fieldIndex) => (
                                <div
                                  className={`rounded-2xl border p-3 transition ${
                                    selectedFieldId === field.id
                                      ? 'border-cyan-300/30 bg-cyan-400/[0.04]'
                                      : 'border-white/10 bg-slate-950/50'
                                  }`}
                                  key={field.id}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <button
                                      className="text-left"
                                      onClick={() => {
                                        setSelectedSectionId(section.id);
                                        setSelectedFieldId(field.id);
                                      }}
                                      type="button"
                                    >
                                      <div className="font-medium text-white">{field.displayName}</div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {field.systemName} · {field.fieldType}
                                      </div>
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                      {field.required && <span className="badge-neutral">Required</span>}
                                      {!field.active && <span className="badge-danger">Hidden</span>}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      className="button-secondary px-3 py-2"
                                      onClick={() =>
                                        updateDraftSection(section.id, (current) => ({
                                          ...current,
                                          fields: reorder(current.fields, fieldIndex, 'up'),
                                        }))
                                      }
                                      type="button"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="button-secondary px-3 py-2"
                                      onClick={() =>
                                        updateDraftSection(section.id, (current) => ({
                                          ...current,
                                          fields: reorder(current.fields, fieldIndex, 'down'),
                                        }))
                                      }
                                      type="button"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="button-secondary px-3 py-2"
                                      onClick={() => {
                                        const duplicate = clone(field);
                                        duplicate.id = crypto.randomUUID();
                                        duplicate.displayName = `${field.displayName} Copy`;
                                        duplicate.systemName = `${field.systemName}_copy`;
                                        updateDraftSection(section.id, (current) => ({
                                          ...current,
                                          fields: [...current.fields, duplicate],
                                        }));
                                      }}
                                      type="button"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="button-secondary px-3 py-2 text-rose-200"
                                      onClick={() =>
                                        updateDraftSection(section.id, (current) => ({
                                          ...current,
                                          fields: current.fields.filter((entry) => entry.id !== field.id),
                                        }))
                                      }
                                      type="button"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <aside className="space-y-4">
                      <div className="panel-subtle">
                        <div className="eyebrow">Field Properties</div>
                        {selectedField ? (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="label">Display Name</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  updateDraftField(selectedField.id, (field) => ({
                                    ...field,
                                    displayName: event.target.value,
                                  }))
                                }
                                value={selectedField.displayName}
                              />
                            </div>
                            <div>
                              <label className="label">System Name</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  updateDraftField(selectedField.id, (field) => ({
                                    ...field,
                                    systemName: event.target.value,
                                  }))
                                }
                                value={selectedField.systemName}
                              />
                            </div>
                            <div>
                              <label className="label">Field Type</label>
                              <select
                                className="input mt-2"
                                disabled={selectedField.lockedType}
                                onChange={(event) =>
                                  updateDraftField(selectedField.id, (field) => ({
                                    ...field,
                                    fieldType: event.target.value as FormField['fieldType'],
                                  }))
                                }
                                value={selectedField.fieldType}
                              >
                                {fieldTypes.map((fieldType) => (
                                  <option key={fieldType} value={fieldType}>
                                    {fieldType}
                                  </option>
                                ))}
                              </select>
                              {selectedField.lockedType && (
                                <div className="mt-2 text-xs text-slate-500">
                                  Field type changes are restricted after creation to avoid destructive schema shifts.
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="label">Section / Tab</label>
                              <select
                                className="input mt-2"
                                onChange={(event) => {
                                  const nextSectionId = event.target.value;
                                  const movedField = clone(selectedField);
                                  movedField.sectionId = nextSectionId;
                                  setDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          sections: current.sections.map((section) => {
                                            if (section.id === selectedSection?.id) {
                                              return {
                                                ...section,
                                                fields: section.fields.filter((field) => field.id !== selectedField.id),
                                              };
                                            }
                                            if (section.id === nextSectionId) {
                                              return {
                                                ...section,
                                                fields: [...section.fields, movedField],
                                              };
                                            }
                                            return section;
                                          }),
                                        }
                                      : current,
                                  );
                                  setSelectedSectionId(nextSectionId);
                                }}
                                value={selectedField.sectionId}
                              >
                                {draft.sections.map((section) => (
                                  <option key={section.id} value={section.id}>
                                    {section.displayName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                  checked={selectedField.required}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      required: event.target.checked,
                                    }))
                                  }
                                  type="checkbox"
                                />
                                Required
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                  checked={selectedField.active}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      active: event.target.checked,
                                    }))
                                  }
                                  type="checkbox"
                                />
                                Active / Show
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
                                <input
                                  checked={selectedField.editable}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      editable: event.target.checked,
                                    }))
                                  }
                                  type="checkbox"
                                />
                                Editable
                              </label>
                            </div>
                            <div>
                              <label className="label">Help Text</label>
                              <textarea
                                className="input mt-2 min-h-[88px]"
                                onChange={(event) =>
                                  updateDraftField(selectedField.id, (field) => ({
                                    ...field,
                                    helpText: event.target.value,
                                  }))
                                }
                                value={selectedField.helpText ?? ''}
                              />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="label">Pattern / Regex</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      pattern: event.target.value,
                                    }))
                                  }
                                  value={selectedField.pattern ?? ''}
                                />
                              </div>
                              <div>
                                <label className="label">Select Type / Source</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      selectType: event.target.value,
                                    }))
                                  }
                                  value={selectedField.selectType ?? ''}
                                />
                              </div>
                              <div>
                                <label className="label">Min</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      min: Number(event.target.value) || 0,
                                    }))
                                  }
                                  type="number"
                                  value={selectedField.min ?? ''}
                                />
                              </div>
                              <div>
                                <label className="label">Max</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      max: Number(event.target.value) || 0,
                                    }))
                                  }
                                  type="number"
                                  value={selectedField.max ?? ''}
                                />
                              </div>
                            </div>

                            {isSelectLike(selectedField) && (
                              <div className="panel-subtle">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="label">Choices</div>
                                  <button
                                    className="button-secondary"
                                    onClick={() =>
                                      updateDraftField(selectedField.id, (field) => ({
                                        ...field,
                                        choices: [...field.choices, emptyChoice()],
                                      }))
                                    }
                                    type="button"
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Choice
                                  </button>
                                </div>
                                <div className="mt-3 space-y-3">
                                  {selectedField.choices.map((choice) => (
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={choice.id}>
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <input
                                          className="input"
                                          onChange={(event) =>
                                            updateDraftField(selectedField.id, (field) => ({
                                              ...field,
                                              choices: field.choices.map((entry) =>
                                                entry.id === choice.id ? { ...entry, label: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          value={choice.label}
                                        />
                                        <input
                                          className="input"
                                          onChange={(event) =>
                                            updateDraftField(selectedField.id, (field) => ({
                                              ...field,
                                              choices: field.choices.map((entry) =>
                                                entry.id === choice.id ? { ...entry, value: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          value={choice.value}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="panel-subtle">
                              <div className="flex items-center justify-between gap-3">
                                <div className="label">Validations</div>
                                <button
                                  className="button-secondary"
                                  onClick={() =>
                                    updateDraftField(selectedField.id, (field) => ({
                                      ...field,
                                      validations: [...field.validations, emptyValidation()],
                                    }))
                                  }
                                  type="button"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Validation
                                </button>
                              </div>
                              <div className="mt-3 space-y-3">
                                {selectedField.validations.map((validation) => (
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={validation.id}>
                                    <div className="grid gap-3">
                                      <select
                                        className="input"
                                        onChange={(event) =>
                                          updateDraftField(selectedField.id, (field) => ({
                                            ...field,
                                            validations: field.validations.map((entry) =>
                                              entry.id === validation.id
                                                ? {
                                                    ...entry,
                                                    operator: event.target.value as FormFieldValidation['operator'],
                                                  }
                                                : entry,
                                            ),
                                          }))
                                        }
                                        value={validation.operator}
                                      >
                                        {validationOperators.map((operator) => (
                                          <option key={operator} value={operator}>
                                            {operator}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          updateDraftField(selectedField.id, (field) => ({
                                            ...field,
                                            validations: field.validations.map((entry) =>
                                              entry.id === validation.id ? { ...entry, value: event.target.value } : entry,
                                            ),
                                          }))
                                        }
                                        placeholder="Constant value or field reference"
                                        value={validation.value}
                                      />
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          updateDraftField(selectedField.id, (field) => ({
                                            ...field,
                                            validations: field.validations.map((entry) =>
                                              entry.id === validation.id
                                                ? { ...entry, errorMessage: event.target.value }
                                                : entry,
                                            ),
                                          }))
                                        }
                                        placeholder="Custom error message"
                                        value={validation.errorMessage ?? ''}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-slate-400">
                            Select a field to edit its properties, validations, and choice lists.
                          </div>
                        )}
                      </div>

                      <div className="panel-subtle">
                        <div className="eyebrow">Diagnostics</div>
                        <div className="mt-4 space-y-3">
                          {draft.diagnostics.map((diagnostic) => (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={diagnostic.id}>
                              <div className={severityClass(diagnostic.severity)}>{diagnostic.severity}</div>
                              <div className="mt-2 text-sm leading-6 text-slate-300">{diagnostic.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </aside>
                  </div>
                </TabsContent>

                <TabsContent className="space-y-6" value="rules">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="eyebrow">Rules Builder</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">Embedded Form Automation</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                        Build `IF conditions THEN actions` logic for form tabs and fields without leaving the Form Builder.
                      </p>
                    </div>
                    <button
                      className="button-secondary"
                      onClick={() => setDraft({ ...draft, rules: [...draft.rules, emptyRule()] })}
                      type="button"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Rule
                    </button>
                  </div>

                  <div className="space-y-4">
                    {draft.rules.map((rule) => (
                      <div className="panel-subtle" key={rule.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{rule.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              IF {rule.logic} conditions THEN {rule.actions.length} actions
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="button-secondary px-3 py-2"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  rules: [...draft.rules, { ...clone(rule), id: crypto.randomUUID(), name: `${rule.name} Copy` }],
                                })
                              }
                              type="button"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              className="button-secondary px-3 py-2 text-rose-200"
                              onClick={() => setDraft({ ...draft, rules: draft.rules.filter((entry) => entry.id !== rule.id) })}
                              type="button"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="label">Rule Name</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    rules: draft.rules.map((entry) =>
                                      entry.id === rule.id ? { ...entry, name: event.target.value } : entry,
                                    ),
                                  })
                                }
                                value={rule.name}
                              />
                            </div>
                            <div>
                              <label className="label">Conditional Logic</label>
                              <select
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    rules: draft.rules.map((entry) =>
                                      entry.id === rule.id ? { ...entry, logic: event.target.value as FormRule['logic'] } : entry,
                                    ),
                                  })
                                }
                                value={rule.logic}
                              >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="panel-subtle">
                              <div className="flex items-center justify-between gap-3">
                                <div className="label">Conditions</div>
                                <button
                                  className="button-secondary"
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      rules: draft.rules.map((entry) =>
                                        entry.id === rule.id
                                          ? { ...entry, conditions: [...entry.conditions, emptyCondition()] }
                                          : entry,
                                      ),
                                    })
                                  }
                                  type="button"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Condition
                                </button>
                              </div>
                              <div className="mt-3 space-y-3">
                                {rule.conditions.map((condition) => (
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={condition.id}>
                                    <div className="grid gap-3">
                                      <select
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    conditions: entry.conditions.map((item) =>
                                                      item.id === condition.id
                                                        ? {
                                                            ...item,
                                                            conditionType: event.target.value as FormRuleCondition['conditionType'],
                                                          }
                                                        : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        value={condition.conditionType}
                                      >
                                        {conditionTypes.map((type) => (
                                          <option key={type} value={type}>
                                            {type}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    conditions: entry.conditions.map((item) =>
                                                      item.id === condition.id ? { ...item, target: event.target.value } : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        placeholder="Field, feature, or module target"
                                        value={condition.target}
                                      />
                                      <select
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    conditions: entry.conditions.map((item) =>
                                                      item.id === condition.id
                                                        ? { ...item, operator: event.target.value as FormRuleCondition['operator'] }
                                                        : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        value={condition.operator}
                                      >
                                        {ruleOperators.map((operator) => (
                                          <option key={operator} value={operator}>
                                            {operator}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    conditions: entry.conditions.map((item) =>
                                                      item.id === condition.id ? { ...item, value: event.target.value } : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        placeholder="Constant value or @FieldName"
                                        value={condition.value}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="panel-subtle">
                              <div className="flex items-center justify-between gap-3">
                                <div className="label">Actions</div>
                                <button
                                  className="button-secondary"
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      rules: draft.rules.map((entry) =>
                                        entry.id === rule.id ? { ...entry, actions: [...entry.actions, emptyAction()] } : entry,
                                      ),
                                    })
                                  }
                                  type="button"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Action
                                </button>
                              </div>
                              <div className="mt-3 space-y-3">
                                {rule.actions.map((action) => (
                                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={action.id}>
                                    <div className="grid gap-3">
                                      <select
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    actions: entry.actions.map((item) =>
                                                      item.id === action.id
                                                        ? { ...item, actionType: event.target.value as FormRuleAction['actionType'] }
                                                        : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        value={action.actionType}
                                      >
                                        {actionTypes.map((type) => (
                                          <option key={type} value={type}>
                                            {type}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    actions: entry.actions.map((item) =>
                                                      item.id === action.id
                                                        ? { ...item, targetType: event.target.value as FormRuleAction['targetType'] }
                                                        : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        value={action.targetType}
                                      >
                                        <option value="Field">Field</option>
                                        <option value="Tab">Tab</option>
                                      </select>
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    actions: entry.actions.map((item) =>
                                                      item.id === action.id ? { ...item, target: event.target.value } : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        placeholder="Field system name or tab name"
                                        value={action.target}
                                      />
                                      <input
                                        className="input"
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            rules: draft.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    actions: entry.actions.map((item) =>
                                                      item.id === action.id ? { ...item, value: event.target.value } : item,
                                                    ),
                                                  }
                                                : entry,
                                            ),
                                          })
                                        }
                                        placeholder="Value, TODAY, NOW, or @FieldName"
                                        value={action.value ?? ''}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      </section>

      {hasUnsavedChanges && (
        <section className="panel sticky bottom-4 border-cyan-300/20 bg-slate-950/85 backdrop-blur-xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <div className="font-medium text-white">Unsaved changes</div>
                <div className="mt-1 text-sm text-slate-300">
                  Saving updates the module configuration globally for all users on the tenant.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" disabled={validating} onClick={() => void handleValidate()} type="button">
                <Wrench className="mr-2 h-4 w-4" />
                {validating ? 'Validating...' : 'Validate Draft'}
              </button>
              <button className="button-primary" disabled={saving} onClick={() => void handleSave()} type="button">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
