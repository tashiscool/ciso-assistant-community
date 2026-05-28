import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Code2,
  Download,
  FlaskConical,
  Plus,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  createQuestionnaireTemplate,
  createQuestionnaireAssignment,
  deleteQuestionnaireInstance,
  exportQuestionnaireInstance,
  exportQuestionnaireTemplate,
  getQuestionnaireTemplate,
  importQuestionnaireTemplate,
  listQuestionnaireInstances,
  listQuestionnaireTemplates,
  previewQuestionnaireRuleTest,
  runQuestionnaireRuleTest,
  runQuestionnaireInstanceAction,
  saveQuestionnaireRules,
  saveQuestionnaireInstanceResponses,
  saveQuestionnaireTemplate,
  validateQuestionnaireRules,
} from './api';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  QuestionnaireQuestion,
  QuestionnaireInstance,
  QuestionnaireRule,
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateKind,
  QuestionnaireTemplateSummary,
  RuleDiagnostic,
  RuleSetDetail,
  RuleTestRun,
} from './types';

type BuilderTab = 'overview' | 'builder' | 'assignments' | 'responses' | 'rules' | 'tests';
type RuleEditorMode = 'visual' | 'json';
type WorkspaceMode = 'all' | 'assessment-plans' | 'questionnaires';

