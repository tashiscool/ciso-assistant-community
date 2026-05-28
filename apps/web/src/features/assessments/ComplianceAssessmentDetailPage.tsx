import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type {
  ComplianceAssessment,
  ComplianceAssessmentPlanItem,
  ComplianceRequirementAssessment,
} from './types';

const client = new ApiClient();

type ReviewLane = 'controls' | 'plan';

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

function resultBadge(result: string) {
  switch (result) {
    case 'compliant':
      return 'badge-success';
    case 'non_compliant':
      return 'badge-danger';
    case 'partially_compliant':
      return 'inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-amber-200';
    case 'not_applicable':
      return 'inline-flex rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-indigo-200';
    default:
      return 'badge-neutral';
  }
}

export function ComplianceAssessmentDetailPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [requirements, setRequirements] = useState<ComplianceRequirementAssessment[]>([]);
  const [planItems, setPlanItems] = useState<ComplianceAssessmentPlanItem[]>([]);
  const [activeLane, setActiveLane] = useState<ReviewLane>('controls');
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [selectedPlanItemId, setSelectedPlanItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('not_assessed');
  const [evidenceStatus, setEvidenceStatus] = useState('missing');
  const [implementationScore, setImplementationScore] = useState('');
  const [documentationScore, setDocumentationScore] = useState('');
  const [observation, setObservation] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [gapsDifferences, setGapsDifferences] = useState('');
  const [likelihood, setLikelihood] = useState('');
  const [impact, setImpact] = useState('');
  const [autoGenerateFollowUp, setAutoGenerateFollowUp] = useState(false);

  async function loadAssessmentDetail() {
    if (!assessmentId) {
      setError('Compliance assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [assessmentResponse, requirementResponse, planItemResponse] = await Promise.all([
        client.get<{ data: ComplianceAssessment }>(`/core/compliance-assessments/${assessmentId}`),
        client.get<{ data: ComplianceRequirementAssessment[] }>(
          `/core/compliance-assessments/${assessmentId}/requirements`,
        ),
        client.get<{ data: ComplianceAssessmentPlanItem[] }>(
          `/core/compliance-assessments/${assessmentId}/assessment-plan-items`,
        ),
      ]);
      setAssessment(assessmentResponse.data);
      setRequirements(requirementResponse.data);
      setPlanItems(planItemResponse.data);
      setSelectedRequirementId((current) => {
        if (current && requirementResponse.data.some((item) => item.id === current)) {
          return current;
        }
        return requirementResponse.data[0]?.id ?? null;
      });
      setSelectedPlanItemId((current) => {
        if (current && planItemResponse.data.some((item) => item.id === current)) {
          return current;
        }
        return planItemResponse.data[0]?.id ?? null;
      });
      setActiveLane((current) => {
        if (planItemResponse.data.length > 0) {
          return current === 'controls' && requirementResponse.data.length > 0 ? current : 'plan';
        }
        return 'controls';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssessmentDetail();
  }, [identity.tenantId, identity.userId, assessmentId]);

  useEffect(() => {
    if (activeLane === 'plan' && planItems.length === 0 && requirements.length > 0) {
      setActiveLane('controls');
    }
    if (activeLane === 'controls' && requirements.length === 0 && planItems.length > 0) {
      setActiveLane('plan');
    }
  }, [activeLane, planItems.length, requirements.length]);

  const activeItems = activeLane === 'plan' ? planItems : requirements;
  const selectedRequirement =
    requirements.find((item) => item.id === selectedRequirementId) ?? requirements[0] ?? null;
  const selectedPlanItem = planItems.find((item) => item.id === selectedPlanItemId) ?? planItems[0] ?? null;
  const selectedItem = activeLane === 'plan' ? selectedPlanItem : selectedRequirement;
  const selectedIndex = selectedItem ? activeItems.findIndex((item) => item.id === selectedItem.id) : -1;

  useEffect(() => {
    if (!selectedItem) {
      setResult('not_assessed');
      setEvidenceStatus('missing');
      setImplementationScore('');
      setDocumentationScore('');
      setObservation('');
      setEvidenceNote('');
      setGapsDifferences('');
      setLikelihood('');
      setImpact('');
      setAutoGenerateFollowUp(false);
      return;
    }

    setResult(selectedItem.result);
    setObservation(selectedItem.observation ?? '');
    setEvidenceNote(selectedItem.evidenceNote ?? '');
    setGapsDifferences(selectedItem.gapsDifferences ?? '');
    setLikelihood(selectedItem.likelihood === null ? '' : String(selectedItem.likelihood));
    setImpact(selectedItem.impact === null ? '' : String(selectedItem.impact));
    setAutoGenerateFollowUp(selectedItem.autoGenerateFollowUp);

    if (activeLane === 'controls' && selectedRequirement) {
      setEvidenceStatus(selectedRequirement.evidenceStatus);
      setImplementationScore(
        selectedRequirement.implementationScore === null
          ? ''
          : String(selectedRequirement.implementationScore),
      );
      setDocumentationScore(
        selectedRequirement.documentationScore === null
          ? ''
          : String(selectedRequirement.documentationScore),
      );
      return;
    }

    setEvidenceStatus('missing');
    setImplementationScore('');
    setDocumentationScore('');
  }, [activeLane, selectedItem, selectedRequirement]);

  const distribution = useMemo(() => {
    const counts = {
      compliant: 0,
      partially_compliant: 0,
      non_compliant: 0,
      not_applicable: 0,
      not_assessed: 0,
    };

    for (const item of [...requirements, ...planItems]) {
      if (item.result in counts) {
        counts[item.result as keyof typeof counts] += 1;
      } else {
        counts.not_assessed += 1;
      }
    }

    return counts;
  }, [planItems, requirements]);

  async function saveSelectedItem() {
    if (!assessmentId || !selectedItem) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);

      if (activeLane === 'plan' && selectedPlanItem) {
        const response = await client.post<{ data: ComplianceAssessmentPlanItem }>(
          `/core/compliance-assessments/${assessmentId}/assessment-plan-items/${selectedPlanItem.id}`,
          {
            result,
            observation,
            evidenceNote,
            gapsDifferences,
            likelihood: likelihood ? Number(likelihood) : null,
            impact: impact ? Number(impact) : null,
            autoGenerateFollowUp,
          },
        );
        setPlanItems((current) =>
          current.map((item) => (item.id === response.data.id ? response.data : item)),
        );
        setNotice('Line of inquiry updated.');
      } else if (selectedRequirement) {
        const response = await client.post<{ data: ComplianceRequirementAssessment }>(
          `/core/compliance-assessments/${assessmentId}/requirements/${selectedRequirement.id}`,
          {
            result,
            evidenceStatus,
            implementationScore: implementationScore ? Number(implementationScore) : null,
            documentationScore: documentationScore ? Number(documentationScore) : null,
            observation,
            evidenceNote,
            gapsDifferences,
            likelihood: likelihood ? Number(likelihood) : null,
            impact: impact ? Number(impact) : null,
            autoGenerateFollowUp,
          },
        );
        setRequirements((current) =>
          current.map((item) => (item.id === response.data.id ? response.data : item)),
        );
        setNotice('Requirement assessment updated.');
      }

      const assessmentResponse = await client.get<{ data: ComplianceAssessment }>(
        `/core/compliance-assessments/${assessmentId}`,
      );
      setAssessment(assessmentResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function selectPreviousItem() {
    const previous = activeItems[selectedIndex - 1];
    if (!previous) {
      return;
    }
    if (activeLane === 'plan') {
      setSelectedPlanItemId(previous.id);
      return;
    }
    setSelectedRequirementId(previous.id);
  }

  function selectNextItem() {
    const next = activeItems[selectedIndex + 1];
    if (!next) {
      return;
    }
    if (activeLane === 'plan') {
      setSelectedPlanItemId(next.id);
      return;
    }
    setSelectedRequirementId(next.id);
  }

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading compliance assessment workspace...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">Compliance assessment not found for tenant {identity.tenantId}.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to="/assessments">
            Back to assessments
          </Link>
          <div className="eyebrow mt-4">Governance</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">{assessment.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Work through scoped controls and reusable lines of inquiry, capture lightning-assessment
            results, document evidence and gaps, and keep manual or compliance review progress current
            in the tenant workspace.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="metric-card">
              <div className="metric-label">Framework</div>
              <div className="mt-3 text-lg font-semibold text-white">{assessment.frameworkName}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Perimeter</div>
              <div className="mt-3 text-lg font-semibold text-white">
                {assessment.perimeterName ?? assessment.folderName}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Progress</div>
              <div className="metric-value">{assessment.progressPercent}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Maturity</div>
              <div className="metric-value">{assessment.maturityScore?.toFixed(1) ?? 'n/a'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Assessment type</div>
              <div className="mt-3 text-lg font-semibold capitalize text-white">
                {assessment.assessmentKind.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <div className="mt-5 panel-subtle">
            <div className="flex items-center justify-between gap-3">
              <div className="label">Assessment progress</div>
              <div className="text-sm text-slate-300">
                {assessment.controlsAssessed}/{assessment.controlsTotal}{' '}
                {planItems.length > 0 ? 'review items' : 'requirements'} reviewed
              </div>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-950/80">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${Math.max(assessment.progressPercent, 0)}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-5">
              <div className="panel-subtle">
                <div className="label">Compliant</div>
                <div className="mt-2 text-lg font-semibold text-white">{distribution.compliant}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">Partial</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {distribution.partially_compliant}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Non-compliant</div>
                <div className="mt-2 text-lg font-semibold text-white">{distribution.non_compliant}</div>
              </div>
              <div className="panel-subtle">
                <div className="label">N/A</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {distribution.not_applicable}
                </div>
              </div>
              <div className="panel-subtle">
                <div className="label">Not assessed</div>
                <div className="mt-2 text-lg font-semibold text-white">{distribution.not_assessed}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-subtle space-y-3">
          <div className="label">Assessment record</div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Reference</span>
              <span className="font-mono text-xs text-cyan-200">{assessment.refId ?? 'n/a'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Version</span>
              <span>{assessment.version}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Lead assessor</span>
              <span>{assessment.leadAssessorUserId ?? 'n/a'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Status</span>
              <span className="capitalize">{assessment.status}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Planned window</span>
              <span>
                {formatDate(assessment.plannedStartOn)} to {formatDate(assessment.plannedFinishOn)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Updated</span>
              <span>{formatTimestamp(assessment.updatedAt)}</span>
            </div>
            {assessment.assessmentPlanName ? (
              <div className="pt-2">
                <div className="text-slate-500">Assessment plan</div>
                <div className="mt-2 font-medium text-white">{assessment.assessmentPlanName}</div>
                <Link
                  className="mt-2 inline-flex text-sm text-cyan-200 transition hover:text-cyan-100"
                  to="/assessment-plans"
                >
                  Open assessment plans
                </Link>
              </div>
            ) : null}
            <div className="pt-2">
              <div className="text-slate-500">Framework workspace</div>
              <Link
                className="mt-2 inline-flex text-sm text-cyan-200 transition hover:text-cyan-100"
                to={`/frameworks/${assessment.frameworkId}`}
              >
                Open {assessment.frameworkName}
              </Link>
            </div>
            <div className="pt-2">
              <div className="text-slate-500">Remediation workspace</div>
              <Link
                className="mt-2 inline-flex text-sm text-cyan-200 transition hover:text-cyan-100"
                to={`/compliance-assessments/${assessment.id}/action-plan`}
              >
                Open action plan
              </Link>
            </div>
            <div className="pt-2">
              <div className="text-slate-500">Observation</div>
              <div className="mt-2 whitespace-pre-line leading-6">
                {assessment.observation || 'No assessment observation recorded yet.'}
              </div>
            </div>
            <div className="pt-2">
              <div className="text-slate-500">Instructions</div>
              <div className="mt-2 whitespace-pre-line leading-6">
                {assessment.instructions || 'No reviewer instructions recorded yet.'}
              </div>
            </div>
            <div className="pt-2">
              <div className="text-slate-500">Process info</div>
              <div className="mt-2 whitespace-pre-line leading-6">
                {assessment.processInfo || 'No process notes recorded yet.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">
                {activeLane === 'plan' ? 'Assessment Plan Execution' : 'Controls in Scope'}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {activeLane === 'plan' ? 'Lines of Inquiry' : 'Progress Report'}
              </h2>
            </div>
            <div className="badge-neutral">{activeItems.length} items</div>
          </div>
          {planItems.length > 0 && requirements.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className={activeLane === 'plan' ? 'button-primary' : 'button-secondary'}
                onClick={() => setActiveLane('plan')}
                type="button"
              >
                Assessment Plan
              </button>
              <button
                className={activeLane === 'controls' ? 'button-primary' : 'button-secondary'}
                onClick={() => setActiveLane('controls')}
                type="button"
              >
                Scoped Controls
              </button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {activeLane === 'plan'
              ? planItems.map((item) => (
                  <button
                    key={item.id}
                    className={[
                      'w-full rounded-3xl border p-4 text-left transition',
                      item.id === selectedPlanItem?.id
                        ? 'border-cyan-300/50 bg-cyan-400/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                    ].join(' ')}
                    onClick={() => setSelectedPlanItemId(item.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                        {item.lineRef}
                      </span>
                      <span className={resultBadge(item.result)}>{item.result.replace(/_/g, ' ')}</span>
                      {item.requirementRef ? (
                        <span className="badge-neutral">Maps to {item.requirementRef}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 font-medium text-white">{item.linePrompt}</div>
                    {item.lineSection ? (
                      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        {item.lineSection}
                      </div>
                    ) : null}
                  </button>
                ))
              : requirements.map((requirement) => (
                  <button
                    key={requirement.id}
                    className={[
                      'w-full rounded-3xl border p-4 text-left transition',
                      requirement.id === selectedRequirement?.id
                        ? 'border-cyan-300/50 bg-cyan-400/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
                    ].join(' ')}
                    onClick={() => setSelectedRequirementId(requirement.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
                        {requirement.controlRef}
                      </span>
                      <span className={resultBadge(requirement.result)}>
                        {requirement.result.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-2 font-medium text-white">{requirement.controlTitle}</div>
                    {requirement.controlDescription ? (
                      <div className="mt-2 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-400">
                        {requirement.controlDescription}
                      </div>
                    ) : null}
                  </button>
                ))}
            {activeItems.length === 0 ? (
              <div className="panel-subtle text-sm text-slate-400">
                {activeLane === 'plan'
                  ? 'No lines of inquiry are linked to this assessment yet.'
                  : 'No framework requirements are linked to this assessment yet.'}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          {selectedItem ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">
                    {activeLane === 'plan' ? 'Assessment Plan Review' : 'Lightning Assessment'}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {activeLane === 'plan' && selectedPlanItem
                      ? `${selectedPlanItem.lineRef} ${selectedPlanItem.linePrompt}`
                      : selectedRequirement
                        ? `${selectedRequirement.controlRef} ${selectedRequirement.controlTitle}`
                        : 'Review Item'}
                  </h2>
                </div>
                <div className="text-sm text-slate-400">
                  Item {selectedIndex + 1} of {activeItems.length}
                </div>
              </div>

              {activeLane === 'plan' && selectedPlanItem ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {selectedPlanItem.lineSection ? (
                      <span className="badge-neutral">{selectedPlanItem.lineSection}</span>
                    ) : null}
                    {selectedPlanItem.requirementRef ? (
                      <span className="badge-neutral">Requirement {selectedPlanItem.requirementRef}</span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {selectedPlanItem.evidenceHint ||
                      'Capture the specific evidence and reviewer observations that support this line of inquiry.'}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {selectedRequirement?.controlDescription || 'No control description is recorded yet.'}
                </p>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Result</span>
                  <select className="input" onChange={(event) => setResult(event.target.value)} value={result}>
                    <option value="not_assessed">Not assessed</option>
                    <option value="compliant">Pass</option>
                    <option value="partially_compliant">Partial pass</option>
                    <option value="non_compliant">Fail</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </label>
                {activeLane === 'controls' ? (
                  <label className="space-y-1">
                    <span className="label">Evidence status</span>
                    <select
                      className="input"
                      onChange={(event) => setEvidenceStatus(event.target.value)}
                      value={evidenceStatus}
                    >
                      <option value="missing">Missing</option>
                      <option value="draft">Draft</option>
                      <option value="in_review">In review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                ) : (
                  <div className="panel-subtle text-sm leading-6 text-slate-300">
                    Use the evidence note below to describe the supporting artifacts or reviewer references
                    used for this line of inquiry.
                  </div>
                )}
                {activeLane === 'controls' ? (
                  <>
                    <label className="space-y-1">
                      <span className="label">Implementation score</span>
                      <input
                        className="input"
                        max="5"
                        min="0"
                        onChange={(event) => setImplementationScore(event.target.value)}
                        step="0.1"
                        type="number"
                        value={implementationScore}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="label">Documentation score</span>
                      <input
                        className="input"
                        max="5"
                        min="0"
                        onChange={(event) => setDocumentationScore(event.target.value)}
                        step="0.1"
                        type="number"
                        value={documentationScore}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              <label className="mt-5 block space-y-1">
                <span className="label">Observation</span>
                <textarea
                  className="input min-h-[140px]"
                  onChange={(event) => setObservation(event.target.value)}
                  placeholder="Capture what was tested and what was found."
                  value={observation}
                />
              </label>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Evidence note</span>
                  <textarea
                    className="input min-h-[120px]"
                    onChange={(event) => setEvidenceNote(event.target.value)}
                    placeholder="Describe or reference the evidence used for this review."
                    value={evidenceNote}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Gaps and differences</span>
                  <textarea
                    className="input min-h-[120px]"
                    onChange={(event) => setGapsDifferences(event.target.value)}
                    placeholder="Record deficiencies, exceptions, or notable differences."
                    value={gapsDifferences}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="label">Likelihood</span>
                  <input
                    className="input"
                    max="5"
                    min="0"
                    onChange={(event) => setLikelihood(event.target.value)}
                    step="0.1"
                    type="number"
                    value={likelihood}
                  />
                </label>
                <label className="space-y-1">
                  <span className="label">Impact</span>
                  <input
                    className="input"
                    max="5"
                    min="0"
                    onChange={(event) => setImpact(event.target.value)}
                    step="0.1"
                    type="number"
                    value={impact}
                  />
                </label>
                <label className="mt-7 flex items-center gap-3 text-sm text-slate-300">
                  <input
                    checked={autoGenerateFollowUp}
                    onChange={(event) => setAutoGenerateFollowUp(event.target.checked)}
                    type="checkbox"
                  />
                  Auto-generate follow-up
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="button-secondary"
                  disabled={selectedIndex <= 0}
                  onClick={selectPreviousItem}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button-primary"
                  disabled={busy}
                  onClick={() => void saveSelectedItem()}
                  type="button"
                >
                  {busy ? 'Saving...' : 'Save and Continue'}
                </button>
                <button
                  className="button-secondary"
                  disabled={selectedIndex >= activeItems.length - 1}
                  onClick={selectNextItem}
                  type="button"
                >
                  Next
                </button>
                <div className="ml-auto text-xs text-slate-500">
                  Last updated {formatTimestamp(selectedItem.updatedAt)}
                </div>
              </div>
            </>
          ) : (
            <div className="panel-subtle text-sm text-slate-400">
              Select a {activeLane === 'plan' ? 'line of inquiry' : 'requirement'} from the left to
              begin the review flow.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
