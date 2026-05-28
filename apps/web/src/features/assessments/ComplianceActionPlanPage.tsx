import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiClient } from '../../shared/api/client';
import { useEdgeIdentity } from '../../shared/session/identity';
import type { AppliedControl, ComplianceAssessment } from './types';

const client = new ApiClient();

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : 'n/a';
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : 'n/a';
}

export function ComplianceActionPlanPage() {
  const { identity } = useEdgeIdentity();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [assessment, setAssessment] = useState<ComplianceAssessment | null>(null);
  const [controls, setControls] = useState<AppliedControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActionPlan() {
    if (!assessmentId) {
      setError('Compliance assessment id is missing from the route.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await client.get<{
        data: {
          assessment: ComplianceAssessment;
          appliedControls: AppliedControl[];
          summary: {
            controlsCount: number;
            totalAnnualCost: number;
            byStatus: Record<string, number>;
            byPriority: Record<string, number>;
          };
        };
      }>(`/core/compliance-assessments/${assessmentId}/action-plan`);
      setAssessment(response.data.assessment);
      setControls(response.data.appliedControls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionPlan();
  }, [identity.tenantId, identity.userId, assessmentId]);

  const summary = useMemo(() => {
    const totalAnnualCost = controls.reduce((sum, control) => sum + (control.annualCost ?? 0), 0);
    const byStatus = controls.reduce<Record<string, number>>((acc, control) => {
      acc[control.status] = (acc[control.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalAnnualCost,
      openItems: (byStatus.to_do ?? 0) + (byStatus.in_progress ?? 0) + (byStatus.on_hold ?? 0),
      activeItems: byStatus.active ?? 0,
      pendingItems: byStatus['--'] ?? 0,
    };
  }, [controls]);

  if (loading) {
    return <div className="panel p-6 text-sm text-slate-300">Loading action plan workspace...</div>;
  }

  if (!assessment) {
    return <div className="notice-error">Action plan not found for tenant {identity.tenantId}.</div>;
  }

  const backUrl = `/compliance-assessments/${assessment.id}/action-plan`;
  const backLabel = 'Action Plan';

  return (
    <div className="space-y-6">
      <section className="panel grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link className="text-sm text-cyan-200 transition hover:text-cyan-100" to={`/compliance-assessments/${assessment.id}`}>
            Back to compliance review
          </Link>
          <div className="eyebrow mt-4">Remediation</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Action Plan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Track the applied controls and remediation work generated from this compliance review.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">Assessment</div>
              <div className="mt-3 text-sm font-semibold text-white">{assessment.name}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Framework</div>
              <div className="mt-3 text-sm font-semibold text-white">{assessment.frameworkName}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Perimeter</div>
              <div className="mt-3 text-sm font-semibold text-white">
                {assessment.perimeterName ?? assessment.folderName}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Version</div>
              <div className="metric-value">{assessment.version}</div>
            </div>
          </div>
        </div>

        <div className="panel-subtle space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link
              className="button-primary"
              to={`/applied-controls/flash-mode?complianceAssessmentId=${assessment.id}&backUrl=${encodeURIComponent(backUrl)}&backLabel=${encodeURIComponent(backLabel)}`}
            >
              Open Flash Mode
            </Link>
            <Link
              className="button-secondary"
              to={`/applied-controls/kanban-mode?complianceAssessmentId=${assessment.id}&backUrl=${encodeURIComponent(backUrl)}&backLabel=${encodeURIComponent(backLabel)}`}
            >
              Open Kanban Board
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="metric-card">
              <div className="metric-label">Annual budget</div>
              <div className="metric-value">{formatCurrency(summary.totalAnnualCost)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Open work</div>
              <div className="metric-value">{summary.openItems}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Active controls</div>
              <div className="metric-value">{summary.activeItems}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Tracking only</div>
              <div className="metric-value">{summary.pendingItems}</div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice-error">{error}</div>}

      <section className="panel overflow-hidden p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Applied control</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Annual cost</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">
                    {control.refId ? `${control.refId} ` : ''}
                    {control.name}
                  </div>
                  {control.description && (
                    <div className="mt-2 text-sm leading-6 text-slate-400">{control.description}</div>
                  )}
                  {control.requirementAssessment && (
                    <div className="mt-2 text-xs text-cyan-200">
                      Linked requirement: {control.requirementAssessment.ref} {control.requirementAssessment.name}
                    </div>
                  )}
                  {control.assessmentPlanItem && (
                    <div className="mt-2 text-xs text-cyan-200">
                      Linked line of inquiry: {control.assessmentPlanItem.ref} {control.assessmentPlanItem.prompt}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="capitalize text-slate-300">{control.status.replace(/_/g, ' ')}</div>
                  <div className="mt-1 text-xs text-slate-500">{control.priority ?? '--'}</div>
                </td>
                <td className="px-4 py-4 text-slate-300">{control.ownerName ?? 'Unassigned'}</td>
                <td className="px-4 py-4 text-slate-300">{formatDate(control.eta)}</td>
                <td className="px-4 py-4 text-slate-300">{formatCurrency(control.annualCost)}</td>
              </tr>
            ))}
            {controls.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={5}>
                  No applied controls are linked to this compliance review yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
