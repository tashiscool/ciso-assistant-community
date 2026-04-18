import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Code2,
  FlaskConical,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  createQuestionnaireTemplate,
  getQuestionnaireTemplate,
  listQuestionnaireTemplates,
  previewQuestionnaireRuleTest,
  runQuestionnaireRuleTest,
  saveQuestionnaireRules,
  saveQuestionnaireTemplate,
  validateQuestionnaireRules,
} from './api';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  QuestionnaireQuestion,
  QuestionnaireRule,
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateSummary,
  RuleDiagnostic,
  RuleSetDetail,
  RuleTestRun,
} from './types';

type BuilderTab = 'overview' | 'builder' | 'rules' | 'tests';
type RuleEditorMode = 'visual' | 'json';

type Props = {
  initialTab?: BuilderTab;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function emptyQuestion(): QuestionnaireQuestion {
  return {
    id: crypto.randomUUID(),
    ref: 'NEW_REF',
    prompt: 'New prompt',
    type: 'text',
    section: 'New section',
    required: false,
    weight: 0,
    options: [],
    helpText: '',
  };
}

function emptyRule(): QuestionnaireRule {
  return {
    id: crypto.randomUUID(),
    name: 'New rule',
    description: 'Describe the trigger and expected behavior.',
    logic: 'AND',
    active: true,
    conditions: ['NO_CONDITION'],
    actions: ['SHOW_QUESTIONS "NEW_REF"'],
  };
}

function buildDefaultAnswers(template: QuestionnaireTemplateDetail | null): Record<string, string | number | boolean | string[]> {
  if (!template) {
    return {};
  }
  return Object.fromEntries(
    template.questions.map((question) => {
      if (question.type === 'boolean') {
        return [question.ref, false];
      }
      if (question.type === 'number') {
        return [question.ref, 0];
      }
      if (question.type === 'multi-select') {
        return [question.ref, []];
      }
      if (question.type === 'single-select') {
        return [question.ref, question.options?.[0] ?? ''];
      }
      return [question.ref, ''];
    }),
  );
}

function severityClass(severity: RuleDiagnostic['severity']) {
  if (severity === 'error') {
    return 'badge-danger';
  }
  if (severity === 'warning') {
    return 'badge-neutral';
  }
  return 'badge-success';
}

export function QuestionnaireBuilderWorkspace({ initialTab = 'builder' }: Props) {
  const { identity } = useEdgeIdentity();
  const [templates, setTemplates] = useState<QuestionnaireTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateDetail, setTemplateDetail] = useState<QuestionnaireTemplateDetail | null>(null);
  const [ruleSet, setRuleSet] = useState<RuleSetDetail | null>(null);
  const [testRuns, setTestRuns] = useState<RuleTestRun[]>([]);
  const [previewRun, setPreviewRun] = useState<RuleTestRun | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<QuestionnaireTemplateDetail | null>(null);
  const [draftRuleSet, setDraftRuleSet] = useState<RuleSetDetail | null>(null);
  const [testScenarioName, setTestScenarioName] = useState('High risk supplier review');
  const [testAnswers, setTestAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [activeTab, setActiveTab] = useState<BuilderTab>(initialTab);
  const [ruleEditorMode, setRuleEditorMode] = useState<RuleEditorMode>('visual');
  const [ruleJsonDraft, setRuleJsonDraft] = useState('[]');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningTest, setRunningTest] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  async function loadTemplates() {
    try {
      setLoading(true);
      setError(null);
      const nextTemplates = await listQuestionnaireTemplates();
      setTemplates(nextTemplates);
      setSelectedId((current) => current ?? nextTemplates[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load questionnaire builders.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(questionnaireId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      setNotice(null);
      const detail = await getQuestionnaireTemplate(questionnaireId);
      setTemplateDetail(detail.template);
      setRuleSet(detail.ruleSet);
      setTestRuns(detail.testRuns);
      setDraftTemplate(detail.template);
      setDraftRuleSet(detail.ruleSet);
      setRuleJsonDraft(JSON.stringify(detail.ruleSet.rules, null, 2));
      setJsonError(null);
      setPreviewRun(null);
      setTestAnswers(buildDefaultAnswers(detail.template));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load questionnaire detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const metrics = useMemo(() => {
    const currentTemplate = draftTemplate ?? templateDetail;
    const currentRuleSet = draftRuleSet ?? ruleSet;
    return [
      {
        label: 'Templates',
        value: templates.length,
        detail: 'Canonical questionnaire packages in the tenant',
      },
      {
        label: 'Questions',
        value: currentTemplate?.questions.length ?? 0,
        detail: 'Prompt fields wired into scoring and automation',
      },
      {
        label: 'Rules',
        value: currentRuleSet?.rules.length ?? 0,
        detail: 'Visual rules driving visibility and score behavior',
      },
      {
        label: 'Recent Tests',
        value: testRuns.length,
        detail: 'Persisted simulation runs stored in D1',
      },
    ];
  }, [draftRuleSet, draftTemplate, ruleSet, templateDetail, templates.length, testRuns.length]);

  async function handleCreateTemplate() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createQuestionnaireTemplate({
        name: `Questionnaire ${templates.length + 1}`,
        description: 'New canonical questionnaire package.',
        audience: 'Internal reviewers',
      });
      await loadTemplates();
      setSelectedId(created.template.id);
      setActiveTab('builder');
      setNotice('New questionnaire template created in the canonical builder service.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create questionnaire template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemplate() {
    if (!selectedId || !draftTemplate) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await saveQuestionnaireTemplate(selectedId, {
        name: draftTemplate.name,
        description: draftTemplate.description,
        status: draftTemplate.status,
        scoringMode: draftTemplate.scoringMode,
        audience: draftTemplate.audience,
        questions: draftTemplate.questions,
      });
      setTemplateDetail(saved.template);
      setRuleSet(saved.ruleSet);
      setTestRuns(saved.testRuns);
      setDraftTemplate(saved.template);
      setDraftRuleSet(saved.ruleSet);
      setRuleJsonDraft(JSON.stringify(saved.ruleSet.rules, null, 2));
      setNotice('Questionnaire builder saved.');
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save questionnaire template.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRules() {
    if (!selectedId || !draftRuleSet) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const saved = await saveQuestionnaireRules(selectedId, {
        name: draftRuleSet.name,
        rules: draftRuleSet.rules,
      });
      setRuleSet(saved);
      setDraftRuleSet(saved);
      setRuleJsonDraft(JSON.stringify(saved.rules, null, 2));
      setNotice('Rules saved to the canonical builder service.');
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save questionnaire rules.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunTest() {
    if (!selectedId) {
      return;
    }
    try {
      setRunningTest(true);
      setError(null);
      setNotice(null);
      const run = await runQuestionnaireRuleTest(selectedId, {
        scenarioName: testScenarioName,
        answers: testAnswers,
      });
      setTestRuns((current) => [run, ...current.filter((item) => item.id !== run.id)].slice(0, 12));
      setActiveTab('tests');
      setNotice('Saved rule test executed and persisted to D1.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute rules test.');
    } finally {
      setRunningTest(false);
    }
  }

  function applyRuleJsonDraft() {
    if (!draftRuleSet) {
      return;
    }

    try {
      const parsed = JSON.parse(ruleJsonDraft) as QuestionnaireRule[];
      if (!Array.isArray(parsed)) {
        throw new Error('Rule JSON must be an array of rule objects.');
      }

      setDraftRuleSet({
        ...draftRuleSet,
        rules: parsed,
      });
      setJsonError(null);
      setNotice('JSON draft applied to the in-memory rules editor.');
      setRuleEditorMode('visual');
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Unable to parse rule JSON.');
    }
  }

  async function handleValidateRules() {
    if (!selectedId || !draftRuleSet || !draftTemplate) {
      return;
    }

    try {
      setValidating(true);
      setError(null);
      setNotice(null);
      const validation = await validateQuestionnaireRules(selectedId, {
        rules: draftRuleSet.rules,
        questions: draftTemplate.questions,
      });
      setDraftRuleSet((current) => (current ? { ...current, diagnostics: validation.diagnostics } : current));
      setNotice('Draft rules validated against the current questionnaire package.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to validate draft rules.');
    } finally {
      setValidating(false);
    }
  }

  async function handlePreviewTest() {
    if (!selectedId || !draftRuleSet || !draftTemplate) {
      return;
    }

    try {
      setPreviewing(true);
      setError(null);
      setNotice(null);
      const preview = await previewQuestionnaireRuleTest(selectedId, {
        scenarioName: testScenarioName,
        answers: testAnswers,
        draftRules: draftRuleSet.rules,
        draftQuestions: draftTemplate.questions,
      });
      setPreviewRun(preview);
      setActiveTab('tests');
      setNotice('Draft preview executed against unsaved questionnaire rules.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview draft rules.');
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading builder workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Builders</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Questionnaire Builder</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Build reusable questionnaires with question packages, scoring posture, and a real visual
              rules engine backed by D1. This is now part of the canonical Regovise stack, not the
              `openregscale` reference sandbox.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" to="/builders/questionnaire-builder/overview">
              <Sparkles className="mr-2 h-4 w-4" />
              Overview
            </Link>
            <Link className="button-secondary" to="/builders/questionnaire-builder">
              <ClipboardList className="mr-2 h-4 w-4" />
              Builder
            </Link>
            <Link className="button-secondary" to="/builders/questionnaire-builder/rules-engine">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Visual Rules Engine
            </Link>
            <button className="button-secondary" onClick={() => void handleCreateTemplate()} type="button">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSaveTemplate()} type="button">
              <Save className="mr-2 h-4 w-4" />
              Save Builder
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
              <div className="eyebrow">Template Library</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Authoring Packages</h2>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-3">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`panel-subtle w-full text-left transition ${
                  selectedId === template.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'hover:border-cyan-300/20'
                }`}
                onClick={() => setSelectedId(template.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{template.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{template.description ?? 'No description yet.'}</div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge-neutral">{template.status}</span>
                  <span className="badge-neutral">{template.questionCount} questions</span>
                  <span className="badge-neutral">{template.ruleCount} rules</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">Updated {formatDate(template.updatedAt)}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          {detailLoading || !draftTemplate || !draftRuleSet ? (
            <div className="text-sm text-slate-300">Loading questionnaire detail...</div>
          ) : (
            <Tabs onValueChange={(value) => setActiveTab(value as BuilderTab)} value={activeTab}>
              <TabsList className="mb-6 w-fit rounded-2xl border border-white/10 bg-slate-950/70">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="rules">Visual Rules Engine</TabsTrigger>
                <TabsTrigger value="tests">Test Runs</TabsTrigger>
              </TabsList>

              <TabsContent className="space-y-6" value="overview">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <div className="panel-subtle">
                      <div className="eyebrow">Questionnaire Overview</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">Enterprise questionnaire system overview</h3>
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                        Understand the template, instance, scoring, workflow, and assignment model behind the canonical questionnaire platform. This overview stays connected to the live builder and rules engine instead of drifting into disconnected documentation.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="panel-subtle">
                        <div className="eyebrow">Core Concepts</div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div>Template vs instance separation keeps design-time structures distinct from distributed assignments and responses.</div>
                          <div>Questions carry stable refs, sections, required flags, help text, and weighting for reusable scoring posture.</div>
                          <div>Rules, scoring, and tests are versioned so the authoring surface stays aligned with the execution engine.</div>
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Assignment Options</div>
                        <div className="mt-4 space-y-2 text-sm text-slate-300">
                          {[
                            'User-based assignments',
                            'Email-based assignments',
                            'Module-based launches',
                            'Self-assignment / public links',
                            'Recurring distribution',
                            'Bulk spreadsheet assignment',
                            'Per-question routing',
                          ].map((item) => (
                            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="panel-subtle">
                        <div className="eyebrow">Workflow & States</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {['Open', 'Submitted', 'Accepted', 'Request Changes', 'Closed'].map((state) => (
                            <div key={state} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                              {state}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-slate-400">
                          Persisted test runs, saved questionnaires, and downstream report integrations all inherit from this lifecycle posture.
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Question Types</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-300">
                          {[
                            'Text',
                            'Number',
                            'Date',
                            'Email',
                            'Phone',
                            'Multiple choice',
                            'Checkboxes',
                            'Dropdown',
                            'Table',
                            'Instructional',
                          ].map((item) => (
                            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="panel-subtle">
                        <div className="eyebrow">Scoring System</div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div>Question-level weighting supports calculated, maturity, and boolean score models.</div>
                          <div>Grade, pass/fail, and completion posture stay visible across test runs and downstream assessments.</div>
                          <div>Manual overrides and derived scoring can coexist when reviewer sign-off is still required.</div>
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Key Features</div>
                        <div className="mt-4 space-y-2 text-sm text-slate-300">
                          {[
                            'Section management',
                            'Control mappings',
                            'Dual storage / reporting model',
                            'Anonymous access',
                            'Import / export',
                            'Metadata headers',
                            'Recurring assignments',
                            'Report Builder integration',
                          ].map((item) => (
                            <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="panel-subtle">
                      <div className="eyebrow">Technical Architecture</div>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        {[
                          ['Templates', `${templates.length}`, 'Reusable questionnaire packages in the tenant'],
                          ['Rules', `${draftRuleSet.rules.length}`, 'Visual rules and validation diagnostics'],
                          ['History', `${testRuns.length}`, 'Persisted execution history for review and auditability'],
                        ].map(([label, value, detail]) => (
                          <div key={label} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                            <div className="label">{label}</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                            <div className="mt-2 text-sm text-slate-400">{detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="panel-subtle">
                      <div className="eyebrow">Current Package</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{draftTemplate.name}</div>
                      <div className="mt-2 text-sm text-slate-400">
                        Version {draftTemplate.version} · Updated {formatDate(draftTemplate.updatedAt)}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Live Alignment</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                          <span>This overview reflects the live builder, rules engine, and test-run data in the canonical stack.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                          <span>Use the builder and rules tabs to move directly from overview concepts into authoring and validation.</span>
                        </div>
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Open Next</div>
                      <div className="mt-4 flex flex-col gap-2">
                        <button className="button-secondary justify-start" onClick={() => setActiveTab('builder')} type="button">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Open Builder
                        </button>
                        <button className="button-secondary justify-start" onClick={() => setActiveTab('rules')} type="button">
                          <SlidersHorizontal className="mr-2 h-4 w-4" />
                          Open Rules Engine
                        </button>
                        <button className="button-secondary justify-start" onClick={() => setActiveTab('tests')} type="button">
                          <FlaskConical className="mr-2 h-4 w-4" />
                          Open Test Runs
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent className="space-y-6" value="builder">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <div className="panel-subtle">
                      <div className="eyebrow">Metadata</div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="label">Template Name</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) => (current ? { ...current, name: event.target.value } : current))
                            }
                            value={draftTemplate.name}
                          />
                        </div>
                        <div>
                          <label className="label">Audience</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, audience: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.audience ?? ''}
                          />
                        </div>
                        <div>
                          <label className="label">Status</label>
                          <select
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) => (current ? { ...current, status: event.target.value } : current))
                            }
                            value={draftTemplate.status}
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="review">In Review</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Scoring Mode</label>
                          <select
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, scoringMode: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.scoringMode}
                          >
                            <option value="weighted">Weighted</option>
                            <option value="boolean">Boolean</option>
                            <option value="maturity">Maturity</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Description</label>
                          <textarea
                            className="input mt-2 min-h-[120px]"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, description: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.description ?? ''}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="panel-subtle">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Questions</div>
                          <h3 className="mt-2 text-lg font-semibold text-white">Question Set</h3>
                        </div>
                        <button
                          className="button-secondary"
                          onClick={() =>
                            setDraftTemplate((current) =>
                              current
                                ? {
                                    ...current,
                                    questions: [...current.questions, emptyQuestion()],
                                  }
                                : current,
                            )
                          }
                          type="button"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Question
                        </button>
                      </div>
                      <div className="mt-4 space-y-4">
                        {draftTemplate.questions.map((question, index) => (
                          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4" key={question.id}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-white">Question {index + 1}</div>
                              <button
                                className="text-xs uppercase tracking-[0.18em] text-rose-300 transition hover:text-rose-200"
                                onClick={() =>
                                  setDraftTemplate((current) =>
                                    current
                                      ? {
                                          ...current,
                                          questions: current.questions.filter((entry) => entry.id !== question.id),
                                        }
                                      : current,
                                  )
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="label">Reference</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id ? { ...entry, ref: event.target.value } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.ref}
                                />
                              </div>
                              <div>
                                <label className="label">Section</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id ? { ...entry, section: event.target.value } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.section}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Prompt</label>
                                <textarea
                                  className="input mt-2 min-h-[88px]"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id ? { ...entry, prompt: event.target.value } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.prompt}
                                />
                              </div>
                              <div>
                                <label className="label">Type</label>
                                <select
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? { ...entry, type: event.target.value as QuestionnaireQuestion['type'] }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.type}
                                >
                                  <option value="text">Text</option>
                                  <option value="single-select">Single Select</option>
                                  <option value="multi-select">Multi Select</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                </select>
                              </div>
                              <div>
                                <label className="label">Weight</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? { ...entry, weight: Number(event.target.value) || 0 }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  type="number"
                                  value={question.weight}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Options</label>
                                <textarea
                                  className="input mt-2 min-h-[88px]"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? {
                                                    ...entry,
                                                    options: event.target.value
                                                      .split('\n')
                                                      .map((line) => line.trim())
                                                      .filter(Boolean),
                                                  }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  placeholder="One option per line"
                                  value={(question.options ?? []).join('\n')}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="panel-subtle">
                      <div className="eyebrow">Authoring Status</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{draftTemplate.status}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">
                        Version {draftTemplate.version} · Updated {formatDate(draftTemplate.updatedAt)}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Coverage</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>Required questions</span>
                          <span className="font-medium text-white">
                            {draftTemplate.questions.filter((question) => question.required).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Sections</span>
                          <span className="font-medium text-white">
                            {new Set(draftTemplate.questions.map((question) => question.section)).size}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Weighted score points</span>
                          <span className="font-medium text-white">
                            {draftTemplate.questions.reduce((total, question) => total + question.weight, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent className="space-y-6" value="rules">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">Rules Engine</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">Visual Rule Graph</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                      Persisted rule definitions now live in Cloudflare D1 and drive the same scoring and visibility
                      flows your questionnaire package uses in test runs. Draft validation and preview execution now
                      hit the canonical Worker too, so you can verify behavior before committing a save.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="button-secondary"
                      disabled={validating}
                      onClick={() => void handleValidateRules()}
                      type="button"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {validating ? 'Validating...' : 'Validate Draft'}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() =>
                        setDraftRuleSet((current) =>
                          current
                            ? {
                                ...current,
                                rules: [...current.rules, emptyRule()],
                              }
                            : current,
                        )
                      }
                      type="button"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Rule
                    </button>
                    <button className="button-primary" disabled={saving} onClick={() => void handleSaveRules()} type="button">
                      <Save className="mr-2 h-4 w-4" />
                      Save Rules
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <Tabs
                      onValueChange={(value) => {
                        const nextMode = value as RuleEditorMode;
                        setRuleEditorMode(nextMode);
                        if (nextMode === 'json' && draftRuleSet) {
                          setRuleJsonDraft(JSON.stringify(draftRuleSet.rules, null, 2));
                          setJsonError(null);
                        }
                      }}
                      value={ruleEditorMode}
                    >
                      <TabsList className="mb-4 w-fit rounded-2xl border border-white/10 bg-slate-950/70">
                        <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                        <TabsTrigger value="json">
                          <Code2 className="mr-2 h-4 w-4" />
                          JSON Editor
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent className="space-y-4" value="visual">
                        {draftRuleSet.rules.map((rule, index) => (
                          <div className="panel-subtle" key={rule.id}>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-medium text-white">Rule {index + 1}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                  {rule.active ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                              <button
                                className="text-xs uppercase tracking-[0.18em] text-rose-300 transition hover:text-rose-200"
                                onClick={() =>
                                  setDraftRuleSet((current) =>
                                    current
                                      ? { ...current, rules: current.rules.filter((entry) => entry.id !== rule.id) }
                                      : current,
                                  )
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="label">Rule Name</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id ? { ...entry, name: event.target.value } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={rule.name}
                                />
                              </div>
                              <div>
                                <label className="label">Logic</label>
                                <select
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? { ...entry, logic: event.target.value as QuestionnaireRule['logic'] }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={rule.logic}
                                >
                                  <option value="AND">AND</option>
                                  <option value="OR">OR</option>
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Description</label>
                                <textarea
                                  className="input mt-2 min-h-[88px]"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id ? { ...entry, description: event.target.value } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={rule.description}
                                />
                              </div>
                              <div>
                                <label className="label">Conditions</label>
                                <textarea
                                  className="input mt-2 min-h-[120px]"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    conditions: event.target.value
                                                      .split('\n')
                                                      .map((line) => line.trim())
                                                      .filter(Boolean),
                                                  }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={rule.conditions.join('\n')}
                                />
                              </div>
                              <div>
                                <label className="label">Actions</label>
                                <textarea
                                  className="input mt-2 min-h-[120px]"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id
                                                ? {
                                                    ...entry,
                                                    actions: event.target.value
                                                      .split('\n')
                                                      .map((line) => line.trim())
                                                      .filter(Boolean),
                                                  }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={rule.actions.join('\n')}
                                />
                              </div>
                              <label className="flex items-center gap-3 text-sm text-slate-300">
                                <input
                                  checked={rule.active}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    setDraftRuleSet((current) =>
                                      current
                                        ? {
                                            ...current,
                                            rules: current.rules.map((entry) =>
                                              entry.id === rule.id ? { ...entry, active: event.target.checked } : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  type="checkbox"
                                />
                                Rule is active
                              </label>
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="json">
                        <div className="panel-subtle">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="eyebrow">Raw Definition</div>
                              <h4 className="mt-2 text-lg font-semibold text-white">Rules JSON</h4>
                            </div>
                            <div className="flex gap-2">
                              <button className="button-secondary" onClick={applyRuleJsonDraft} type="button">
                                Apply JSON
                              </button>
                              <button
                                className="button-secondary"
                                disabled={validating}
                                onClick={() => void handleValidateRules()}
                                type="button"
                              >
                                {validating ? 'Validating...' : 'Validate Applied Draft'}
                              </button>
                            </div>
                          </div>
                          <textarea
                            className="input mt-4 min-h-[420px] font-mono text-xs leading-6"
                            onChange={(event) => {
                              setRuleJsonDraft(event.target.value);
                              if (jsonError) {
                                setJsonError(null);
                              }
                            }}
                            spellCheck={false}
                            value={ruleJsonDraft}
                          />
                          {jsonError && <div className="notice-error mt-4">{jsonError}</div>}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <aside className="space-y-4">
                    <div className="panel-subtle">
                      <div className="eyebrow">Diagnostics</div>
                      <div className="mt-4 space-y-3">
                        {draftRuleSet.diagnostics.map((diagnostic) => (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3" key={diagnostic.id}>
                            <div className={severityClass(diagnostic.severity)}>{diagnostic.severity}</div>
                            <div className="mt-2 text-sm leading-6 text-slate-300">{diagnostic.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Rule Engine Version</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{draftRuleSet.engineVersion}</div>
                      <div className="mt-2 text-sm text-slate-400">Updated {formatDate(draftRuleSet.updatedAt)}</div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Draft Ops</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <span>Validate against current questionnaire refs before saving</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <span>Preview unsaved draft logic in the test runner</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-cyan-300" />
                          <span>Drop to JSON when bulk edits are faster than card editing</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent className="space-y-6" value="tests">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="space-y-4">
                    <div className="panel-subtle">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Simulation</div>
                          <h3 className="mt-2 text-xl font-semibold text-white">Run Rule Test</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary"
                            disabled={previewing}
                            onClick={() => void handlePreviewTest()}
                            type="button"
                          >
                            <FlaskConical className="mr-2 h-4 w-4" />
                            {previewing ? 'Previewing...' : 'Preview Draft'}
                          </button>
                          <button
                            className="button-primary"
                            disabled={runningTest}
                            onClick={() => void handleRunTest()}
                            type="button"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {runningTest ? 'Persisting...' : 'Persist Saved Test'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="label">Scenario Name</label>
                        <input
                          className="input mt-2"
                          onChange={(event) => setTestScenarioName(event.target.value)}
                          value={testScenarioName}
                        />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {draftTemplate.questions.map((question) => (
                          <div key={question.id}>
                            <label className="label">{question.ref}</label>
                            {question.type === 'boolean' ? (
                              <select
                                className="input mt-2"
                                onChange={(event) =>
                                  setTestAnswers((current) => ({
                                    ...current,
                                    [question.ref]: event.target.value === 'true',
                                  }))
                                }
                                value={String(testAnswers[question.ref] ?? false)}
                              >
                                <option value="false">False</option>
                                <option value="true">True</option>
                              </select>
                            ) : question.type === 'single-select' ? (
                              <select
                                className="input mt-2"
                                onChange={(event) =>
                                  setTestAnswers((current) => ({
                                    ...current,
                                    [question.ref]: event.target.value,
                                  }))
                                }
                                value={String(testAnswers[question.ref] ?? '')}
                              >
                                {(question.options ?? []).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setTestAnswers((current) => ({
                                    ...current,
                                    [question.ref]:
                                      question.type === 'number' ? Number(event.target.value) || 0 : event.target.value,
                                  }))
                                }
                                type={question.type === 'number' ? 'number' : 'text'}
                                value={String(testAnswers[question.ref] ?? '')}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {previewRun && (
                      <div className="panel-subtle">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="eyebrow">Draft Preview</div>
                            <h3 className="mt-2 text-xl font-semibold text-white">{previewRun.scenarioName}</h3>
                          </div>
                          <div className="flex gap-2">
                            <span className="badge-neutral">{previewRun.status}</span>
                            <span className="badge-success">{previewRun.result.grade}</span>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="label">Score</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{previewRun.result.score}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="label">Matched Rules</div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {previewRun.result.matchedRules.length}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="label">Visible Questions</div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                              {previewRun.result.visibleQuestions.length}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="label">Matched Rules</div>
                            <div className="mt-3 space-y-2 text-sm text-slate-300">
                              {previewRun.result.matchedRules.length > 0 ? (
                                previewRun.result.matchedRules.map((match) => <div key={match}>{match}</div>)
                              ) : (
                                <div>No rules matched.</div>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="label">Execution Log</div>
                            <div className="mt-3 space-y-2 text-sm text-slate-300">
                              {previewRun.executionLog.map((entry, index) => (
                                <div key={`${previewRun.id}-${index}`}>{entry}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="panel-subtle">
                      <div className="eyebrow">Execution History</div>
                      <div className="mt-4 space-y-3">
                        {testRuns.map((run) => (
                          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4" key={run.id}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-white">{run.scenarioName}</div>
                                <div className="mt-1 text-xs text-slate-500">{formatDate(run.createdAt)}</div>
                              </div>
                              <div className="flex gap-2">
                                <span className="badge-neutral">{run.status}</span>
                                <span className="badge-success">{run.result.grade}</span>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="label">Score</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{run.result.score}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="label">Matched Rules</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{run.result.matchedRules.length}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="label">Visible Questions</div>
                                <div className="mt-2 text-2xl font-semibold text-white">
                                  {run.result.visibleQuestions.length}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="label">Matched Rules</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  {run.result.matchedRules.length > 0 ? (
                                    run.result.matchedRules.map((match) => <div key={match}>{match}</div>)
                                  ) : (
                                    <div>No rules matched.</div>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="label">Execution Log</div>
                                <div className="mt-3 space-y-2 text-sm text-slate-300">
                                  {run.executionLog.map((entry, index) => (
                                    <div key={`${run.id}-${index}`}>{entry}</div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="panel-subtle">
                      <div className="eyebrow">Runtime Posture</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <span>D1 stores questionnaire packages, rules, and execution history</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <span>Rule tests are persisted for auditability and future approvals</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-cyan-300" />
                          <span>Draft preview runs let authors test unsaved logic before committing it</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </section>
      </section>
    </div>
  );
}