type Props = {
  initialTab?: BuilderTab;
  workspaceMode?: WorkspaceMode;
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
    evidenceHint: '',
    enableUpload: false,
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
      if (question.type === 'table') {
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

function templateKindForWorkspace(mode: WorkspaceMode): QuestionnaireTemplateKind | null {
  if (mode === 'assessment-plans') {
    return 'assessment-plan';
  }
  if (mode === 'questionnaires') {
    return 'questionnaire';
  }
  return null;
}

function isQuestionnaireTemplate(kind: QuestionnaireTemplateKind) {
  return kind === 'questionnaire';
}

function workspaceLabels(mode: WorkspaceMode) {
  if (mode === 'assessment-plans') {
    return {
      pageTitle: 'Assessment Plans',
      pageDescription:
        'Build reusable assessment plans with lines of inquiry, audit criteria, requirement traceability, and reviewer guidance that can be reused across manual assessments.',
      createLabel: 'New Assessment Plan',
      saveLabel: 'Save Assessment Plan',
      libraryLabel: 'Assessment Plan Library',
      libraryTitle: 'Audit Plan Packages',
      singularLabel: 'Assessment Plan',
      questionLabel: 'Line of Inquiry',
      questionSetLabel: 'Lines of Inquiry',
      promptLabel: 'Question / Criteria',
      overviewTitle: 'Assessment plan system overview',
      conceptLabel: 'Assessment Plan Concepts',
      builderEyebrow: 'Assessment Plans',
      metadataNameLabel: 'Assessment Plan Name',
      audienceLabel: 'Owner / Audience',
      sourceFrameworkLabel: 'Source Framework or Process',
      usageNotesLabel: 'Usage Notes',
      openPrimaryLabel: 'Open Assessments',
      openPrimaryRoute: '/assessments',
    };
  }

  if (mode === 'questionnaires') {
    return {
      pageTitle: 'Questionnaires',
      pageDescription:
        'Build reusable questionnaires with assignment-ready prompts, attestation and evidence semantics, lifecycle posture, and rule-driven conditional behavior.',
      createLabel: 'New Questionnaire',
      saveLabel: 'Save Questionnaire',
      libraryLabel: 'Questionnaire Library',
      libraryTitle: 'Questionnaire Packages',
      singularLabel: 'Questionnaire',
      questionLabel: 'Question',
      questionSetLabel: 'Questions',
      promptLabel: 'Prompt',
      overviewTitle: 'Questionnaire system overview',
      conceptLabel: 'Questionnaire Concepts',
      builderEyebrow: 'Questionnaires',
      metadataNameLabel: 'Questionnaire Name',
      audienceLabel: 'Audience',
      sourceFrameworkLabel: 'Source Framework',
      usageNotesLabel: 'Usage Notes',
      openPrimaryLabel: 'Open Assessments',
      openPrimaryRoute: '/assessments',
    };
  }

  return {
    pageTitle: 'Questionnaire Builder',
    pageDescription:
      'Build reusable questionnaires and assessment-plan templates with question packages, scoring posture, and a real visual rules engine backed by D1.',
    createLabel: 'New Template',
    saveLabel: 'Save Builder',
    libraryLabel: 'Template Library',
    libraryTitle: 'Authoring Packages',
    singularLabel: 'Template',
    questionLabel: 'Question',
    questionSetLabel: 'Questions',
    promptLabel: 'Prompt',
    overviewTitle: 'Enterprise questionnaire system overview',
    conceptLabel: 'Core Concepts',
    builderEyebrow: 'Builders',
    metadataNameLabel: 'Template Name',
    audienceLabel: 'Audience',
    sourceFrameworkLabel: 'Source Framework',
    usageNotesLabel: 'Usage Notes',
    openPrimaryLabel: 'Open Assessments',
    openPrimaryRoute: '/assessments',
  };
}

export function QuestionnaireBuilderWorkspace({
  initialTab = 'builder',
  workspaceMode = 'all',
}: Props) {
  const { identity } = useEdgeIdentity();
  const scopedTemplateKind = templateKindForWorkspace(workspaceMode);
  const labels = workspaceLabels(workspaceMode);
  const [templates, setTemplates] = useState<QuestionnaireTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateDetail, setTemplateDetail] = useState<QuestionnaireTemplateDetail | null>(null);
  const [ruleSet, setRuleSet] = useState<RuleSetDetail | null>(null);
  const [testRuns, setTestRuns] = useState<RuleTestRun[]>([]);
  const [instances, setInstances] = useState<QuestionnaireInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState<RuleTestRun | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<QuestionnaireTemplateDetail | null>(null);
  const [draftRuleSet, setDraftRuleSet] = useState<RuleSetDetail | null>(null);
  const [newSectionName, setNewSectionName] = useState('New section');
  const [assignmentForm, setAssignmentForm] = useState({
    assignmentType: 'user' as 'user' | 'email' | 'module' | 'self' | 'recurring' | 'bulk',
    title: '',
    assigneeUserId: '',
    assigneeEmail: '',
    bulkCsv: '',
    reviewerUserId: '',
    parentModule: '',
    parentRecordId: '',
    dueDate: '',
    recurrenceType: 'Monthly',
    startDate: '',
    endDate: '',
    loginRequired: false,
  });
  const [responseDrafts, setResponseDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [uploadDrafts, setUploadDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [reviewComments, setReviewComments] = useState('');
  const [importJsonDraft, setImportJsonDraft] = useState('');
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
      setError(err instanceof Error ? err.message : 'Unable to load template packages.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(questionnaireId: string) {
    try {
      setDetailLoading(true);
      setError(null);
      setNotice(null);
      const [detail, nextInstances] = await Promise.all([
        getQuestionnaireTemplate(questionnaireId),
        listQuestionnaireInstances(questionnaireId),
      ]);
      setTemplateDetail(detail.template);
      setRuleSet(detail.ruleSet);
      setTestRuns(detail.testRuns);
      setInstances(nextInstances);
      setSelectedInstanceId((current) =>
        current && nextInstances.some((instance) => instance.id === current)
          ? current
          : nextInstances[0]?.id ?? null,
      );
      setResponseDrafts(
        Object.fromEntries(nextInstances.map((instance) => [instance.id, instance.answers ?? {}])),
      );
      setUploadDrafts(
        Object.fromEntries(nextInstances.map((instance) => [instance.id, instance.uploads ?? {}])),
      );
      setDraftTemplate(detail.template);
      setDraftRuleSet(detail.ruleSet);
      setRuleJsonDraft(JSON.stringify(detail.ruleSet.rules, null, 2));
      setJsonError(null);
      setPreviewRun(null);
      setTestAnswers(buildDefaultAnswers(detail.template));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load template detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshInstances(questionnaireId = selectedId) {
    if (!questionnaireId) {
      return;
    }
    const nextInstances = await listQuestionnaireInstances(questionnaireId);
    setInstances(nextInstances);
    setSelectedInstanceId((current) =>
      current && nextInstances.some((instance) => instance.id === current)
        ? current
        : nextInstances[0]?.id ?? null,
    );
    setResponseDrafts(Object.fromEntries(nextInstances.map((instance) => [instance.id, instance.answers ?? {}])));
    setUploadDrafts(Object.fromEntries(nextInstances.map((instance) => [instance.id, instance.uploads ?? {}])));
  }

  useEffect(() => {
    void loadTemplates();
  }, [identity.tenantId, identity.userId]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId]);

  const visibleTemplates = useMemo(
    () =>
      scopedTemplateKind
        ? templates.filter((template) => template.templateKind === scopedTemplateKind)
        : templates,
    [scopedTemplateKind, templates],
  );

  useEffect(() => {
    setSelectedId((current) => {
      if (current && visibleTemplates.some((template) => template.id === current)) {
        return current;
      }
      return visibleTemplates[0]?.id ?? null;
    });
  }, [visibleTemplates]);

  const metrics = useMemo(() => {
    const currentTemplate = draftTemplate ?? templateDetail;
    const currentRuleSet = draftRuleSet ?? ruleSet;
    return [
      {
        label: workspaceMode === 'assessment-plans' ? 'Plans' : workspaceMode === 'questionnaires' ? 'Questionnaires' : 'Templates',
        value: visibleTemplates.length,
        detail:
          workspaceMode === 'assessment-plans'
            ? 'Reusable assessment plans in the tenant'
            : workspaceMode === 'questionnaires'
              ? 'Reusable questionnaires in the tenant'
              : 'Canonical questionnaire packages in the tenant',
      },
      {
        label: labels.questionSetLabel,
        value: currentTemplate?.questions.length ?? 0,
        detail:
          workspaceMode === 'assessment-plans'
            ? 'Lines of inquiry wired into repeatable audit execution'
            : 'Prompt fields wired into scoring and automation',
      },
      {
        label: 'Rules',
        value: currentRuleSet?.rules.length ?? 0,
        detail: 'Visual rules driving visibility and score behavior',
      },
      {
        label: 'Assignments',
        value: instances.length,
        detail: 'Tenant response instances created from the active package',
      },
    ];
  }, [draftRuleSet, draftTemplate, instances.length, labels.questionSetLabel, ruleSet, templateDetail, visibleTemplates.length, workspaceMode]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? instances[0] ?? null,
    [instances, selectedInstanceId],
  );

  async function handleCreateTemplate() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const nextKind = scopedTemplateKind ?? 'questionnaire';
      const created = await createQuestionnaireTemplate({
        name:
          nextKind === 'assessment-plan'
            ? `Assessment Plan ${visibleTemplates.length + 1}`
            : `Questionnaire ${visibleTemplates.length + 1}`,
        description:
          nextKind === 'assessment-plan'
            ? 'New assessment plan with reusable lines of inquiry.'
            : 'New canonical questionnaire package.',
        audience: nextKind === 'assessment-plan' ? 'Internal assessors' : 'Internal reviewers',
        templateKind: nextKind,
        sourceFramework: nextKind === 'assessment-plan' ? 'Framework or process reference' : null,
        usageNotes:
          nextKind === 'assessment-plan'
            ? 'Use this assessment plan to preload lines of inquiry into manual reviews.'
            : null,
        questionnaireType: nextKind === 'questionnaire' ? 'Compliance Intake' : null,
        assignmentModel: nextKind === 'questionnaire' ? 'User assignment' : null,
        relatedWorkflow: nextKind === 'questionnaire' ? 'Risk and compliance intake' : null,
        attestationScope: nextKind === 'questionnaire' ? 'Requirements, controls, or supporting audit inputs' : null,
        responseOwnerModel: nextKind === 'questionnaire' ? 'Internal control owner or external respondent' : null,
        evidenceCollectionMode: nextKind === 'questionnaire' ? 'Supporting evidence requested' : null,
        exportMode: nextKind === 'questionnaire' ? 'Spreadsheet-ready' : null,
        distributionCadence: nextKind === 'questionnaire' ? 'As needed' : null,
        ownerUserId: identity.userId,
        ownerName: '',
        profile: nextKind === 'questionnaire' ? 'General Questionnaire Profile' : 'Assessment Plan Profile',
        instructions:
          nextKind === 'questionnaire'
            ? 'Complete required questions, attach supporting evidence, and submit for reviewer feedback.'
            : 'Use each line of inquiry to guide assessment fieldwork.',
        allowPublicUrl: nextKind === 'questionnaire',
        loginRequired: false,
        enableScoring: true,
        enableQuestionAssignment: false,
      });
      await loadTemplates();
      setSelectedId(created.template.id);
      setActiveTab('builder');
      setNotice(
        nextKind === 'assessment-plan'
          ? 'New assessment plan created in the canonical template service.'
          : 'New questionnaire template created in the canonical builder service.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : workspaceMode === 'assessment-plans'
            ? 'Unable to create assessment plan.'
            : 'Unable to create questionnaire template.',
      );
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
        templateKind: draftTemplate.templateKind,
        scoringMode: draftTemplate.scoringMode,
        audience: draftTemplate.audience,
        sourceFramework: draftTemplate.sourceFramework,
        usageNotes: draftTemplate.usageNotes,
        questionnaireType: draftTemplate.questionnaireType,
        assignmentModel: draftTemplate.assignmentModel,
        relatedWorkflow: draftTemplate.relatedWorkflow,
        attestationScope: draftTemplate.attestationScope,
        responseOwnerModel: draftTemplate.responseOwnerModel,
        evidenceCollectionMode: draftTemplate.evidenceCollectionMode,
        fileUploadGuidance: draftTemplate.fileUploadGuidance,
        exportMode: draftTemplate.exportMode,
        distributionCadence: draftTemplate.distributionCadence,
        ownerUserId: draftTemplate.ownerUserId,
        ownerName: draftTemplate.ownerName,
        profile: draftTemplate.profile,
        instructions: draftTemplate.instructions,
        allowPublicUrl: draftTemplate.allowPublicUrl,
        loginRequired: draftTemplate.loginRequired,
        enableScoring: draftTemplate.enableScoring,
        enableQuestionAssignment: draftTemplate.enableQuestionAssignment,
        questions: draftTemplate.questions,
      });
      setTemplateDetail(saved.template);
      setRuleSet(saved.ruleSet);
      setTestRuns(saved.testRuns);
      setDraftTemplate(saved.template);
      setDraftRuleSet(saved.ruleSet);
      setRuleJsonDraft(JSON.stringify(saved.ruleSet.rules, null, 2));
      setNotice(
        draftTemplate.templateKind === 'assessment-plan'
          ? 'Assessment plan saved.'
          : 'Questionnaire builder saved.',
      );
      await loadTemplates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : draftTemplate.templateKind === 'assessment-plan'
            ? 'Unable to save assessment plan.'
            : 'Unable to save questionnaire template.',
      );
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
      setNotice(
        workspaceMode === 'assessment-plans'
          ? 'Draft rules validated against the current assessment plan.'
          : 'Draft rules validated against the current questionnaire package.',
      );
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
      setNotice(
        workspaceMode === 'assessment-plans'
          ? 'Draft preview executed against unsaved assessment-plan rules.'
          : 'Draft preview executed against unsaved questionnaire rules.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview draft rules.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImportTemplate() {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const parsed = JSON.parse(importJsonDraft || '{}') as {
        template?: Partial<QuestionnaireTemplateDetail>;
        rules?: QuestionnaireRule[];
      };
      const imported = await importQuestionnaireTemplate({
        template: parsed.template ?? parsed as Partial<QuestionnaireTemplateDetail>,
        rules: parsed.rules ?? [],
      });
      await loadTemplates();
      setSelectedId(imported.template.id);
      setImportJsonDraft('');
      setNotice('Questionnaire package imported from JSON.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import questionnaire package.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportTemplate() {
    if (!selectedId) {
      return;
    }
    try {
      const exported = await exportQuestionnaireTemplate(selectedId);
      setImportJsonDraft(JSON.stringify(exported, null, 2));
      setNotice('Template export generated and placed in the import/export JSON panel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export questionnaire package.');
    }
  }

  async function handleCreateAssignment() {
    if (!selectedId) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await createQuestionnaireAssignment(selectedId, {
        ...assignmentForm,
        title: assignmentForm.title || draftTemplate?.name || undefined,
      });
      await refreshInstances(selectedId);
      setSelectedInstanceId(created[0]?.id ?? null);
      setActiveTab('responses');
      setNotice(`Created ${created.length} questionnaire assignment${created.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create questionnaire assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInstanceResponse(instance: QuestionnaireInstance) {
    if (!selectedId) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const updated = await saveQuestionnaireInstanceResponses(selectedId, instance.id, {
        answers: responseDrafts[instance.id] ?? {},
        uploads: uploadDrafts[instance.id] ?? {},
        comment: 'Saved from Questionnaire Builder response workspace.',
      });
      await refreshInstances(selectedId);
      setSelectedInstanceId(updated.id);
      setNotice('Questionnaire response saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save questionnaire response.');
    } finally {
      setSaving(false);
    }
  }

  async function handleInstanceAction(instance: QuestionnaireInstance, action: 'submit' | 'accept' | 'reject' | 'reopen' | 'close' | 'feedback') {
    if (!selectedId) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const updated = await runQuestionnaireInstanceAction(selectedId, instance.id, action, {
        reviewerComments: reviewComments || `${action} from Questionnaire Builder review workspace.`,
        sendEmail: action === 'reject' || action === 'feedback',
        feedback: Object.fromEntries(
          (draftTemplate?.questions ?? []).map((question) => [
            question.ref,
            {
              rating: instance.feedback?.[question.ref]?.rating ?? (action === 'accept' ? 'Acceptable' : 'Partially Acceptable'),
              comment: instance.feedback?.[question.ref]?.comment ?? '',
            },
          ]),
        ),
      });
      await refreshInstances(selectedId);
      setSelectedInstanceId(updated.id);
      setNotice(`Questionnaire response moved to ${updated.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update questionnaire response state.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInstance(instance: QuestionnaireInstance) {
    if (!selectedId) {
      return;
    }
    const confirmed = window.confirm(`Delete questionnaire assignment "${instance.title}"?`);
    if (!confirmed) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      await deleteQuestionnaireInstance(selectedId, instance.id);
      await refreshInstances(selectedId);
      setNotice('Questionnaire assignment deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete questionnaire assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportInstance(instance: QuestionnaireInstance) {
    if (!selectedId) {
      return;
    }
    try {
      const exported = await exportQuestionnaireInstance(selectedId, instance.id);
      setImportJsonDraft(JSON.stringify(exported, null, 2));
      setNotice('Response export generated and placed in the import/export JSON panel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export questionnaire response.');
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
            <div className="eyebrow">{labels.builderEyebrow}</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">{labels.pageTitle}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {labels.pageDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setActiveTab('overview')} type="button">
              <Sparkles className="mr-2 h-4 w-4" />
              Overview
            </button>
            <button className="button-secondary" onClick={() => setActiveTab('builder')} type="button">
              <ClipboardList className="mr-2 h-4 w-4" />
              Builder
            </button>
            <button className="button-secondary" onClick={() => setActiveTab('assignments')} type="button">
              <Send className="mr-2 h-4 w-4" />
              Assign
            </button>
            <button className="button-secondary" onClick={() => setActiveTab('responses')} type="button">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Responses
            </button>
            <button className="button-secondary" onClick={() => setActiveTab('rules')} type="button">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Visual Rules Engine
            </button>
            <button className="button-secondary" onClick={() => void handleCreateTemplate()} type="button">
              <Plus className="mr-2 h-4 w-4" />
              {labels.createLabel}
            </button>
            <button className="button-primary" disabled={saving} onClick={() => void handleSaveTemplate()} type="button">
              <Save className="mr-2 h-4 w-4" />
              {labels.saveLabel}
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
              <div className="eyebrow">{labels.libraryLabel}</div>
              <h2 className="mt-2 text-xl font-semibold text-white">{labels.libraryTitle}</h2>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-3">
            {visibleTemplates.map((template) => (
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
                  <span className="badge-neutral">
                    {template.templateKind === 'assessment-plan' ? 'Assessment Plan' : 'Questionnaire'}
                  </span>
                  {template.templateKind === 'questionnaire' && template.questionnaireType ? (
                    <span className="badge-neutral">{template.questionnaireType}</span>
                  ) : null}
                  {template.templateKind === 'questionnaire' && template.assignmentModel ? (
                    <span className="badge-neutral">{template.assignmentModel}</span>
                  ) : null}
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
            <div className="text-sm text-slate-300">
              Loading {workspaceMode === 'assessment-plans' ? 'assessment plan' : 'template'} detail...
            </div>
          ) : (
            <Tabs onValueChange={(value) => setActiveTab(value as BuilderTab)} value={activeTab}>
              <TabsList className="mb-6 w-fit rounded-2xl border border-white/10 bg-slate-950/70">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="assignments">Assignments</TabsTrigger>
                <TabsTrigger value="responses">Responses</TabsTrigger>
                <TabsTrigger value="rules">Visual Rules Engine</TabsTrigger>
                <TabsTrigger value="tests">Test Runs</TabsTrigger>
              </TabsList>

              <TabsContent className="space-y-6" value="overview">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <div className="panel-subtle">
                      <div className="eyebrow">{labels.pageTitle} Overview</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">{labels.overviewTitle}</h3>
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                        {workspaceMode === 'assessment-plans'
                          ? 'Understand how reusable audit criteria, lines of inquiry, requirement mappings, and reviewer guidance come together in one assessment-plan library. This overview stays connected to the live builder and rules engine instead of drifting into disconnected documentation.'
                          : 'Understand the template, assignment, attestation, evidence, and export model behind the canonical questionnaire platform. This overview stays connected to the live builder and rules engine instead of drifting into disconnected documentation.'}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="panel-subtle">
                        <div className="eyebrow">{labels.conceptLabel}</div>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          {workspaceMode === 'assessment-plans' ? (
                            <>
                              <div>Assessment plans are reusable audit packages that carry stable lines of inquiry, requirement traceability, and reviewer guidance.</div>
                              <div>Each line of inquiry can map to a contractual clause, framework control, or internal business-process check for repeatable manual audits.</div>
                              <div>Rules, scoring, and tests stay versioned so the authoring surface remains aligned with downstream assessment execution.</div>
                            </>
                          ) : (
                            <>
                              <div>Template vs instance separation keeps authoring packages distinct from assigned questionnaires, respondent submissions, and reviewer follow-up.</div>
                              <div>Questions carry stable refs, ordered sections, required flags, help text, evidence hints, and weighting for reusable scoring or attestation posture.</div>
                              <div>Template metadata captures assignment model, response ownership, evidence expectations, file-upload guidance, and export posture for downstream operations.</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">{workspaceMode === 'assessment-plans' ? 'How Plans Are Used' : 'Assignment Options'}</div>
                        <div className="mt-4 space-y-2 text-sm text-slate-300">
                          {(workspaceMode === 'assessment-plans'
                            ? [
                                'Select an assessment plan while preparing a manual assessment',
                                'Reuse the same lines of inquiry across recurring review cycles',
                                'Track completion progress by line of inquiry',
                                'Open follow-up work when a check fails',
                                'Map audit criteria back to requirements for traceability',
                              ]
                            : [
                                'Assigned to internal control owners',
                                'Distributed to vendors and partners',
                                'Launched from audits and assessments',
                                'Used to support data calls and evidence collection',
                                'Routed for reviewer follow-up and attestation',
                                'Repeated on recurring collection cadences',
                              ]).map((item) => (
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
                          {(workspaceMode === 'assessment-plans'
                            ? ['Open', 'Submitted', 'Accepted', 'Request Changes', 'Closed']
                            : ['Draft', 'Assigned', 'In Progress', 'Submitted', 'In Review', 'Accepted', 'Request Changes', 'Closed']).map((state) => (
                            <div key={state} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                              {state}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-slate-400">
                          {workspaceMode === 'assessment-plans'
                            ? 'Persisted test runs, saved plans, and downstream assessment execution all inherit from this lifecycle posture.'
                            : 'Persisted test runs, saved questionnaires, and downstream report integrations all inherit from this lifecycle posture.'}
                        </div>
                      </div>
                      <div className="panel-subtle">
                        <div className="eyebrow">Question Types</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-300">
                          {[
                            'Text response',
                            'Number response',
                            'Boolean / attestation',
                            'Single select',
                            'Multi-select',
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
                          {(workspaceMode === 'assessment-plans'
                            ? [
                                'Lines of inquiry',
                                'Requirement traceability',
                                'Reviewer guidance',
                                'Scored or boolean completion posture',
                                'Reusable audit criteria',
                                'Recurring manual assessment support',
                                'Issue and follow-up generation',
                                'Assessment progress visibility',
                              ]
                            : [
                                'Dynamic question ordering',
                                'Assignment and lifecycle tracking model',
                                'Contract, audit, and risk-assessment linkage',
                                'Evidence guidance and upload expectations',
                                'Conditional rules engine',
                                'Spreadsheet-friendly exports',
                                'Scoring and attestation posture',
                                'Recurring distribution semantics',
                              ]).map((item) => (
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
                          [workspaceMode === 'assessment-plans' ? 'Plans' : 'Templates', `${visibleTemplates.length}`, workspaceMode === 'assessment-plans' ? 'Reusable assessment plans in the tenant' : 'Reusable questionnaire packages in the tenant'],
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
                      {draftTemplate.sourceFramework ? (
                        <div className="mt-3 text-sm text-slate-300">Source: {draftTemplate.sourceFramework}</div>
                      ) : null}
                      {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                        <div className="mt-4 space-y-2 text-sm text-slate-300">
                          {draftTemplate.questionnaireType ? <div>Type: {draftTemplate.questionnaireType}</div> : null}
                          {draftTemplate.assignmentModel ? <div>Assignment: {draftTemplate.assignmentModel}</div> : null}
                          {draftTemplate.evidenceCollectionMode ? <div>Evidence: {draftTemplate.evidenceCollectionMode}</div> : null}
                          {draftTemplate.exportMode ? <div>Export: {draftTemplate.exportMode}</div> : null}
                        </div>
                      ) : null}
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
                        <Link className="button-secondary justify-start" to={labels.openPrimaryRoute}>
                          <ClipboardList className="mr-2 h-4 w-4" />
                          {labels.openPrimaryLabel}
                        </Link>
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
                          <label className="label">{labels.metadataNameLabel}</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) => (current ? { ...current, name: event.target.value } : current))
                            }
                            value={draftTemplate.name}
                          />
                        </div>
                        {workspaceMode === 'all' ? (
                          <div>
                            <label className="label">Template Kind</label>
                            <select
                              className="input mt-2"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current
                                    ? { ...current, templateKind: event.target.value as QuestionnaireTemplateKind }
                                    : current,
                                )
                              }
                              value={draftTemplate.templateKind}
                            >
                              <option value="questionnaire">Questionnaire</option>
                              <option value="assessment-plan">Assessment Plan</option>
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <label className="label">{labels.audienceLabel}</label>
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
                          <label className="label">Owner</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, ownerName: event.target.value } : current,
                              )
                            }
                            placeholder="Control owner, team, or questionnaire lead"
                            value={draftTemplate.ownerName ?? ''}
                          />
                        </div>
                        <div>
                          <label className="label">Owner User ID</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, ownerUserId: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.ownerUserId ?? identity.userId}
                          />
                        </div>
                        <div>
                          <label className="label">Profile</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, profile: event.target.value } : current,
                              )
                            }
                            placeholder="Security profile or control mapping profile"
                            value={draftTemplate.profile ?? ''}
                          />
                        </div>
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div>
                            <label className="label">Questionnaire Type</label>
                            <select
                              className="input mt-2"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current ? { ...current, questionnaireType: event.target.value } : current,
                                )
                              }
                              value={draftTemplate.questionnaireType ?? ''}
                            >
                              <option value="">Select type</option>
                              <option value="Attestation">Attestation</option>
                              <option value="Vendor Risk">Vendor Risk</option>
                              <option value="Audit Support">Audit Support</option>
                              <option value="Data Call">Data Call</option>
                              <option value="Risk Intake">Risk Intake</option>
                              <option value="Compliance Intake">Compliance Intake</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <label className="label">{labels.sourceFrameworkLabel}</label>
                          <input
                            className="input mt-2"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, sourceFramework: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.sourceFramework ?? ''}
                          />
                        </div>
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div>
                            <label className="label">Assignment Model</label>
                            <select
                              className="input mt-2"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current ? { ...current, assignmentModel: event.target.value } : current,
                                )
                              }
                              value={draftTemplate.assignmentModel ?? ''}
                            >
                              <option value="">Select model</option>
                              <option value="User assignment">User assignment</option>
                              <option value="External respondent">External respondent</option>
                              <option value="Assessment support">Assessment support</option>
                              <option value="Data call support">Data call support</option>
                              <option value="Recurring distribution">Recurring distribution</option>
                            </select>
                          </div>
                        ) : null}
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
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div>
                            <label className="label">Evidence Collection Mode</label>
                            <select
                              className="input mt-2"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current ? { ...current, evidenceCollectionMode: event.target.value } : current,
                                )
                              }
                              value={draftTemplate.evidenceCollectionMode ?? ''}
                            >
                              <option value="">Select mode</option>
                              <option value="Supporting evidence requested">Supporting evidence requested</option>
                              <option value="Structured evidence collection">Structured evidence collection</option>
                              <option value="Attestation only">Attestation only</option>
                              <option value="Optional evidence">Optional evidence</option>
                            </select>
                          </div>
                        ) : null}
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
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div>
                            <label className="label">Export Mode</label>
                            <select
                              className="input mt-2"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current ? { ...current, exportMode: event.target.value } : current,
                                )
                              }
                              value={draftTemplate.exportMode ?? ''}
                            >
                              <option value="">Select export posture</option>
                              <option value="Spreadsheet-ready">Spreadsheet-ready</option>
                              <option value="Reviewer workbook">Reviewer workbook</option>
                              <option value="Score summary">Score summary</option>
                            </select>
                          </div>
                        ) : null}
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
                        <div className="md:col-span-2">
                          <label className="label">Instructions</label>
                          <textarea
                            className="input mt-2 min-h-[96px]"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, instructions: event.target.value } : current,
                              )
                            }
                            placeholder="Guidance shown to respondents before they complete the questionnaire"
                            value={draftTemplate.instructions ?? ''}
                          />
                        </div>
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div className="md:col-span-2 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4 md:grid-cols-2">
                            {[
                              ['allowPublicUrl', 'Generate self-assignment URL'],
                              ['loginRequired', 'Require username/password login'],
                              ['enableScoring', 'Enable scoring and grade display'],
                              ['enableQuestionAssignment', 'Enable per-question assignment'],
                            ].map(([key, label]) => (
                              <label className="flex items-center gap-3 text-sm text-slate-300" key={key}>
                                <input
                                  checked={Boolean(draftTemplate[key as keyof QuestionnaireTemplateDetail])}
                                  className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current ? { ...current, [key]: event.target.checked } : current,
                                    )
                                  }
                                  type="checkbox"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        ) : null}
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <>
                            <div>
                              <label className="label">Related Workflow</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraftTemplate((current) =>
                                    current ? { ...current, relatedWorkflow: event.target.value } : current,
                                  )
                                }
                                value={draftTemplate.relatedWorkflow ?? ''}
                              />
                            </div>
                            <div>
                              <label className="label">Distribution Cadence</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraftTemplate((current) =>
                                    current ? { ...current, distributionCadence: event.target.value } : current,
                                  )
                                }
                                value={draftTemplate.distributionCadence ?? ''}
                              />
                            </div>
                            <div>
                              <label className="label">Attestation Scope</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraftTemplate((current) =>
                                    current ? { ...current, attestationScope: event.target.value } : current,
                                  )
                                }
                                value={draftTemplate.attestationScope ?? ''}
                              />
                            </div>
                            <div>
                              <label className="label">Response Owner Model</label>
                              <input
                                className="input mt-2"
                                onChange={(event) =>
                                  setDraftTemplate((current) =>
                                    current ? { ...current, responseOwnerModel: event.target.value } : current,
                                  )
                                }
                                value={draftTemplate.responseOwnerModel ?? ''}
                              />
                            </div>
                          </>
                        ) : null}
                        <div className="md:col-span-2">
                          <label className="label">{labels.usageNotesLabel}</label>
                          <textarea
                            className="input mt-2 min-h-[96px]"
                            onChange={(event) =>
                              setDraftTemplate((current) =>
                                current ? { ...current, usageNotes: event.target.value } : current,
                              )
                            }
                            value={draftTemplate.usageNotes ?? ''}
                          />
                        </div>
                        {isQuestionnaireTemplate(draftTemplate.templateKind) ? (
                          <div className="md:col-span-2">
                            <label className="label">File Upload Guidance</label>
                            <textarea
                              className="input mt-2 min-h-[96px]"
                              onChange={(event) =>
                                setDraftTemplate((current) =>
                                  current ? { ...current, fileUploadGuidance: event.target.value } : current,
                                )
                              }
                              value={draftTemplate.fileUploadGuidance ?? ''}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="panel-subtle">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">{labels.questionSetLabel}</div>
                          <h3 className="mt-2 text-lg font-semibold text-white">{labels.questionSetLabel}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            className="input w-44"
                            value={newSectionName}
                            onChange={(event) => setNewSectionName(event.target.value)}
                            placeholder="Section name"
                          />
                          <button
                            className="button-secondary"
                            onClick={() =>
                              setDraftTemplate((current) =>
                                current
                                  ? {
                                      ...current,
                                      questions: [
                                        ...current.questions,
                                        {
                                          ...emptyQuestion(),
                                          ref: `SECTION_${Date.now()}`,
                                          prompt: `${newSectionName || 'New section'} guidance`,
                                          type: 'instructional',
                                          section: newSectionName || 'New section',
                                        },
                                      ],
                                    }
                                  : current,
                              )
                            }
                            type="button"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Section
                          </button>
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
                            Add {labels.questionLabel}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 space-y-4">
                        {draftTemplate.questions.map((question, index) => (
                          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4" key={question.id}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-white">
                                {labels.questionLabel} {index + 1}
                              </div>
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
                                <label className="label">Section / Domain</label>
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
                                <label className="label">{labels.promptLabel}</label>
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
                                  <option value="number">Number</option>
                                  <option value="date">Date</option>
                                  <option value="email">Email</option>
                                  <option value="phone">Phone Number</option>
                                  <option value="single-select">Single Select</option>
                                  <option value="multi-select">Multi Select</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="table">Table</option>
                                  <option value="instructional">Instructional</option>
                                  <option value="file-upload">File Upload</option>
                                </select>
                              </div>
                              <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                                <label className="flex items-center gap-3 text-sm text-slate-300">
                                  <input
                                    checked={question.required}
                                    className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                    onChange={(event) =>
                                      setDraftTemplate((current) =>
                                        current
                                          ? {
                                              ...current,
                                              questions: current.questions.map((entry) =>
                                                entry.id === question.id ? { ...entry, required: event.target.checked } : entry,
                                              ),
                                            }
                                          : current,
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  Required
                                </label>
                                <label className="flex items-center gap-3 text-sm text-slate-300">
                                  <input
                                    checked={Boolean(question.enableUpload || question.type === 'file-upload')}
                                    className="h-4 w-4 rounded border-white/20 bg-slate-950"
                                    onChange={(event) =>
                                      setDraftTemplate((current) =>
                                        current
                                          ? {
                                              ...current,
                                              questions: current.questions.map((entry) =>
                                                entry.id === question.id ? { ...entry, enableUpload: event.target.checked } : entry,
                                              ),
                                            }
                                          : current,
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  Enable Upload / Manage Uploads
                                </label>
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
                                <label className="label">Respondent Help Text</label>
                                <textarea
                                  className="input mt-2 min-h-[72px]"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? { ...entry, helpText: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.helpText ?? ''}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Requirement Reference</label>
                                <input
                                  className="input mt-2"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? { ...entry, requirementRef: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.requirementRef ?? ''}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="label">Evidence Guidance</label>
                                <textarea
                                  className="input mt-2 min-h-[88px]"
                                  onChange={(event) =>
                                    setDraftTemplate((current) =>
                                      current
                                        ? {
                                            ...current,
                                            questions: current.questions.map((entry) =>
                                              entry.id === question.id
                                                ? { ...entry, evidenceHint: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                  value={question.evidenceHint ?? ''}
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
                          <span>Required {labels.questionSetLabel.toLowerCase()}</span>
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
                          <span>Mapped requirements</span>
                          <span className="font-medium text-white">
                            {draftTemplate.questions.filter((question) => question.requirementRef?.trim()).length}
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

              <TabsContent className="space-y-6" value="assignments">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="panel-subtle">
                    <div className="eyebrow">Assignment</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">Create Questionnaire Assignment</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Assign to an internal user, external email, linked module record, recurring schedule, bulk CSV list, or a self-assignment access-code URL.
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="label">Assignment Type</span>
                        <select
                          className="input"
                          value={assignmentForm.assignmentType}
                          onChange={(event) =>
                            setAssignmentForm((current) => ({
                              ...current,
                              assignmentType: event.target.value as typeof assignmentForm.assignmentType,
                            }))
                          }
                        >
                          <option value="user">Assign to User</option>
                          <option value="email">Assign by Email</option>
                          <option value="module">Assign by Module</option>
                          <option value="recurring">Assign Recurring</option>
                          <option value="bulk">Bulk Assignment</option>
                          <option value="self">Self-Assignment URL</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="label">Title</span>
                        <input className="input" value={assignmentForm.title} onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))} placeholder={draftTemplate.name} />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Assignee User ID</span>
                        <input className="input" value={assignmentForm.assigneeUserId} onChange={(event) => setAssignmentForm((current) => ({ ...current, assigneeUserId: event.target.value }))} placeholder={identity.userId} />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Assignee Email</span>
                        <input className="input" value={assignmentForm.assigneeEmail} onChange={(event) => setAssignmentForm((current) => ({ ...current, assigneeEmail: event.target.value }))} placeholder="vendor@example.com" />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Reviewer User ID</span>
                        <input className="input" value={assignmentForm.reviewerUserId} onChange={(event) => setAssignmentForm((current) => ({ ...current, reviewerUserId: event.target.value }))} placeholder={identity.userId} />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Due Date</span>
                        <input className="input" type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Parent Module</span>
                        <input className="input" value={assignmentForm.parentModule} onChange={(event) => setAssignmentForm((current) => ({ ...current, parentModule: event.target.value }))} placeholder="supply-chain, assets, risks" />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Parent Record ID</span>
                        <input className="input" value={assignmentForm.parentRecordId} onChange={(event) => setAssignmentForm((current) => ({ ...current, parentRecordId: event.target.value }))} />
                      </label>
                      <label className="space-y-2">
                        <span className="label">Recurrence</span>
                        <select className="input" value={assignmentForm.recurrenceType} onChange={(event) => setAssignmentForm((current) => ({ ...current, recurrenceType: event.target.value }))}>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="label">Start Date</span>
                        <input className="input" type="date" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, startDate: event.target.value }))} />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="label">Bulk CSV Emails</span>
                        <textarea className="input min-h-[100px]" value={assignmentForm.bulkCsv} onChange={(event) => setAssignmentForm((current) => ({ ...current, bulkCsv: event.target.value }))} placeholder="email,reviewer,due date&#10;vendor@example.com,reviewer@example.com,2026-06-30" />
                      </label>
                      <label className="flex items-center gap-3 text-sm text-slate-300">
                        <input checked={assignmentForm.loginRequired} className="h-4 w-4 rounded border-white/20 bg-slate-950" onChange={(event) => setAssignmentForm((current) => ({ ...current, loginRequired: event.target.checked }))} type="checkbox" />
                        Require username/password login
                      </label>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button className="button-primary" disabled={saving} onClick={() => void handleCreateAssignment()} type="button">
                        <Send className="mr-2 h-4 w-4" />
                        Create Assignment
                      </button>
                      <button className="button-secondary" onClick={() => void handleExportTemplate()} type="button">
                        <Download className="mr-2 h-4 w-4" />
                        Export Questionnaire
                      </button>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="panel-subtle">
                      <div className="eyebrow">Assignment Coverage</div>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div>Instances: {instances.length}</div>
                        <div>Submitted: {instances.filter((instance) => instance.status === 'Submitted').length}</div>
                        <div>Accepted: {instances.filter((instance) => instance.status === 'Accepted').length}</div>
                        <div>Self URL: {draftTemplate.allowPublicUrl ? 'Enabled' : 'Disabled'}</div>
                      </div>
                    </div>
                    <div className="panel-subtle">
                      <div className="eyebrow">Import / Export JSON</div>
                      <textarea className="input mt-3 min-h-[220px] font-mono text-xs" value={importJsonDraft} onChange={(event) => setImportJsonDraft(event.target.value)} placeholder="Paste exported questionnaire JSON here." />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="button-secondary" disabled={saving || !importJsonDraft.trim()} onClick={() => void handleImportTemplate()} type="button">
                          <Upload className="mr-2 h-4 w-4" />
                          Import JSON
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent className="space-y-6" value="responses">
                <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <aside className="panel-subtle">
                    <div className="eyebrow">Responses</div>
                    <h3 className="mt-2 text-lg font-semibold text-white">Assigned Questionnaires</h3>
                    <div className="mt-4 space-y-3">
                      {instances.map((instance) => (
                        <button
                          className={`w-full rounded-2xl border p-4 text-left transition ${selectedInstance?.id === instance.id ? 'border-cyan-300/30 bg-cyan-400/[0.04]' : 'border-white/10 bg-slate-950/50 hover:border-cyan-300/20'}`}
                          key={instance.id}
                          onClick={() => setSelectedInstanceId(instance.id)}
                          type="button"
                        >
                          <div className="font-medium text-white">{instance.title}</div>
                          <div className="mt-2 text-sm text-slate-400">{instance.assigneeEmail || instance.assigneeUserId || instance.assignmentType}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="badge-neutral">{instance.status}</span>
                            <span className="badge-neutral">{Math.round(instance.percentComplete)}%</span>
                            <span className={instance.passingStatus === 'Passing' ? 'badge-success' : 'badge-neutral'}>{instance.passingStatus}</span>
                          </div>
                        </button>
                      ))}
                      {instances.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No assignments yet. Create one from the Assignments tab.</div>
                      ) : null}
                    </div>
                  </aside>

                  <div className="panel-subtle">
                    {!selectedInstance ? (
                      <div className="text-sm text-slate-300">Select or create an assignment to review responses.</div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="eyebrow">Response Detail</div>
                            <h3 className="mt-2 text-xl font-semibold text-white">{selectedInstance.title}</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="badge-neutral">{selectedInstance.status}</span>
                              <span className="badge-neutral">Access Code: {selectedInstance.accessCode}</span>
                              <span className="badge-neutral">Score: {selectedInstance.score}/{selectedInstance.maxScore}</span>
                              <span className="badge-success">{selectedInstance.grade ?? 'Pending'}</span>
                            </div>
                            <div className="mt-3 break-all text-sm text-cyan-200">{selectedInstance.shareLink}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="button-secondary" onClick={() => void handleExportInstance(selectedInstance)} type="button">
                              <Download className="mr-2 h-4 w-4" />
                              Export
                            </button>
                            <button className="button-secondary" onClick={() => void handleDeleteInstance(selectedInstance)} type="button">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {draftTemplate.questions.map((question) => (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4" key={question.id}>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium text-white">{question.prompt}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{question.ref} · {question.section}</div>
                                </div>
                                {question.required ? <span className="badge-neutral">Required</span> : null}
                              </div>
                              {question.helpText ? <div className="mt-3 text-sm text-slate-400">{question.helpText}</div> : null}
                              <div className="mt-4">
                                {question.type === 'boolean' ? (
                                  <select className="input" value={String(responseDrafts[selectedInstance.id]?.[question.ref] ?? false)} onChange={(event) => setResponseDrafts((current) => ({ ...current, [selectedInstance.id]: { ...(current[selectedInstance.id] ?? {}), [question.ref]: event.target.value === 'true' } }))}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                  </select>
                                ) : question.type === 'single-select' || question.type === 'multi-select' ? (
                                  <select className="input" multiple={question.type === 'multi-select'} value={question.type === 'multi-select' ? ((responseDrafts[selectedInstance.id]?.[question.ref] as string[]) ?? []) : String(responseDrafts[selectedInstance.id]?.[question.ref] ?? '')} onChange={(event) => setResponseDrafts((current) => ({ ...current, [selectedInstance.id]: { ...(current[selectedInstance.id] ?? {}), [question.ref]: question.type === 'multi-select' ? Array.from(event.currentTarget.selectedOptions).map((option) => option.value) : event.target.value } }))}>
                                    {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                ) : question.type === 'instructional' ? (
                                  <div className="rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.04] p-3 text-sm text-slate-300">{question.prompt}</div>
                                ) : (
                                  <textarea className="input min-h-[90px]" value={String(responseDrafts[selectedInstance.id]?.[question.ref] ?? '')} onChange={(event) => setResponseDrafts((current) => ({ ...current, [selectedInstance.id]: { ...(current[selectedInstance.id] ?? {}), [question.ref]: event.target.value } }))} />
                                )}
                              </div>
                              {(question.enableUpload || question.type === 'file-upload') ? (
                                <div className="mt-4">
                                  <label className="label">Manage Uploads</label>
                                  <textarea className="input mt-2 min-h-[70px]" value={String(uploadDrafts[selectedInstance.id]?.[question.ref] ?? '')} onChange={(event) => setUploadDrafts((current) => ({ ...current, [selectedInstance.id]: { ...(current[selectedInstance.id] ?? {}), [question.ref]: event.target.value } }))} placeholder="Evidence file name, URL, or artifact reference" />
                                </div>
                              ) : null}
                              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                                <label className="label">Reviewer Feedback</label>
                                <div className="mt-2 text-sm text-slate-300">
                                  {selectedInstance.feedback?.[question.ref]?.rating ?? 'Not reviewed'} {selectedInstance.feedback?.[question.ref]?.comment ? `· ${selectedInstance.feedback[question.ref].comment}` : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="panel-subtle">
                          <div className="eyebrow">Review & Collaboration</div>
                          <textarea className="input mt-3 min-h-[90px]" value={reviewComments} onChange={(event) => setReviewComments(event.target.value)} placeholder="Comments, request changes guidance, or reviewer note" />
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button className="button-secondary" disabled={saving} onClick={() => void handleSaveInstanceResponse(selectedInstance)} type="button">Save Progress</button>
                            <button className="button-secondary" disabled={saving} onClick={() => void handleInstanceAction(selectedInstance, 'submit')} type="button">Submit</button>
                            <button className="button-secondary" disabled={saving} onClick={() => void handleInstanceAction(selectedInstance, 'feedback')} type="button">Send Email</button>
                            <button className="button-secondary" disabled={saving} onClick={() => void handleInstanceAction(selectedInstance, 'reject')} type="button">Send Email & Reject</button>
                            <button className="button-primary" disabled={saving} onClick={() => void handleInstanceAction(selectedInstance, 'accept')} type="button">Accept</button>
                            <button className="button-secondary" disabled={saving} onClick={() => void handleInstanceAction(selectedInstance, 'reopen')} type="button">Reopen</button>
                          </div>
                          <div className="mt-5 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                              <div className="label">Completion</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{Math.round(selectedInstance.percentComplete)}%</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                              <div className="label">Passing Status</div>
                              <div className="mt-2 text-lg font-semibold text-white">{selectedInstance.passingStatus}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                              <div className="label">Due Date</div>
                              <div className="mt-2 text-lg font-semibold text-white">{selectedInstance.dueDate || 'Not set'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="space-y-6" value="rules">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow">Rules Engine</div>
                    <h3 className="mt-2 text-xl font-semibold text-white">Visual Rule Graph</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                      Persisted rule definitions now live in Cloudflare D1 and drive the same scoring and visibility
                      flows your {workspaceMode === 'assessment-plans' ? 'assessment plan' : 'questionnaire package'} uses
                      in test runs. Draft validation and preview execution now hit the canonical Worker too, so you can
                      verify behavior before committing a save.
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
