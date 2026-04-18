import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { ComplianceAssessment, ComplianceRequirementAssessment } from './types';

const client = new ApiClient();

function formatTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : 'n/a';
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
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('not_assessed');
  const [evidenceStatus, setEvidenceStatus] = useState('missing');
  const [implementationScore, setImplementationScore] = useState('');
  const [documentationScore, setDocumentationScore] = useState('');
  const [observation, setObservation] = useState('');

  async function loadAssessmentDetail() {
    if (!assessmentId) {
      setError('Compliance assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [assessmentResponse, requirementResponse] = await Promise.all([
        client.get<{ data: ComplianceAssessment }>(`/core/compliance-assessments/${assessmentId}`),
        client.get<{ data: ComplianceRequirementAssessment[] }>(
          `/core/compliance-assessments/${assessmentId}/requirements`,
        ),
      ]);
      setAssessment(assessmentResponse.data);
      setRequirements(requirementResponse.data);
      setSelectedRequirementId((current) => {
        if (current && requirementResponse.data.some((item) => item.id === current)) {
          return current;
        }
        return requirementResponse.data[0]?.id ?? null;
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

  const selectedRequirement =
    requirements.find((item) => item.id === selectedRequirementId) ?? requirements[0] ?? null;
  const selectedIndex = selectedRequirement
    ? requirements.findIndex((item) => item.id === selectedRequirement.id)
    : -1;

  useEffect(() => {
    if (!selectedRequirement) {
      setResult('not_assessed');
      setEvidenceStatus('missing');
      setImplementationScore('');
      setDocumentationScore('');
      setObservation('');
      return;
    }

    setResult(selectedRequirement.result);
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
    setObservation(selectedRequirement.observation ?? '');
  }, [selectedRequirement]);

  const distribution = useMemo(() => {
    const counts = {
      compliant: 0,
      partially_compliant: 0,
      non_compliant: 0,
      not_applicable: 0,
      not_assessed: 0,
    };

    for (const requirement of requirements) {
      if (requirement.result in counts) {
        counts[requirement.result as keyof typeof counts] += 1;
      } else {
        counts.not_assessed += 1;
      }
    }

    return counts;
  }, [requirements]);

  async function saveRequirement() {
    if (!assessmentId || !selectedRequirement) {
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const response = await client.post<{ data: ComplianceRequirementAssessment }>(
        `/core/compliance-assessments/${assessmentId}/requirements/${selectedRequirement.id}`,
        {
          result,
          evidenceStatus,
          implementationScore: implementationScore ? Number(implementationScore) : null,
          documentationScore: documentationScore ? Number(documentationScore) : null,
          observation,
        },
      );
      setRequirements((current) =>
        current.map((item) => (item.id === response.data.id ? response.data : item)),
      );
      const assessmentResponse = await client.get<{ data: ComplianceAssessment }>(
        `/core/compliance-assessments/${assessmentId}`,
      );
      setAssessment(assessmentResponse.data);
      setNotice('Requirement assessment updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
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
            Work through requirements one by one, capture evidence posture, and keep framework
            progress current inside the migrated compliance workspace.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          </div>
          <div className="mt-5 panel-subtle">
            <div className="flex items-center justify-between gap-3">
              <div className="label">Assessment progress</div>
              <div className="text-sm text-slate-300">
                {assessment.controlsAssessed}/{assessment.controlsTotal} requirements reviewed
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
              <span className="text-slate-500">Status</span>
              <span className="capitalize">{assessment.status}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Updated</span>
              <span>{formatTimestamp(assessment.updatedAt)}</span>
            </div>
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
          </div>
        </div>
      </section>

      {notice && <div className="notice-success">{notice}</div>}
      {error && <div className="notice-error">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Requirement Queue</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Review Workspace</h2>
            </div>
            <div className="badge-neutral">{requirements.length} requirements</div>
          </div>
          <div className="mt-5 space-y-3">
            {requirements.map((requirement) => (
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
                  <span className={resultBadge(requirement.result)}>{requirement.result.replace(/_/g, ' ')}</span>
                </div>
                <div className="mt-2 font-medium text-white">{requirement.controlTitle}</div>
                {requirement.controlDescription && (
                  <div className="mt-2 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-400">
                    {requirement.controlDescription}
                  </div>
                )}
              </button>
            ))}
            {requirements.length === 0 && (
              <div className="panel-subtle text-sm text-slate-400">
                No framework requirements are linked to this assessment yet.
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          {selectedRequirement ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Selected Requirement</div>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {selectedRequirement.controlRef} {selectedRequirement.controlTitle}
                  </h2>
                </div>
                <div className="text-sm text-slate-400">
                  Item {selectedIndex + 1} of {requirements.length}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                {selectedRequirement.controlDescription || 'No control description is recorded yet.'}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="label">Result</span>
                  <select className="input" onChange={(event) => setResult(event.target.value)} value={result}>
                    <option value="not_assessed">Not assessed</option>
                    <option value="non_compliant">Non-compliant</option>
                    <option value="partially_compliant">Partially compliant</option>
                    <option value="compliant">Compliant</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </label>
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
              </div>

              <label className="mt-5 block space-y-1">
                <span className="label">Observation</span>
                <textarea
                  className="input min-h-[140px]"
                  onChange={(event) => setObservation(event.target.value)}
                  placeholder="Capture the rationale, missing evidence, or remediation notes."
                  value={observation}
                />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="button-secondary"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedRequirementId(requirements[selectedIndex - 1]?.id ?? null)}
                  type="button"
                >
                  Previous
                </button>
                <button className="button-primary" disabled={busy} onClick={() => void saveRequirement()} type="button">
                  {busy ? 'Saving...' : 'Save Review'}
                </button>
                <button
                  className="button-secondary"
                  disabled={selectedIndex >= requirements.length - 1}
                  onClick={() => setSelectedRequirementId(requirements[selectedIndex + 1]?.id ?? null)}
                  type="button"
                >
                  Next
                </button>
                <div className="ml-auto text-xs text-slate-500">
                  Last updated {formatTimestamp(selectedRequirement.updatedAt)}
                </div>
              </div>
            </>
          ) : (
            <div className="panel-subtle text-sm text-slate-400">
              Select a requirement from the left to begin the review flow.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
